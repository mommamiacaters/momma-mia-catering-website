-- ============================================================================
-- Universal categories: Add-ons and Café Menu ride along with EVERY service.
--
-- Until now a category's dishes could only be sold through that category's own
-- meal plans (meal_plan_options joins by category), so Add-ons and Café Menu
-- appeared in no picker at all. They are not plan courses; they are extras a
-- customer tacks onto any order. This marks them as such and gives the
-- storefront one view to read them from.
--
-- Also in here, because they are one-line category facts:
--   * Add-ons sorts before Café Menu (owner's requested order).
--   * The empty "Rice Bowls" CATEGORY (id 12) is archived — rice bowls live as
--     a sub-category under Check-a-Lunch; this top-level twin held zero dishes
--     and only confused the Menu Manager. Guarded so it never archives a
--     category that has since gained dishes.
--   * Party Trays' floor drops to 1: a tray feeds 8-10 people, the 10-box
--     lunch minimum made no sense for it.
--
-- Re-runnable.
-- ============================================================================

alter table public.categories
  add column if not exists is_universal boolean not null default false;

comment on column public.categories.is_universal is
  'TRUE = an extras category (Add-ons, Café Menu): its dishes are offered alongside every service''s plans instead of belonging to one service.';

update public.categories set is_universal = true  where slug in ('add-on', 'cafe-menu');
update public.categories set sort_order = 7 where slug = 'add-on';
update public.categories set sort_order = 8 where slug = 'cafe-menu';

update public.categories
   set is_active = false
 where slug = 'rice-bowls'
   and not exists (select 1 from public.menu_items m where m.category_id = categories.id);

update public.categories set min_order_boxes = 1 where slug = 'party-tray';

-- The storefront's one read for extras. Unpriced dishes are filtered here:
-- extras are charged à la carte and create_order refuses a NULL price, so a
-- "price on request" item must never be offered as an extra.
create or replace view public.extras_menu_options as
select c.id         as category_id,
       c.slug       as category_slug,
       c.name       as category_name,
       c.sort_order as category_sort,
       m.id         as menu_item_id,
       m.name,
       m.description,
       m.image_url,
       m.price_cents,
       m.min_qty
  from public.categories c
  join public.menu_items m on m.category_id = c.id and m.is_available
 where c.is_universal
   and c.is_active
   and m.price_cents is not null
   and m.price_cents > 0;

grant select on public.extras_menu_options to anon, authenticated;
