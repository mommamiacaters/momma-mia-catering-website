-- ============================================================================
-- Order archiving + admin analytics.
--
-- archived_at: archiving is tidying, not voiding — an archived order stays a
-- sale. The console's default view filters `archived_at is null`; restore just
-- nulls it again. Admin writes ride the existing orders UPDATE policy.
--
-- admin_order_stats: one-row aggregate for the console's analytics cards.
-- security_invoker means the base table's RLS decides what each caller may
-- aggregate — an admin sees the store, a client would only ever see their own
-- orders, anon has no grant at all. "Today" is Manila's day, not UTC's.
-- Re-runnable.
-- ============================================================================

alter table public.orders
  add column if not exists archived_at timestamptz;

comment on column public.orders.archived_at is
  'When the admin tucked this order away. NULL = active. Archived orders still count as sales.';

create or replace view public.admin_order_stats
with (security_invoker = true) as
select
  count(*)::int as total_orders,
  coalesce(sum(total_cents) filter (where status <> 'cancelled'), 0)::bigint as total_sales_cents,
  count(*) filter (where status = 'pending' and archived_at is null)::int as pending_orders,
  count(*) filter (
    where created_at >= (date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')
  )::int as today_orders,
  count(*) filter (where archived_at is not null)::int as archived_orders
from public.orders;

grant select on public.admin_order_stats to authenticated;
