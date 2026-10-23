-- ============================================================================
-- Price-range quotes draw from the same dishes the picker offers.
--
-- meal_plan_price_ranges filtered dishes by menu_items.category_id (the HOME
-- service), while meal_plan_options joins through menu_item_categories. A dish
-- sold in a service only by membership (e.g. drinks in box services) was in
-- the picker but missing from the quoted range. No live plan is 'range' today,
-- so nothing customer-facing changes yet. Same columns. Re-runnable.
-- ============================================================================

create or replace view public.meal_plan_price_ranges as
with plan_slots as (
  select p.id as meal_plan_id,
         p.pricing_mode,
         p.price_cents,
         p.category_id,
         c.slot,
         c.n
    from public.meal_plans p
    cross join lateral (values
      ('main'::text, p.main_count),
      ('side'::text, p.side_count),
      ('dessert'::text, p.dessert_count),
      ('rice'::text, p.rice_count),
      ('rice_bowl'::text, p.rice_bowl_count),
      ('sandwich'::text, p.sandwich_count),
      ('pasta'::text, p.pasta_count),
      ('drink'::text, p.drink_count)
    ) c(slot, n)
)
select ps.meal_plan_id,
       ps.pricing_mode,
       ps.price_cents,
       coalesce(sum(coalesce(st.lo, 0) * ps.n), 0::bigint)::integer as min_cents,
       coalesce(sum(coalesce(st.hi, 0) * ps.n), 0::bigint)::integer as max_cents
  from plan_slots ps
  left join lateral (
    -- The dish price, because that is what create_order bills a range line.
    select min(coalesce(m.price_cents, 0)) as lo,
           max(coalesce(m.price_cents, 0)) as hi
      from public.menu_item_categories mic
      join public.menu_items m     on m.id = mic.menu_item_id and m.is_available
      join public.sub_categories s on s.id = m.sub_category_id
     where mic.category_id = ps.category_id
       and s.slot = ps.slot
  ) st on true
 group by ps.meal_plan_id, ps.pricing_mode, ps.price_cents;

grant select on public.meal_plan_price_ranges to anon, authenticated;
