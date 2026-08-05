-- ============================================================================
-- Seed the five Check-a-Lunch plans, the dish sub-categories, and re-file every
-- existing Check-a-Lunch dish against the printed menu.
--
-- Context: the 26 main/side/starch dishes were hidden in the admin console on
-- 2026-08-05 while the menu was restructured, which left the storefront builder
-- with nothing to offer. They are components of a plan now, not standalone
-- purchases, so they go back on sale here with their new grouping.
--
-- Idempotent: every insert is ON CONFLICT-guarded and every update is keyed by
-- name, so re-running changes nothing.
-- ============================================================================

-- ---------- sub-categories ---------------------------------------------------
-- The five from the printed menu, plus rice (the plan's included starch, and the
-- thing the Garlic/Yangchow upgrades attach to). The rest carry over the
-- item_type values already in use elsewhere so Café/Party Trays keep grouping;
-- slot is NULL for those, which keeps them out of the lunch-box builder.
insert into public.sub_categories (slug, name, slot, sort_order) values
  ('pork',       'Pork',       'main',    1),
  ('chicken',    'Chicken',    'main',    2),
  ('seafood',    'Seafood',    'main',    3),
  ('side-dish',  'Side Dish',  'side',    4),
  ('dessert',    'Dessert',    'dessert', 5),
  ('rice',       'Rice',       'rice',    6),
  ('beef',       'Beef',        null,    20),
  ('pasta',      'Pasta',       null,    21),
  ('sandwich',   'Sandwich',    null,    22),
  ('salad',      'Salad',       null,    23),
  ('vegetables', 'Vegetables',  null,    24),
  ('drink',      'Drink',       null,    25),
  ('rice-bowls', 'Rice Bowls',  null,    26)
on conflict (slug) do update
  set name = excluded.name, slot = excluded.slot, sort_order = excluded.sort_order;

-- ---------- the five plans ---------------------------------------------------
-- Prices and composition taken from the printed Check-a-Lunch menu. Rice is
-- included in every plan; the Garlic/Yangchow upgrades are priced separately as
-- Add-ons and are not part of the plan row.
insert into public.meal_plans
  (name, description, price_cents, main_count, side_count, dessert_count, rice_count, sort_order)
values
  ('Standard Bento',        '1 Main Dish, 1 Side Dish, 1 Rice',                 21000, 1, 1, 0, 1, 1),
  ('Double Main',           '2 Main Dishes, 1 Rice',                            23500, 2, 0, 0, 1, 2),
  ('Bento with Dessert',    '1 Main Dish, 1 Side Dish, 1 Rice, 1 Dessert',      25000, 1, 1, 1, 1, 3),
  ('Double Side',           '1 Main Dish, 2 Side Dishes, 1 Rice, 1 Dessert',    30000, 1, 2, 1, 1, 4),
  ('Full Feast',            '2 Main Dishes, 1 Side Dish, 1 Rice, 1 Dessert',    35000, 2, 1, 1, 1, 5)
on conflict do nothing;

-- ---------- align existing dish names with the printed menu ------------------
-- Same dish, fuller name on the poster. Renaming rather than inserting avoids
-- creating a duplicate alongside the row that already carries a photo.
update public.menu_items set name = 'Lumpia Shanghai'                    where name = 'Pork Lumpia'       and category_id = 1;
update public.menu_items set name = 'Pork Cutlet w/ Honey Mustard Dip'   where name = 'Pork Cutlet'       and category_id = 1;
update public.menu_items set name = 'Battered Chicken in Espresso Sauce' where name = 'Battered Chicken'  and category_id = 1;
update public.menu_items set name = 'Chicken Penne Alfredo'              where name = 'Chicken Alfredo'   and category_id = 1;

