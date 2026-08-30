-- ============================================================================
-- Sandwich and Pasta: two more plan slots.
--
-- Same shape as the rice_bowl slot before them (20260823040000): a count
-- column on meal_plans, the sub_categories slot allow-list widened, and the
-- hand-enumerated price-range view taught the new slots. create_order reads
-- none of the *_count columns — it prices the lines it is sent — so this is a
-- schema and frontend change only.
--
-- No sub-category is assigned to the new slots here: which dish groups count
-- as "sandwich" or "pasta" is the admin's call, made in the Menu Manager.
-- Re-runnable.
-- ============================================================================

alter table public.meal_plans
  add column if not exists sandwich_count int not null default 0,
  add column if not exists pasta_count    int not null default 0;

alter table public.meal_plans drop constraint if exists meal_plans_sandwich_count_check;
alter table public.meal_plans
  add constraint meal_plans_sandwich_count_check
  check (sandwich_count >= 0 and sandwich_count <= 9);

alter table public.meal_plans drop constraint if exists meal_plans_pasta_count_check;
alter table public.meal_plans
  add constraint meal_plans_pasta_count_check
  check (pasta_count >= 0 and pasta_count <= 9);

alter table public.sub_categories drop constraint if exists sub_categories_slot_check;
alter table public.sub_categories
  add constraint sub_categories_slot_check
  check (slot is null or slot = any (array['main', 'side', 'dessert', 'rice', 'rice_bowl', 'sandwich', 'pasta']));

-- The price-range view enumerates the slots by hand; an unlisted slot would
-- price a range plan's new course at zero.
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
                ('rice_bowl'::text, p.rice_bowl_count),
                ('sandwich'::text, p.sandwich_count),
                ('pasta'::text, p.pasta_count)
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
