-- ============================================================================
-- Notify config → Supabase Vault, PHASE A (safe / reversible)
-- ----------------------------------------------------------------------------
-- WHY: public.app_settings' policy is `FOR ALL USING (is_admin())`. RLS filters
-- ROWS, never COLUMNS, so any admin session can SELECT order_notify_secret —
-- and settingsService.fetchAllSettings() does exactly that, putting the shared
-- secret in the admin browser's network response. AdminSettings.tsx only
-- filters it out of the *display*, which is presentation, not authorisation.
--
-- This phase is deliberately NON-DESTRUCTIVE:
--   1. copies the two values from app_settings into vault.secrets (idempotent,
--      and it reads the live value so no plaintext ever lands in git);
--   2. adds ONE helper, public._notify_config(), that reads vault FIRST and
--      falls back to app_settings;
--   3. repoints all three notify functions at that helper.
-- The app_settings rows are left in place, so if the vault read fails for any
-- reason the fallback keeps every email working. Nothing can silently break.
--
-- Phase B (20260806160000) drops the fallback and deletes the rows — run it
-- only after verifying with scratchpad/verify-notify-config.sql.
--
-- Why a helper instead of editing three functions every time: _order_notify_post,
-- _contact_notify_post and _quote_notify_post each read the same two settings
-- with the same two lines. Centralising it means the next change to where these
-- live is one line, not three.
--
-- Re-runnable.
-- ============================================================================

-- ---------- 1. seed the vault from the live values --------------------------
do $$
declare v text;
begin
  if not exists (select 1 from vault.secrets where name = 'order_notify_url') then
    select value #>> '{}' into v from public.app_settings where key = 'order_notify_url';
    if v is not null and btrim(v) <> '' then
      perform vault.create_secret(
        v, 'order_notify_url',
        'Edge Function URL used by the order/contact/quote notify triggers');
    end if;
  end if;

  if not exists (select 1 from vault.secrets where name = 'order_notify_secret') then
    select value #>> '{}' into v from public.app_settings where key = 'order_notify_secret';
    if v is not null and btrim(v) <> '' then
      perform vault.create_secret(
        v, 'order_notify_secret',
        'Shared secret sent as X-MM-Auth-Token to the order-notify Edge Function');
    end if;
  end if;
end $$;

