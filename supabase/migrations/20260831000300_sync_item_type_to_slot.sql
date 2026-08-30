-- ============================================================================
-- menu_items.item_type is re-synced to its sub-category's slot.
--
-- The invariant (see ItemFormModal) is that item_type MIRRORS the slot; the
-- admin form writes it that way on every save. Merging the sub-categories in
-- 20260831000200 moved dishes without touching item_type, so 17 rows still
-- said 'beef' / 'drink' / 'salad' / 'vegetables'. That matters beyond tidiness:
-- create_order snapshots mi.item_type onto order_items, so those words would
-- have landed on real order lines.
--
-- This also clears pre-existing drift where item_type held the SLUG rather
-- than the slot ('rice-bowls' on 16 dishes, whose slot is 'rice_bowl').
--
-- Dishes with no sub-category (the universal Add-ons / Cafe extras) are left
-- alone -- they are not plan components and have no slot to mirror.
-- Re-runnable.
-- ============================================================================

update public.menu_items m
   set item_type = s.slot
  from public.sub_categories s
 where s.id = m.sub_category_id
   and s.slot is not null
   and m.item_type is distinct from s.slot;
