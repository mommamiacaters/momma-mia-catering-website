-- ============================================================================
-- Archived orders leave the statistics.
--
-- The original views counted archived orders as sales ("archiving is tidying,
-- not voiding"). In practice that meant an empty Active tab sitting under
-- cards claiming twelve orders and ninety thousand pesos, which reads as a
-- bug every time. Archiving now removes an order from every figure and from
-- the chart; the only place it still counts is the Archived tab's own badge.
--
-- security_invoker stays: the orders RLS decides what each caller may
-- aggregate. Re-runnable.
-- ============================================================================

comment on column public.orders.archived_at is
  'When the admin tucked this order away. NULL = active. Archived orders are excluded from the analytics cards and chart.';

create or replace view public.admin_order_stats
with (security_invoker = true) as
select
  count(*) filter (where archived_at is null)::int as total_orders,
  coalesce(
    sum(total_cents) filter (where status <> 'cancelled' and archived_at is null),
    0
  )::bigint as total_sales_cents,
  count(*) filter (where status = 'pending' and archived_at is null)::int as pending_orders,
  count(*) filter (
    where archived_at is null
      and created_at >= (date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')
  )::int as today_orders,
  count(*) filter (where archived_at is not null)::int as archived_orders
from public.orders;

grant select on public.admin_order_stats to authenticated;

create or replace view public.admin_daily_sales
with (security_invoker = true) as
select
  ((created_at at time zone 'Asia/Manila')::date)::text as day,
  count(*)::int as orders,
  coalesce(sum(total_cents) filter (where status <> 'cancelled'), 0)::bigint as sales_cents
from public.orders
where archived_at is null
  and created_at >= (date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')
                    - interval '29 days'
group by 1
order by 1;

grant select on public.admin_daily_sales to authenticated;
