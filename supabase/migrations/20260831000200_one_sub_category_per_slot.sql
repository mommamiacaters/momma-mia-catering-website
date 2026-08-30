-- ============================================================================
-- Sub-categories collapse to one per plan slot.
--
-- The picker groups dishes by SLOT, so three sub-categories that all "count as
-- main" only added noise to the admin's dropdown. Worse, Beef, Pasta,
-- Sandwich, Salad, Vegetables and Drink carried NO slot, and meal_plan_options
-- filters `where s.slot is not null` -- so those 33 dishes were invisible in
-- every picker.
--
-- After this there are exactly seven, matching the seven plan slots:
--   Main, Side, Rice, Rice Bowl, Sandwich, Pasta, Dessert
--
--   Pork + Chicken + Seafood + Beef      -> Main   (64 dishes)
--   Side Dish + Salad + Vegetables + Drink -> Side (41 dishes)
--
-- Merged rows are ARCHIVED (is_active = false), never deleted -- the admin
-- dropdown already filters on is_active -- and every moved dish's previous
-- sub-category is recorded in sub_category_remap_20260831, so this is
-- reversible. Re-runnable.
-- ============================================================================

-- Reversal record, written BEFORE anything moves. CTAS so the id types match
-- menu_items exactly; "if not exists" keeps a second run from overwriting the
-- original snapshot with a post-merge one.
create table if not exists public.sub_category_remap_20260831 as
select m.id             as menu_item_id,
       m.sub_category_id as old_sub_category_id,
       s.name           as old_name,
       now()            as moved_at
  from public.menu_items m
  join public.sub_categories s on s.id = m.sub_category_id
 where m.sub_category_id in (2, 3, 7, 10, 11, 12);

-- ---------- the seven survivors ---------------------------------------------
-- Pork becomes the single Main bucket; Side Dish becomes Side.
update public.sub_categories set name = 'Main', slug = 'main', slot = 'main',      sort_order = 1 where id = 1;
update public.sub_categories set name = 'Side', slug = 'side', slot = 'side',      sort_order = 2 where id = 4;
update public.sub_categories set                               slot = 'rice',      sort_order = 3 where id = 6;
update public.sub_categories set                               slot = 'rice_bowl', sort_order = 4 where id = 13;
-- Sandwich and Pasta finally get the slots added for them in 20260830000100.
update public.sub_categories set                               slot = 'sandwich',  sort_order = 5 where id = 9;
update public.sub_categories set                               slot = 'pasta',     sort_order = 6 where id = 8;
update public.sub_categories set                               slot = 'dessert',   sort_order = 7 where id = 5;

-- ---------- move the dishes --------------------------------------------------
update public.menu_items set sub_category_id = 1 where sub_category_id in (2, 3, 7);   -- Chicken, Seafood, Beef
update public.menu_items set sub_category_id = 4 where sub_category_id in (10, 11, 12); -- Salad, Vegetables, Drink

-- ---------- retire the emptied buckets ---------------------------------------
update public.sub_categories set is_active = false where id in (2, 3, 7, 10, 11, 12);
