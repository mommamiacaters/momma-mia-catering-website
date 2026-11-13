-- ============================================================================
-- Go-live hardening (review of 2026-11-13).
--
-- Every section is idempotent (guarded DO blocks / create or replace / if not
-- exists) and each says WHY. Nothing here changes a table's data. Nothing here
-- touches a policy the web or mobile app depends on.
--
-- NOT in this file (manual / dashboard): auth site_url + redirect allow-list,
-- custom SMTP, PAYPAL_WEBHOOK_ID secret, leaked-password protection (Pro plan),
-- backups, orphan menu-images cleanup.
-- ============================================================================


-- ---------- 1. Internal functions must not be callable through the API -------
-- WHY: Supabase grants EXECUTE to anon/authenticated by default. _order_notify_post
-- is SECURITY DEFINER and reads the order-notify secret from the vault, so an
-- anonymous caller could POST /rpc/_order_notify_post with an arbitrary `p_to`
-- and a forged order, and the DB would send it to the edge function WITH the
-- shared secret: free, DKIM-signed phishing/spam from the Momma Mia domain and
-- a drain on the Resend quota. The same applies to the contact/quote twins.
-- Trigger functions are never called through RPC; Postgres checks EXECUTE on a
-- trigger function only when the trigger is CREATED, not when it fires, and the
-- nested calls run as the SECURITY DEFINER owner (postgres), so revoking is safe.
-- KEPT callable on purpose: create_order, submit_contact_message (public RPCs),
-- is_admin (evaluated inside RLS policies as the caller), save_menu_item
-- (authenticated admin RPC), private.payment_proof_key_is_claimed (storage policy).
do $$
declare
  v_sig text;
  v_oid regprocedure;
begin
  foreach v_sig in array array[
    'public._order_notify_post(text,text,public.orders)',
    'public._contact_notify_post(public.contact_submissions)',
    'public._quote_notify_post(public.quote_requests)',
    'public._notify_config()',
    'public.notify_order_created()',
    'public.notify_order_delivered()',
    'public.notify_contact_submission()',
    'public.notify_quote_request()',
    'public.handle_new_user()',
    'public.prevent_role_change()',
    'public.ensure_home_menu_item_category()',
    'public.rls_auto_enable()',
    'public._orders_sync_total()',
    'public.enforce_app_settings_secret_private()',
    'public.set_updated_at()',
    'public.attach_paypal_order(uuid,text)',
    'public.record_paypal_capture(text,text,integer,text,text)'
  ]
  loop
    v_oid := to_regprocedure(v_sig);
    if v_oid is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', v_oid);
    end if;
  end loop;
end $$;


-- ---------- 2. Fixed search_path on the two remaining mutable functions ------
-- WHY: advisor `function_search_path_mutable`. Neither body references any
-- unqualified object (now(), raise, ilike are pg_catalog), so '' is safe.
alter function public.set_updated_at() set search_path = '';
alter function public.enforce_app_settings_secret_private() set search_path = '';


-- ---------- 3. Catalog views run as the caller, not the owner ----------------
-- WHY: advisor ERROR `security_definer_view`. These three views were created
-- without security_invoker, so they read the base tables as `postgres` and
-- bypass RLS. Their WHERE clauses already mirror the public SELECT policies
-- (is_active / is_available), so anon sees the same rows as before; admins see
-- everything through the "admins manage" policies. One intentional nuance:
-- meal_plan_price_ranges no longer exposes inactive plans or counts dishes that
-- sit in an inactive sub-category (meal_plan_options already excluded those).
do $$
declare v text;
begin
  foreach v in array array['extras_menu_options','meal_plan_options','meal_plan_price_ranges']
  loop
    if to_regclass('public.' || v) is not null then
      execute format('alter view public.%I set (security_invoker = true)', v);
    end if;
  end loop;
end $$;


