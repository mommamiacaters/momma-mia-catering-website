-- ============================================================================
-- Rice Bowl: a plan slot of its own
-- ----------------------------------------------------------------------------
-- The Rice Bowls plan was described as "1 main dish + 1 rice", which made the
-- customer build a rice bowl out of two unrelated pickers and let them pair any
-- main with any rice. A rice bowl is one dish. This adds a fifth slot so the
-- plan can ask for exactly that.
--
-- Nothing in create_order reads the *_count columns — it prices the lines it is
-- sent and enforces the box and per-dish minimums — so a new slot is a schema
-- and frontend change only, with no effect on how an order is validated or
-- charged.
--
-- The 17 dishes already filed under the `rice-bowls` sub-category become the
-- dishes this slot offers; they were previously slot-less, so they appeared in
-- no picker at all.
--
-- Fully re-runnable.
-- ============================================================================

-- 1. The new count column, matching the bounds of the other four.
alter table public.meal_plans
  add column if not exists rice_bowl_count int not null default 0;

alter table public.meal_plans
  drop constraint if exists meal_plans_rice_bowl_count_check;
alter table public.meal_plans
  add constraint meal_plans_rice_bowl_count_check
  check (rice_bowl_count >= 0 and rice_bowl_count <= 9);

-- 2. Let a sub-category declare itself a rice bowl.
alter table public.sub_categories
  drop constraint if exists sub_categories_slot_check;
alter table public.sub_categories
  add constraint sub_categories_slot_check
  check (slot is null or slot = any (array['main', 'side', 'dessert', 'rice', 'rice_bowl']));

-- 3. Singular, because a customer picks one. The slug stays put: it is
--    referenced by menu_items and renaming it would orphan them.
update public.sub_categories
set slot = 'rice_bowl',
    name = 'Rice Bowl'
where slug = 'rice-bowls';

-- 4. The plan now asks for the one dish it is named after.
update public.meal_plans
set name = 'Rice Bowl',
    main_count = 0,
    rice_count = 0,
    rice_bowl_count = 1
where name in ('Rice Bowls', 'Rice Bowl')
  and category_id = (select id from public.categories where slug = 'check-a-lunch');

-- 5. The price-range view enumerates the slots by hand, so it has to learn the
--    new one. The Rice Bowl plan is fixed-price today and would not notice, but
--    the moment anyone switches it to range pricing an unlisted slot would
--    price the whole plan at zero.
create or replace view public.meal_plan_price_ranges as
 WITH plan_slots AS (
         SELECT p.id AS meal_plan_id,
            p.pricing_mode,
            p.price_cents,
            p.category_id,
            c.slot,
            c.n
           FROM meal_plans p
             CROSS JOIN LATERAL ( VALUES
                ('main'::text, p.main_count),
                ('side'::text, p.side_count),
                ('dessert'::text, p.dessert_count),
                ('rice'::text, p.rice_count),
                ('rice_bowl'::text, p.rice_bowl_count)
             ) c(slot, n)
        )
 SELECT ps.meal_plan_id,
    ps.pricing_mode,
    ps.price_cents,
    COALESCE(sum(COALESCE(st.lo, 0) * ps.n), 0::bigint)::integer AS min_cents,
    COALESCE(sum(COALESCE(st.hi, 0) * ps.n), 0::bigint)::integer AS max_cents
   FROM plan_slots ps
     LEFT JOIN LATERAL ( SELECT min(COALESCE(m.price_cents, 0)) AS lo,
            max(COALESCE(m.price_cents, 0)) AS hi
           FROM menu_items m
             JOIN sub_categories s ON s.id = m.sub_category_id
          WHERE m.is_available AND s.slot = ps.slot AND m.category_id = ps.category_id) st ON true
  GROUP BY ps.meal_plan_id, ps.pricing_mode, ps.price_cents;

-- 6. `description` is a denormalised copy of the composition that the storefront
--    plan card renders verbatim. The admin form regenerates it on save, but a
--    direct UPDATE like the one above does not, so it has to be restated or the
--    card keeps advertising "1 Main dish, 1 Rice" for a plan that no longer
--    includes either.
update public.meal_plans
set description = '1 Rice Bowl'
where name = 'Rice Bowl'
  and category_id = (select id from public.categories where slug = 'check-a-lunch');
