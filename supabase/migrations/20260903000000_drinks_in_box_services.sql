-- ============================================================================
-- Drinks become pickable INSIDE a lunch box, not just as a paid extra.
--
-- A plan slot is only offerable if the dish is sold under the plan's own
-- service: meal_plan_options joins menu_item_categories to the plan's
-- category. The drinks were sold under add-on and drinks only -- both
-- UNIVERSAL, and a universal service has no meal plans. So
-- `select count(*) from meal_plan_options where slot = 'drink'` was 0, and a
-- plan asking for a drink showed an empty course while the same bottle sat in
-- the Drinks extras tab with a price on it. "Pasta & Drink" is live and has
-- been unfillable since the slot shipped.
--
-- Selling them under the two BOX services fixes it. Inside a fixed-price plan
-- create_order charges 0 for a picked dish, so a plan's drinks are included --
-- which is the whole point. The extras tabs are untouched: an EXTRA drink on
-- top of the box is still charged.
--
-- Party Trays is deliberately excluded: it sells by the piece and none of its
-- plans ask for a drink. Untick any drink you don't want offered in a box.
-- Re-runnable.
-- ============================================================================

insert into public.menu_item_categories (menu_item_id, category_id)
select m.id, c.id
  from public.menu_items m
  join public.sub_categories s on s.id = m.sub_category_id and s.slug = 'drink'
  join public.categories c on c.slug in ('check-a-lunch', 'fun-boxes')
on conflict (menu_item_id, category_id) do nothing;
