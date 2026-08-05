-- Align menu_items.item_type with sub_categories.slot.
-- "starch" was the legacy name for the rice slot; item_type is snapshotted onto
-- order_items, so kitchen tickets were reading "starch" for rice dishes.
update public.menu_items m
   set item_type = s.slot
  from public.sub_categories s
 where m.sub_category_id = s.id
   and s.slot is not null
   and m.item_type is distinct from s.slot;
