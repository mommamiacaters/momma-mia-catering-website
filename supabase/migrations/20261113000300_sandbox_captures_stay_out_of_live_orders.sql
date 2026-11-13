-- ============================================================================
-- Sandbox PayPal captures must never look like real, paid orders.
-- ----------------------------------------------------------------------------
-- Found 2026-11-13 while verifying checkout: the key-locked -sandbox Edge
-- Functions write to the LIVE orders table, and a sandbox capture went through
-- the same record_paypal_capture path as real money — so a play-money order
-- showed as PAID in the admin console, counted in sales stats, and fired the
-- real "new order" emails to the store and the customer. Someone could fulfil
-- an order nobody paid for.
--
-- Now the sandbox capture passes p_sandbox => true: the order is recorded as
-- paid (so the flow is still verifiable) but archived on the spot, labelled
-- [SANDBOX] in special_requests, and notified_at stays NULL so no email fires.
-- Live captures and the webhook omit the parameter (default false): unchanged.
--
-- The old 5-argument signature is replaced (callers use named arguments, so
-- both old and new Edge Function builds resolve to this function).
-- ============================================================================

drop function if exists public.record_paypal_capture(text, text, integer, text, text);

create or replace function public.record_paypal_capture(
  p_paypal_order_id text,
  p_capture_id      text,
  p_amount_cents    integer,
  p_currency        text,
  p_status          text,
  p_sandbox         boolean default false
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

  if p_sandbox then
    -- Play money (key-locked -sandbox functions, local dev only). Record the
    -- result so the flow can be verified, but keep it out of the live console
    -- and the stats (archived), label it, and leave notified_at NULL so the
    -- store/customer emails never fire for a payment that never happened.
    update public.orders
       set payment_status = 'paid',
           paid_at = now(),
           paypal_capture_id = p_capture_id,
           payment_amount_cents = p_amount_cents,
           archived_at = coalesce(archived_at, now()),
           special_requests = '[SANDBOX - not a real payment] ' || coalesce(special_requests, '')
     where id = v_order.id;
    return jsonb_build_object(
      'order_ref', v_order.order_ref, 'status', 'paid', 'duplicate', false, 'sandbox', true);
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


revoke execute on function public.record_paypal_capture(text, text, integer, text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.record_paypal_capture(text, text, integer, text, text, boolean)
  to service_role;
