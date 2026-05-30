-- ============================================================================
-- Customer-facing order emails (Grab parity) + DRY the notify plumbing
-- ----------------------------------------------------------------------------
-- Three emails now flow through the ONE order-notify Edge Function, selected by
-- a `kind` field in the payload:
--   • store_alert            → company inbox      (on finalize)
--   • customer_confirmation  → buyer "we got it!" (on finalize)
--   • customer_receipt       → buyer receipt      (on status → delivered)
--
-- The POST body was duplicated; this extracts a single helper
-- `_order_notify_post(kind, to, order_row)` so all three call sites build the
-- identical shape in one place. Fire-and-forget via pg_net — a mail failure
-- never blocks the order or the admin's status update.
-- ============================================================================

-- ---------- shared helper: build payload + POST to the Edge Function --------
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
  -- Nothing to do without a destination or a recipient.
  if p_to is null or btrim(p_to) = '' then
    return;
  end if;

  select value #>> '{}' into v_url    from public.app_settings where key = 'order_notify_url';
  select value #>> '{}' into v_secret from public.app_settings where key = 'order_notify_secret';

  if v_url is null or v_url = '' then
    return;  -- not configured yet → skip silently
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
end;
$$;

-- ---------- finalize: store alert + customer confirmation -------------------
create or replace function public.notify_order_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store_to text;
begin
  select order_notification_email into v_store_to from public.company_profile limit 1;

  perform public._order_notify_post('store_alert',           v_store_to,          new);
  perform public._order_notify_post('customer_confirmation', new.customer_email,  new);

  return new;
end;
$$;
-- (trigger trg_notify_order_created — finalize transition total 0→>0 — unchanged.)

-- ---------- delivery: customer receipt --------------------------------------
create or replace function public.notify_order_delivered()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public._order_notify_post('customer_receipt', new.customer_email, new);
  return new;
end;
$$;

-- Fires when an admin flips status to 'delivered'. `is distinct from` makes it
-- idempotent against re-saves and safe when old.status is null.
drop trigger if exists trg_notify_order_delivered on public.orders;
create trigger trg_notify_order_delivered
  after update on public.orders
  for each row
  when (new.status = 'delivered' and old.status is distinct from 'delivered')
  execute function public.notify_order_delivered();
