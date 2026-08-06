-- ============================================================================
-- Order-notify payload: carry the plan grouping ids
-- ----------------------------------------------------------------------------
-- The email template needs to tell a priced PLAN line apart from the dishes
-- that fill it, so it can nest the dishes under their plan and drop the
-- meaningless ₱0 price column on them.
--
-- It can't infer that from what we sent before: `unit_price_cents = 0` means
-- "component" under `fixed` pricing but means the PLAN line under `range`
-- pricing, and matching item_name against plan_type is name-keyed guesswork.
-- So send the ids and let the template group by identity.
--
--   meal_plan_id     — non-null only on the plan line
--   plan_instance_id — the box; shared by a plan line and its dishes
--
-- Rows are ordered box-by-box, plan line first, so the email reads top-down
-- without the template having to re-sort.
--
-- Only the jsonb_agg changed; the BEGIN/EXCEPTION guard (todo 007) and the
-- URL sanity check are preserved verbatim. Re-runnable.
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
      -- Last-resort guard. Surfaces in pg logs as a WARNING so silent breakage
      -- doesn't hide forever; correlate with net._http_response when triaging.
      raise warning 'order-notify swallowed: % (sqlstate %, kind %, to %)',
        sqlerrm, sqlstate, p_kind, p_to;
      return;
  end;
end;
$$;
