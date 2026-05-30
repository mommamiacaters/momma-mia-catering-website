-- ============================================================================
-- Order-notify trigger: make it truly fire-and-forget (P1 hardening, todo 007)
-- ----------------------------------------------------------------------------
-- The original `_order_notify_post` (20260525160000) wraps a `net.http_post`,
-- which is async at the network level but SYNCHRONOUS in its argument
-- validation: a malformed admin-edited `app_settings.order_notify_url`, or
-- `pg_net` being unavailable, would raise inside the trigger and roll back
-- `create_order`'s finalize UPDATE — taking down checkout for every customer.
--
-- This patch wraps the entire body in BEGIN ... EXCEPTION WHEN OTHERS ...
-- so any failure becomes a WARNING in pg logs and a no-op for the trigger.
-- A notification must NEVER abort an order.
--
-- Re-runnable: `create or replace function` is idempotent; this migration is
-- safe to re-apply.
-- ============================================================================

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
  -- Outer guard: anything below this point — table lookups, URL parsing inside
  -- net.http_post, pg_net missing, jsonb_agg on a weird row, etc. — degrades
  -- to a logged warning rather than propagating and aborting the order.
  begin
    if p_to is null or btrim(p_to) = '' then
      return;
    end if;

    select value #>> '{}' into v_url    from public.app_settings where key = 'order_notify_url';
    select value #>> '{}' into v_secret from public.app_settings where key = 'order_notify_secret';

    if v_url is null or v_url = '' then
      return;  -- not configured yet → skip silently
    end if;

    -- Cheap URL sanity. net.http_post would still raise on garbage like
    -- "htttp://…"; rejecting it here gives a clearer warning and short-circuits
    -- the exception path on a known-bad config.
    if v_url !~* '^https?://' then
      raise warning 'order-notify: order_notify_url not http(s) — skipping (%)', v_url;
      return;
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
  exception
    when others then
      -- Last-resort guard. Surfaces in pg logs as a WARNING so silent breakage
      -- doesn't hide forever; correlate with net._http_response when triaging.
      raise warning 'order-notify swallowed: % (sqlstate %, kind %, to %)',
        sqlerrm, sqlstate, p_kind, p_to;
      return;
  end;
end;
$$;