-- ---------- 4. Strip table privileges nobody should have ----------------------
-- WHY: Supabase default-grants ALL on every public table to anon+authenticated.
-- RLS covers SELECT/INSERT/UPDATE/DELETE, but NOT TRUNCATE, REFERENCES or
-- TRIGGER, so those grants are pure risk. The app never writes as anon (orders
-- and contact go through SECURITY DEFINER RPCs, uploads go through storage), so
-- anon keeps SELECT only. authenticated keeps its CRUD (admin UI) minus the
-- three non-RLS privileges. The leftover migration scaffold table is sealed.
do $$
declare r record;
begin
  for r in
    select c.oid::regclass as rel, c.relkind
      from pg_class c
     where c.relnamespace = 'public'::regnamespace
       and c.relkind in ('r','v','p')
  loop
    if r.relkind = 'v' then
      execute format('revoke insert, update, delete, truncate, references, trigger on %s from anon, authenticated', r.rel);
    else
      execute format('revoke insert, update, delete, truncate, references, trigger on %s from anon', r.rel);
      execute format('revoke truncate, references, trigger on %s from authenticated', r.rel);
    end if;
  end loop;

  if to_regclass('public.sub_category_remap_20260831') is not null then
    revoke all on public.sub_category_remap_20260831 from anon, authenticated;
  end if;

  -- The archive schema already has no anon/authenticated access; make it explicit
  -- so a future default-privilege grant cannot silently open the launch backup.
  if exists (select 1 from pg_namespace where nspname = 'archive') then
    revoke all on schema archive from anon, authenticated;
    revoke all on all tables in schema archive from anon, authenticated;
  end if;
end $$;


-- ---------- 5. Cap payment-proof uploads --------------------------------------
-- WHY: anon may upload to a key a fresh order reserved (2 h window) but the
-- bucket had no size limit, so one key could take an arbitrarily large file.
-- 25 MB is far above a phone screenshot/photo. No MIME allow-list on purpose:
-- browsers report '' or octet-stream for HEIC, which would reject real receipts.
update storage.buckets
   set file_size_limit = 26214400
 where id = 'payment-proofs'
   and (file_size_limit is null or file_size_limit > 26214400);


