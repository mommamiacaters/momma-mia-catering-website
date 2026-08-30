-- ============================================================================
-- A service can set its own per-dish minimum, and the two store defaults are
-- relabelled to match the words the admin sees on the service page.
--
-- Until now `categories.min_order_boxes` overrode only the MEAL count. The
-- per-dish floor had no per-service override at all, so Party Trays -- sold by
-- the piece, minimum 1 meal -- still demanded 15 of every dish. This adds the
-- missing column; create_order v11 and the picker read it.
--
-- Resolution order for a dish's floor, most specific first:
--   menu_items.min_qty -> categories.min_qty_per_dish -> minimum_qty_per_dish
--
-- Re-runnable.
-- ============================================================================

alter table public.categories
  add column if not exists min_qty_per_dish int;

alter table public.categories drop constraint if exists categories_min_qty_per_dish_check;
alter table public.categories
  add constraint categories_min_qty_per_dish_check
  check (min_qty_per_dish is null or (min_qty_per_dish >= 0 and min_qty_per_dish <= 500));

comment on column public.categories.min_qty_per_dish is
  'Per-service floor for EACH dish. NULL = use the minimum_qty_per_dish store default; 0 = this service has no per-dish floor. A dish''s own min_qty still wins.';

-- Party Trays are sold by the piece: one tray of one dish is a valid order.
update public.categories set min_qty_per_dish = 1 where slug = 'party-tray';

-- Settings copy: "boxes" became "meals", the override moved from the Meal
-- Plans page to Services, and the old text was both too long and carrying a
-- double-encoded "a-la-carte".
update public.app_settings
   set label = 'Default minimum meals',
       description = 'The fewest meals an order must reach. Any service can override this on its own page. Set 0 to switch it off.'
 where key = 'minimum_meal_plans';

update public.app_settings
   set label = 'Default minimum dishes',
       description = 'The fewest of each dish an order must include. A service, or a single dish, can override this. Set 0 to switch it off.'
 where key = 'minimum_qty_per_dish';
