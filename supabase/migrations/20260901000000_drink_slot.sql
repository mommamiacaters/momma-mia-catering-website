-- ============================================================================
-- Drinks become a plan course of their own.
--
-- A meal plan can now ask for N drinks the way it asks for a main or a side,
-- and the dishes that used to be the "Drink" sub-category go back to being
-- drinks instead of side dishes.
--
-- The archived Drink sub-category (id 12, emptied by 20260831000200) is
-- REUSED rather than replaced: its slug is already `drink`, which is unique,
-- and reviving it keeps the reversal snapshot in
-- sub_category_remap_20260831 pointing at the right row.
--
-- Adding a slot means every place that enumerates them by hand has to learn it
-- — the sub_categories allow-list, a count column on meal_plans, and the
-- price-range view below. The frontend registry ships alongside.
-- Re-runnable.
-- ============================================================================

-- ---------- 1. the slot is a legal value ------------------------------------
alter table public.sub_categories drop constraint if exists sub_categories_slot_check;
alter table public.sub_categories
  add constraint sub_categories_slot_check
  check (slot is null or slot = any (array[
    'main', 'side', 'dessert', 'rice', 'rice_bowl', 'sandwich', 'pasta', 'drink'
  ]));

-- ---------- 2. revive the Drink sub-category as a real course ---------------
update public.sub_categories
   set name = 'Drinks',
       slot = 'drink',
       is_active = true,
       sort_order = 8
 where slug = 'drink';

-- ---------- 3. plans can ask for drinks -------------------------------------
alter table public.meal_plans
  add column if not exists drink_count int not null default 0;

alter table public.meal_plans drop constraint if exists meal_plans_drink_count_check;
alter table public.meal_plans
  add constraint meal_plans_drink_count_check
  check (drink_count >= 0 and drink_count <= 9);

-- ---------- 4. the price-range view enumerates slots BY HAND ----------------
-- An unlisted slot prices a range plan's new course at zero.
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
                ('pasta'::text, p.pasta_count),
                ('drink'::text, p.drink_count)
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

-- ---------- 5. the drinks go back to being drinks ---------------------------
-- Identified from the snapshot taken before the merge, not by guessing at
-- names, so exactly the rows that were Drink move back. item_type is kept in
-- step because create_order snapshots it onto order lines.
update public.menu_items m
   set sub_category_id = s.id,
       item_type       = s.slot
  from public.sub_categories s,
       public.sub_category_remap_20260831 b
 where s.slug = 'drink'
   and b.menu_item_id = m.id
   and b.old_name = 'Drink';

-- ---------- 6. an add-on drink is also sold under Drinks --------------------
-- Membership only; the dish keeps its home service, so create_order's per-dish
-- floor is unaffected. Price is left NULL so it inherits the dish price.
insert into public.menu_item_categories (menu_item_id, category_id)
select m.id, d.id
  from public.menu_items m
  join public.sub_categories s on s.id = m.sub_category_id and s.slug = 'drink'
  join public.menu_item_categories mic on mic.menu_item_id = m.id
  join public.categories a on a.id = mic.category_id and a.slug = 'add-on'
  cross join lateral (select id from public.categories where slug = 'drinks') d
on conflict (menu_item_id, category_id) do nothing;