-- ---------- 6. Server-side intake validation + flood throttle on orders ------
-- WHY: create_order trusts the client for everything except prices. The web form
-- enforces these rules in the browser only (min={today}, required fields), and
-- create_order is callable anonymously, so enforce them where they cannot be
-- bypassed. Also, create_order is unauthenticated and each manual-proof order
-- immediately emails the owner AND the address the caller typed, so without a
-- throttle it is a mail relay and a Resend-quota burner.
--  * required contact fields not blank; email has a plausible shape
--  * delivery date not in the past (1 day of slack: the browser uses the
--    customer's local date, the business runs on Asia/Manila)
--  * max 5 orders per email per rolling hour, max 100 orders per 10 minutes
-- BEFORE INSERT only: admin edits and PayPal status updates are unaffected.
create or replace function public._orders_validate_intake()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if btrim(coalesce(new.customer_first_name, '')) = ''
     or btrim(coalesce(new.customer_last_name, '')) = ''
     or btrim(coalesce(new.customer_phone, '')) = '' then
    raise exception 'Name and phone are required';
  end if;

  if new.customer_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'A valid email address is required';
  end if;

  if new.delivery_date is not null and new.delivery_date < v_today - 1 then
    raise exception 'Delivery date cannot be in the past';
  end if;

  if (select count(*) from public.orders o
       where lower(o.customer_email) = lower(new.customer_email)
         and o.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many orders from this email, please try again later';
  end if;

  if (select count(*) from public.orders o
       where o.created_at > now() - interval '10 minutes') >= 100 then
    raise exception 'We are receiving too many orders right now, please try again shortly';
  end if;

  return new;
end;
$$;

revoke execute on function public._orders_validate_intake() from public, anon, authenticated;

drop trigger if exists trg_orders_validate_intake on public.orders;
create trigger trg_orders_validate_intake
  before insert on public.orders
  for each row execute function public._orders_validate_intake();


-- ---------- 7. record_paypal_capture: refunds and late declines --------------
-- WHY: the webhook maps PAYMENT.CAPTURE.REFUNDED/REVERSED to status 'REFUNDED',
-- but the old function treated every non-COMPLETED status as a failed capture,
-- so a refunded order was written as payment_status='failed' with the refund
-- id in paypal_capture_id, and a stray DECLINED event could flip a PAID order
-- to 'failed'. Now: a refund on a paid order becomes 'refunded'; a non-COMPLETED
-- event never downgrades a paid or refunded order; a COMPLETED replay never
-- resurrects a refunded order. Signature, grants and the COMPLETED/amount-check
-- paths are unchanged. (Grants are re-applied in section 1 on re-run.)
create or replace function public.record_paypal_capture(
  p_paypal_order_id text,
  p_capture_id      text,
  p_amount_cents    integer,
  p_currency        text,
  p_status          text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order record;
begin
  select id, order_ref, total_cents, payment_status, paypal_capture_id
    into v_order
    from public.orders
   where paypal_order_id = p_paypal_order_id
   for update;

  if not found then
    raise exception 'No order matches PayPal order %', p_paypal_order_id;
  end if;

  if v_order.payment_status = 'paid' and v_order.paypal_capture_id = p_capture_id then
    return jsonb_build_object(
      'order_ref', v_order.order_ref, 'status', 'paid', 'duplicate', true);
  end if;

  -- Money went back to the buyer. Record it; a human decides about the order.
  if upper(coalesce(p_status, '')) = 'REFUNDED' then
    if v_order.payment_status = 'paid' then
      update public.orders set payment_status = 'refunded' where id = v_order.id;
      return jsonb_build_object('order_ref', v_order.order_ref, 'status', 'refunded');
    end if;
    return jsonb_build_object(
      'order_ref', v_order.order_ref, 'status', v_order.payment_status::text, 'ignored', true);
  end if;

  -- Already settled or refunded: a replayed/late event must not rewrite history.
  if v_order.payment_status = 'refunded' then
    return jsonb_build_object(
      'order_ref', v_order.order_ref, 'status', 'refunded', 'ignored', true);
  end if;
  if v_order.payment_status = 'paid' and upper(coalesce(p_status, '')) <> 'COMPLETED' then
    return jsonb_build_object(
      'order_ref', v_order.order_ref, 'status', 'paid', 'ignored', true, 'reason', p_status);
  end if;

  if upper(coalesce(p_status, '')) <> 'COMPLETED' then
    update public.orders
       set payment_status = 'failed',
           payment_amount_cents = p_amount_cents,
           paypal_capture_id = p_capture_id
     where id = v_order.id;
    return jsonb_build_object(
      'order_ref', v_order.order_ref, 'status', 'failed', 'reason', p_status);
  end if;

  -- RETURNS rather than raises: a RAISE would roll back the UPDATE that records
  -- the failure and leave captured money with nothing on the row to say so.
  if p_amount_cents is distinct from v_order.total_cents
     or upper(coalesce(p_currency, '')) <> 'PHP' then
    update public.orders
       set payment_status = 'failed',
           payment_amount_cents = p_amount_cents,
           paypal_capture_id = p_capture_id
     where id = v_order.id;
    return jsonb_build_object(
      'order_ref', v_order.order_ref,
      'status', 'failed',
      'reason', 'amount_mismatch',
      'expected_cents', v_order.total_cents,
      'got_cents', p_amount_cents,
      'got_currency', p_currency);
  end if;

  update public.orders
     set payment_status = 'paid',
         paid_at = now(),
         paypal_capture_id = p_capture_id,
         payment_amount_cents = p_amount_cents,
         notified_at = coalesce(notified_at, now())
   where id = v_order.id;

  return jsonb_build_object(
    'order_ref', v_order.order_ref, 'status', 'paid', 'duplicate', false);
end;
$$;

-- Re-assert: only the service role (edge functions) may call the PayPal RPCs.
revoke execute on function public.record_paypal_capture(text,text,integer,text,text)
  from public, anon, authenticated;
grant execute on function public.record_paypal_capture(text,text,integer,text,text)
  to service_role;
