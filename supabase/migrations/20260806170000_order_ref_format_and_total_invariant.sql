-- ============================================================================
-- orders: constrain order_ref, and make total_cents correct by construction
-- ----------------------------------------------------------------------------
-- Two small integrity fixes on the same table (todos 016 and 012).
--
-- 1) ORDER_REF (todo 016). `p_order_ref` is generated client-side and inserted
--    with no format check, so a direct anon RPC call could set it to anything —
--    newlines, HTML, or a value colliding with a real reference. The
--    exploitable consequences are already closed downstream (the email subject
--    is CRLF-stripped and every template interpolation goes through esc()), so
--    what remains is data hygiene: garbage references in the table and on
--    kitchen tickets.
--
--    Both real generators emit `MM-YYYYMMDD-HHMM-xxxx`
--    (validation.ts generateSecureOrderRef, mobile lib/orders.ts makeOrderRef).
--    Verified against live data before choosing the bounds: all 8 existing
--    orders are 13..24 chars and 0 fail `^[A-Za-z0-9-]{6,40}$` — including the
--    older `MM-TEST-…` and `MM-PW-…` shapes. So the CHECK (todo's stronger
--    solution B, which covers every write path) is safe to add, and the RPC
--    also raises early for a readable message instead of a raw 23514.
--
-- 2) TOTAL (todo 012). create_order sets `total_cents = v_subtotal` and ignores
--    delivery_fee_cents entirely. That is harmless today — the fee is 0 on
--    every row and nothing writes it — but the first time anyone sets a fee the
--    receipt would render Subtotal + Delivery fee + a Total that excludes the
--    fee, which is exactly the "the math is wrong" artifact todo 012 exists to
--    prevent.
--
--    Fixed as an INVARIANT rather than a one-site patch: a BEFORE trigger
--    computes total_cents = subtotal_cents + delivery_fee_cents on every insert
--    and update, so it holds no matter who writes the fee (create_order, a
--    future admin edit, a manual UPDATE). create_order's own assignment becomes
--    a harmless no-op — it already writes subtotal + 0.
--    Verified: 0 of 8 existing rows violate the invariant, so this changes no
--    historical data.
--
-- Re-runnable.
-- ============================================================================

-- ---------- 1. order_ref format ---------------------------------------------
alter table public.orders
  drop constraint if exists orders_order_ref_format;

alter table public.orders
  add constraint orders_order_ref_format
  check (order_ref ~ '^[A-Za-z0-9-]{6,40}$');

comment on constraint orders_order_ref_format on public.orders is
  'order_ref is client-supplied; keep it to a safe charset so it cannot carry control characters into emails or kitchen tickets.';

-- ---------- 2. total = subtotal + delivery fee, always ----------------------
create or replace function public._orders_sync_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.total_cents := coalesce(new.subtotal_cents, 0) + coalesce(new.delivery_fee_cents, 0);
  return new;
end;
$$;

drop trigger if exists trg_orders_sync_total on public.orders;
create trigger trg_orders_sync_total
  before insert or update of subtotal_cents, delivery_fee_cents, total_cents
  on public.orders
  for each row execute function public._orders_sync_total();

comment on function public._orders_sync_total() is
  'Keeps orders.total_cents = subtotal_cents + delivery_fee_cents. create_order ignored the fee, so a Total that excluded it would have been rendered on the receipt the first time one was set.';
