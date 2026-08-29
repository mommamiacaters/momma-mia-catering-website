-- ============================================================================
-- PayPal replaces the InstaPay QR.
--
-- The old flow trusted the customer: they scanned a QR in some other app, paid
-- there, screenshotted it, and uploaded the screenshot. The order was created
-- and the kitchen emailed before anyone had verified a single centavo. This
-- moves payment onto PayPal, where the site itself learns whether the money
-- arrived.
--
-- The rule that shapes everything below: THE AMOUNT NEVER COMES FROM THE
-- CLIENT. create_order prices the cart from the catalogue and writes
-- total_cents; the Edge Functions read that column to open the PayPal order and
-- compare against it when the capture comes back. A browser can say what it
-- likes; it cannot say what an order costs.
--
-- Emails are held back too. The order-notify trigger keys on notified_at, so an
-- awaiting_payment order leaves that NULL and record_paypal_capture stamps it
-- when the money actually lands. An abandoned checkout emails nobody.
--
-- Part 1 of 2: enum, columns, and the capture recorder. Part 2 carries
-- create_order v9 (generated from v8 so the pricing body is byte-identical).
-- Re-runnable.
-- ============================================================================

-- ---------- payment_status --------------------------------------------------
-- manual_proof is the honest name for every order that came before this
-- migration: a receipt was uploaded, and an admin decides whether it is real.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type public.payment_status as enum (
      'manual_proof', 'awaiting_payment', 'paid', 'failed', 'refunded'
    );
  end if;
end$$;

alter table public.orders
  add column if not exists payment_status   public.payment_status,
  add column if not exists payment_provider text,
  add column if not exists paypal_order_id  text,
  add column if not exists paypal_capture_id text,
  add column if not exists paid_at          timestamptz,
  add column if not exists payment_amount_cents int;

-- Existing rows predate PayPal: they are all receipt-upload orders.
update public.orders set payment_status = 'manual_proof' where payment_status is null;

alter table public.orders alter column payment_status set default 'manual_proof';
alter table public.orders alter column payment_status set not null;

comment on column public.orders.payment_status is
  'manual_proof = legacy receipt upload, admin verifies. awaiting_payment = PayPal order open, no money yet. paid = captured.';
comment on column public.orders.payment_amount_cents is
  'What PayPal actually captured. Kept beside total_cents so a mismatch is visible rather than inferred.';

-- One PayPal order and one capture may each belong to exactly one order of
-- ours. This is the idempotency backstop: the capture endpoint and the webhook
-- both race to record the same capture, and the loser gets a constraint
-- violation instead of a double-write.
create unique index if not exists uq_orders_paypal_order_id
  on public.orders(paypal_order_id) where paypal_order_id is not null;
create unique index if not exists uq_orders_paypal_capture_id
  on public.orders(paypal_capture_id) where paypal_capture_id is not null;
create index if not exists idx_orders_payment_status on public.orders(payment_status);

-- ---------- attach a PayPal order to one of ours ----------------------------
-- Separate from the capture so the Edge Function stores the id BEFORE the buyer
-- is sent to PayPal. If the browser dies mid-approval, the webhook can still
-- find our order from the PayPal id alone.
create or replace function public.attach_paypal_order(
  p_order_id uuid,
  p_paypal_order_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders
     set paypal_order_id = p_paypal_order_id
   where id = p_order_id
     and payment_status = 'awaiting_payment'
     -- Re-opening PayPal on the same cart replaces a stale, unapproved id.
     and (paypal_order_id is null or paypal_order_id is distinct from p_paypal_order_id);

  if not found then
    -- Either the order is already paid or it never was awaiting payment.
    -- Loud, because the alternative is a customer paying against nothing.
    if not exists (select 1 from public.orders o
                    where o.id = p_order_id and o.payment_status = 'awaiting_payment') then
      raise exception 'Order % is not awaiting payment', p_order_id;
    end if;
  end if;
end;
$$;

revoke all on function public.attach_paypal_order(uuid, text) from public, anon, authenticated;
grant execute on function public.attach_paypal_order(uuid, text) to service_role;

-- ---------- record a capture ------------------------------------------------
-- The single place an order becomes paid. The capture endpoint and the webhook
-- both come through here, so they cannot disagree about what "paid" means.
--
-- The amount check is the point of the whole function: PayPal is told the
-- amount by us, but we verify what came back anyway. A mismatch marks the order
-- failed rather than paid, and emails nobody.
create or replace function public.record_paypal_capture(
  p_paypal_order_id text,
  p_capture_id      text,
  p_amount_cents    int,
  p_currency        text,
  p_status          text
)
returns jsonb
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

  -- Already recorded. Return the same answer rather than stamping notified_at
  -- twice, which would email the kitchen again for one order.
  if v_order.payment_status = 'paid' and v_order.paypal_capture_id = p_capture_id then
    return jsonb_build_object(
      'order_ref', v_order.order_ref, 'status', 'paid', 'duplicate', true);
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

  -- Underpaid, overpaid or paid in the wrong currency: all three mean a human
  -- has to look. Never silently accept a total we did not ask for.
  --
  -- This RETURNS rather than raising, and the difference is not cosmetic: a
  -- RAISE would roll back the very UPDATE that records the failure, so the
  -- order would sit in awaiting_payment with real money captured against it
  -- and nothing on the row to say so. Write the failure, then report it.
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
         -- Releases the order-notify trigger. Only here, and only once.
         notified_at = coalesce(notified_at, now())
   where id = v_order.id;

  return jsonb_build_object(
    'order_ref', v_order.order_ref, 'status', 'paid', 'duplicate', false);
end;
$$;

revoke all on function public.record_paypal_capture(text, text, int, text, text)
  from public, anon, authenticated;
grant execute on function public.record_paypal_capture(text, text, int, text, text)
  to service_role;
