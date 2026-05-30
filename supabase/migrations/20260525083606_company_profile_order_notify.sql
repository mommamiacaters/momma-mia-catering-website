-- ============================================================================
-- Company Profile + server-side order-notification email
-- ----------------------------------------------------------------------------
-- * company_profile: a SINGLE-ROW table holding editable business info,
--   notably order_notification_email (the store's official inbox). Admin-only.
-- * notify_order_created(): fires the n8n webhook once for EVERY order (web +
--   mobile both insert via create_order). NOTE on timing: create_order inserts
--   the order with total_cents=0, THEN inserts items, THEN updates the total —
--   so we hook AFTER UPDATE guarded to the finalize transition (0 → >0), the one
--   moment when items exist and the total is set. Fire-and-forget via pg_net so a
--   notification failure never blocks the order. Recipient comes from
--   company_profile; the n8n url/token come from app_settings (kept out of this
--   migration so no secret is committed — seed them separately).
-- ============================================================================

-- ---------- company_profile (singleton) -------------------------------------
create table public.company_profile (
  id                       boolean primary key default true check (id),  -- one row only
  business_name            text not null default 'Momma Mia Caters',
  order_notification_email text not null default 'mommamiacaters@gmail.com',
  contact_email            text,
  contact_phone            text,
  address                  text,
  updated_at               timestamptz not null default now()
);

insert into public.company_profile (id) values (true) on conflict (id) do nothing;

create trigger trg_company_profile_updated_at
  before update on public.company_profile
  for each row execute function public.set_updated_at();

alter table public.company_profile enable row level security;

create policy "admins read company profile"
  on public.company_profile for select
  using (public.is_admin());

create policy "admins update company profile"
  on public.company_profile for update
  using (public.is_admin()) with check (public.is_admin());
-- No insert/delete policy: the singleton is seeded above; the trigger reads it as definer.

-- ---------- order-notification trigger (pg_net → n8n) -----------------------
create extension if not exists pg_net;

create or replace function public.notify_order_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to    text;
  v_url   text;
  v_token text;
  v_items jsonb;
begin
  select order_notification_email into v_to from public.company_profile limit 1;
  select value #>> '{}' into v_url   from public.app_settings where key = 'n8n_webhook_url';
  select value #>> '{}' into v_token from public.app_settings where key = 'n8n_checkout_token';

  -- Not configured yet → skip silently (don't error the order).
  if v_url is null or v_url = '' then
    return new;
  end if;

  select coalesce(
           jsonb_agg(jsonb_build_object(
             'item_name', i.item_name,
             'qty', i.qty,
             'unit_price_cents', i.unit_price_cents,
             'plan_type', i.plan_type)),
           '[]'::jsonb)
    into v_items
    from public.order_items i
   where i.order_id = new.id;

  perform net.http_post(
    url := v_url,
    -- n8n's TLS handshake can take ~5s (the pg_net default), so give it headroom.
    timeout_milliseconds := 15000,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-MM-Auth-Token', coalesce(v_token, '')
    ),
    body := jsonb_build_object(
      'source', 'app-order',
      'notificationEmail', v_to,
      'order', jsonb_build_object(
        'orderRef', new.order_ref,
        'status', new.status,
        'orderType', new.order_type,
        'subtotalCents', new.subtotal_cents,
        'deliveryFeeCents', new.delivery_fee_cents,
        'totalCents', new.total_cents,
        'paymentProofUrl', new.payment_proof_url,
        'createdAt', new.created_at
      ),
      'customer', jsonb_build_object(
        'firstName', new.customer_first_name,
        'lastName', new.customer_last_name,
        'email', new.customer_email,
        'phone', new.customer_phone,
        'deliveryAddress', new.delivery_address,
        'deliveryDate', new.delivery_date,
        'deliveryTime', new.delivery_time,
        'specialRequests', new.special_requests
      ),
      'items', v_items
    )
  );

  return new;
end;
$$;

-- Hook the create_order finalize step (total 0 → >0): items are inserted and the
-- total is set by then, and admin status edits (total unchanged) won't match.
create trigger trg_notify_order_created
  after update on public.orders
  for each row
  when (old.total_cents = 0 and new.total_cents > 0)
  execute function public.notify_order_created();
