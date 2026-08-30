-- ============================================================================
-- Every dish without a sub-category becomes Main.
--
-- A blank sub-category carries no slot, and meal_plan_options joins
-- sub_categories and filters `where s.slot is not null` -- so those dishes
-- appeared in NO picker. 27 of the 34 were Party Trays mains (Lumpia Shanghai,
-- Beef Caldereta, Chopsuey and friends), which is why that service's builder
-- looked so thin.
--
-- Main is now the default for new dishes in the admin form too, so this is a
-- one-off catch-up rather than a rule that needs re-running.
--
-- item_type is kept in step in the same statement -- create_order snapshots it
-- onto order_items, so it must never drift from the slot.
-- Re-runnable.
-- ============================================================================

update public.menu_items m
   set sub_category_id = s.id,
       item_type       = s.slot
  from public.sub_categories s
 where s.slot = 'main'
   and s.is_active
   and m.sub_category_id is null;
