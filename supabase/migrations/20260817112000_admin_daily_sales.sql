-- ============================================================================
-- admin_daily_sales — per-day rows for the console's sales chart.
--
-- Manila days, last 30. Cancelled orders are excluded from the peso figure but
-- still counted as orders, matching admin_order_stats. security_invoker: the
-- orders RLS decides what each caller may aggregate; anon has no grant.
-- The client fills in the zero days — a view can't emit rows for days with no
-- orders without a generate_series join that would outlive its usefulness.
-- Re-runnable.
-- ============================================================================

create or replace view public.admin_daily_sales
with (security_invoker = true) as
select
  ((created_at at time zone 'Asia/Manila')::date)::text as day,
  count(*)::int as orders,
  coalesce(sum(total_cents) filter (where status <> 'cancelled'), 0)::bigint as sales_cents
from public.orders
where created_at >= (date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila')
                    - interval '29 days'
group by 1
order by 1;

grant select on public.admin_daily_sales to authenticated;