-- ---------- file every Check-a-Lunch dish under a sub-category ---------------
-- Explicit name lists rather than pattern matching: "Chicken Macaroni Salad" is
-- a DESSERT on this menu and "Chicken Penne Alfredo" is a SIDE, so a LIKE
-- '%Chicken%' rule would put both in the wrong place.
update public.menu_items m
   set sub_category_id = s.id
  from public.sub_categories s
 where m.category_id = 1
   and s.slug = 'pork'
   and m.name in (
     'Swedish Meatballs', 'Grilled Pork in Peppercorn Gravy', 'Lumpia Shanghai',
     'Pork Steak', 'Pork Caldereta', 'Sweet & Sour Pork', 'Pork Embutido',
     'Pork Cutlet w/ Honey Mustard Dip', 'Pork Tapa', 'Grilled Liempo w/ Native Sauce',
     'Salisbury Steak in Mushroom Gravy', 'Pork Sisig', 'Salt & Pepper Crispy Pork',
     'Pork Adobo', 'Sweet & Sour Meatballs');

update public.menu_items m
   set sub_category_id = s.id
  from public.sub_categories s
 where m.category_id = 1
   and s.slug = 'chicken'
   and m.name in (
     'Chicken Adobo', 'Canotonese Lemon Chicken', 'Battered Chicken in Espresso Sauce',
     'Korean Fried Chicken', 'Chicken Curry', 'Buffalo Chicken', 'Chicken Teriyaki',
     'Chicken Salpicao', 'Fried Chicken w/ Native Sauce', 'Chicken Cordon Bleu',
     'Chicken Fillet in Creamy Rosemary Bechamel', 'Braised Chicken in Dark Soy Mushroom',
     'Lemon Garlic Chicken Tenders', 'Spicy Chicken Sisig', 'Garlic Parmesan Chicken',
     'Chicken Fricasse');

update public.menu_items m
   set sub_category_id = s.id
  from public.sub_categories s
 where m.category_id = 1
   and s.slug = 'seafood'
   and m.name in (
     'Sweet & Sour Fish', 'Salt & Pepper Fish', 'Crispy Fish Fillet in Garlic Aioli',
     'Creamy Pesto Bechamel Fish', 'Lemon Butter Fish Fillet', 'Crispy Calamares',
     'Herb Crusted Fish Fillet', 'Battered Squid', 'Fish Fillet Escabeche');

update public.menu_items m
   set sub_category_id = s.id
  from public.sub_categories s
 where m.category_id = 1
   and s.slug = 'dessert'
   and m.name in (
     'Brownie Bar', 'Seasonal Fresh Fruits', 'Moist Banana Cake', 'Fruit Salad',
     'Mango Panacotta', 'Chicken Macaroni Salad', 'Coffee Jelly', 'Maja Maiz',
     'Maja Pandan', 'Maja Ube');

update public.menu_items m
   set sub_category_id = s.id
  from public.sub_categories s
 where m.category_id = 1
   and s.slug = 'rice'
   and m.name in ('Plain Rice', 'Garlic Rice', 'Yangchow Rice');

-- Everything else still in Check-a-Lunch that isn't a plan row is a side dish.
update public.menu_items m
   set sub_category_id = s.id
  from public.sub_categories s
 where m.category_id = 1
   and s.slug = 'side-dish'
   and m.sub_category_id is null
   and coalesce(m.item_type, '') <> 'packed meal';

-- ---------- carry the other categories' groupings across ---------------------
-- item_type stays as the legacy column but is no longer the source of truth;
-- match on it once so nothing outside Check-a-Lunch loses its grouping.
update public.menu_items m
   set sub_category_id = s.id
  from public.sub_categories s
 where m.sub_category_id is null
   and m.item_type is not null
   and s.slug = case lower(btrim(m.item_type))
                  when 'vegetable'  then 'vegetables'   -- fold the typo split
                  when 'vegetables' then 'vegetables'
                  when 'rice bowls' then 'rice-bowls'
                  when 'side'       then 'side-dish'
                  else lower(btrim(m.item_type))
                end;

-- ---------- put the plan components back on sale ----------------------------
-- They were hidden when the menu was restructured. They are selectable parts of
-- a plan now, so the builder needs them visible again.
update public.menu_items
   set is_available = true
 where category_id = 1
   and coalesce(item_type, '') <> 'packed meal';

-- ---------- retire the plan rows that lived in the catalog -------------------
-- The five "packed meal" rows are superseded by public.meal_plans, which owns
-- price AND composition. Hidden rather than deleted so historical order_items
-- keep their menu_item_id reference.
update public.menu_items
   set is_available = false
 where category_id = 1
   and item_type = 'packed meal';
