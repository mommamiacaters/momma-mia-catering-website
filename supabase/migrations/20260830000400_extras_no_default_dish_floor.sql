-- ============================================================================
-- Extras carry no default dish minimum.
--
-- The per-dish floor (app_settings.minimum_qty_per_dish, currently 15) exists
-- because each BOX dish is a kitchen batch. create_order v10 started applying
-- that floor to a-la-carte extras as well, and menu_items.min_qty was NULL on
-- most Add-ons / Cafe Menu dishes -- so coalesce(min_qty, 15) made a single
-- bottle of water unorderable, on the client AND at the RPC.
--
-- An explicit 0 opts each extra out on both sides at once: the server's
-- `coalesce(min_qty, default) > 0` guard skips it, and the client's
-- `min_qty ?? default` stops falling back (0 is not nullish). Extras where the
-- admin set a real minimum keep it.
--
-- Re-runnable; only ever touches NULLs.
-- ============================================================================

update public.menu_items m
   set min_qty = 0
  from public.categories c
 where c.id = m.category_id
   and c.is_universal
   and m.min_qty is null;