-- ---------- 2. the one place that knows where the config lives --------------
create or replace function public._notify_config(out p_url text, out p_secret text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Vault is the source of truth.
  select decrypted_secret into p_url
    from vault.decrypted_secrets where name = 'order_notify_url';
  select decrypted_secret into p_secret
    from vault.decrypted_secrets where name = 'order_notify_secret';

  -- PHASE A ONLY: fall back to app_settings so a vault problem can't silently
  -- stop every notification. Phase B removes this and the rows behind it.
  if p_url is null or btrim(p_url) = '' then
    select value #>> '{}' into p_url
      from public.app_settings where key = 'order_notify_url';
  end if;
  if p_secret is null or btrim(p_secret) = '' then
    select value #>> '{}' into p_secret
      from public.app_settings where key = 'order_notify_secret';
  end if;
exception when others then
  -- Never let config lookup abort a caller; they all treat empty as "skip".
  raise warning 'notify-config lookup failed: % (sqlstate %)', sqlerrm, sqlstate;
  p_url := null;
  p_secret := null;
end $$;

revoke all on function public._notify_config() from public, anon, authenticated;

-- ---------- 3. repoint the three notify functions ---------------------------
-- Each is byte-identical to its live definition except the two app_settings
-- SELECTs, which become one call to the helper.

create or replace function public._order_notify_post(
  p_kind  text,
  p_to    text,
  p_order public.orders
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
  v_items  jsonb;
begin
  begin
    if p_to is null or btrim(p_to) = '' then
      return;
    end if;

    select p_url, p_secret into v_url, v_secret from public._notify_config();

    if v_url is null or v_url = '' then
      return;  -- not configured yet → skip silently
    end if;

    if v_url !~* '^https?://' then
      raise warning 'order-notify: order_notify_url not http(s) — skipping (%)', v_url;
      return;
    end if;

    select coalesce(
             jsonb_agg(jsonb_build_object(
               'item_name', i.item_name,
               'qty', i.qty,
               'unit_price_cents', i.unit_price_cents,
               'plan_type', i.plan_type,
               'meal_plan_id', i.meal_plan_id,
               'plan_instance_id', i.plan_instance_id)
               order by i.plan_instance_id nulls last,
                        (i.meal_plan_id is null),
                        i.created_at),
             '[]'::jsonb)
      into v_items
      from public.order_items i
     where i.order_id = p_order.id;

    perform net.http_post(
      url := v_url,
      timeout_milliseconds := 10000,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-MM-Auth-Token', coalesce(v_secret, '')
      ),
      body := jsonb_build_object(
        'kind', p_kind,
        'to', p_to,
        'order', jsonb_build_object(
          'orderRef', p_order.order_ref,
          'status', p_order.status,
          'orderType', p_order.order_type,
          'subtotalCents', p_order.subtotal_cents,
          'deliveryFeeCents', p_order.delivery_fee_cents,
          'totalCents', p_order.total_cents,
          'paymentProofUrl', p_order.payment_proof_url,
          'createdAt', p_order.created_at
        ),
        'customer', jsonb_build_object(
          'firstName', p_order.customer_first_name,
          'lastName', p_order.customer_last_name,
          'email', p_order.customer_email,
          'phone', p_order.customer_phone,
          'deliveryAddress', p_order.delivery_address,
          'deliveryDate', p_order.delivery_date,
          'deliveryTime', p_order.delivery_time,
          'specialRequests', p_order.special_requests
        ),
        'items', v_items
      )
    );
  exception
    when others then
      raise warning 'order-notify swallowed: % (sqlstate %, kind %, to %)',
        sqlerrm, sqlstate, p_kind, p_to;
      return;
  end;
end;
$$;

create or replace function public._contact_notify_post(p_contact public.contact_submissions)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to     text;
  v_url    text;
  v_secret text;
  v_recent int;
begin
  begin
    -- Throttle: skip the email (not the insert) when contact volume spikes.
    select count(*) into v_recent
      from public.contact_submissions
     where created_at > now() - interval '1 minute';
    if v_recent > 12 then
      raise warning 'contact-notify: rate cap hit (% in last minute) — skipping email', v_recent;
      return;
    end if;

    select coalesce(
             nullif(btrim(contact_email), ''),
             nullif(btrim(order_notification_email), ''),
             'mommamiacaters@gmail.com')
      into v_to from public.company_profile limit 1;
    if v_to is null or btrim(v_to) = '' then
      return;
    end if;

    select p_url, p_secret into v_url, v_secret from public._notify_config();

    if v_url is null or v_url = '' then
      return;
    end if;
    if v_url !~* '^https?://' then
      raise warning 'contact-notify: order_notify_url not http(s) — skipping (%)', v_url;
      return;
    end if;

    perform net.http_post(
      url := v_url,
      timeout_milliseconds := 10000,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-MM-Auth-Token', coalesce(v_secret, '')
      ),
      body := jsonb_build_object(
        'kind', 'contact_message',
        'to', v_to,
        'replyTo', p_contact.email,
        'contact', jsonb_build_object(
          'firstName', p_contact.first_name,
          'lastName', p_contact.last_name,
          'email', p_contact.email,
          'topic', p_contact.topic,
          'message', p_contact.message,
          'createdAt', p_contact.created_at
        )
      )
    );
  exception
    when others then
      raise warning 'contact-notify swallowed: % (sqlstate %)', sqlerrm, sqlstate;
      return;
  end;
end;
$$;

create or replace function public._quote_notify_post(p_quote public.quote_requests)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to     text;
  v_url    text;
  v_secret text;
  v_recent int;
begin
  begin
    select count(*) into v_recent
      from public.quote_requests
     where created_at > now() - interval '1 minute';
    if v_recent > 12 then
      raise warning 'quote-notify: rate cap hit (% in last minute) — skipping email', v_recent;
      return;
    end if;

    select coalesce(nullif(btrim(order_notification_email), ''), 'mommamiacaters@gmail.com')
      into v_to from public.company_profile limit 1;
    if v_to is null or btrim(v_to) = '' then
      return;
    end if;

    select p_url, p_secret into v_url, v_secret from public._notify_config();

    if v_url is null or v_url = '' then
      return;
    end if;
    if v_url !~* '^https?://' then
      raise warning 'quote-notify: order_notify_url not http(s) — skipping (%)', v_url;
      return;
    end if;

    perform net.http_post(
      url := v_url,
      timeout_milliseconds := 10000,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-MM-Auth-Token', coalesce(v_secret, '')
      ),
      body := jsonb_build_object(
        'kind', 'quote_lead',
        'to', v_to,
        'replyTo', p_quote.email,
        'quote', jsonb_build_object(
          'name', p_quote.name,
          'email', p_quote.email,
          'eventType', p_quote.event_type,
          'pax', p_quote.pax,
          'eventDate', p_quote.event_date,
          'orderRequest', p_quote.order_request,
          'leadScore', p_quote.lead_score,
          'leadLevel', p_quote.lead_level,
          'leadPriority', p_quote.lead_priority,
          'intents', p_quote.intents,
          'createdAt', p_quote.created_at
        )
      )
    );
  exception
    when others then
      raise warning 'quote-notify swallowed: % (sqlstate %)', sqlerrm, sqlstate;
      return;
  end;
end;
$$;
