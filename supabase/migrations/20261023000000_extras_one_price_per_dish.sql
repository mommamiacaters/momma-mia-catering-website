-- ============================================================================
-- Extras show the price create_order charges: the dish's own price.
--
-- extras_menu_options showed coalesce(membership price, dish price), but
-- create_order bills an à-la-carte extra at menu_items.price_cents. A per-group
-- override (Coke canned: ₱65 in Add-ons, ₱45 dish price) displayed one figure
-- and charged another. Extras now have one price per dish, everywhere.
--
-- Per-service prices on universal (extras) groups are cleared so the admin form
-- can't show a figure nothing reads. Plan services keep theirs (reference only).
-- Re-runnable.
-- ============================================================================

update public.menu_item_categories mic
   set price_cents = null
  from public.categories c
 where c.id = mic.category_id
   and c.is_universal
   and mic.price_cents is not null;

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
  join public.menu_item_categories mic on mic.category_id = c.id
  join public.menu_items m             on m.id = mic.menu_item_id and m.is_available
 where c.is_universal
   and c.is_active
   and m.price_cents is not null
   and m.price_cents > 0;

grant select on public.extras_menu_options to anon, authenticated;
