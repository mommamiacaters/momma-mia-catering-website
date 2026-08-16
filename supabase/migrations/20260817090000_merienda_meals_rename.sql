-- ============================================================================
-- "Fun Boxes" is now "Merienda Meals".
--
-- Display-name rename only. The menu CATEGORY slug stays 'fun-boxes' — it is a
-- join key (categories↔menu_items), a menuService bucket key, and a seed-script
-- key; renaming it buys nothing user-visible. The SERVICE-PAGE slug (routes +
-- carousel_images.service_slug) DOES change to 'merienda-meals' to match the
-- new /services/merienda-meals URL; without the carousel update every admin-
-- uploaded photo for the page would silently fall back to the bundled JPGs.
-- Existing storage objects keep their old 'carousel/fun-boxes/...' keys — the
-- keys are opaque, only the service_slug column drives lookups.
-- Re-runnable.
-- ============================================================================

update public.categories
   set name = 'Merienda Meals'
 where slug = 'fun-boxes';

update public.carousel_images
   set service_slug = 'merienda-meals'
 where service_slug = 'fun-boxes';

update public.app_settings
   set description = 'Check-A-Lunch and Merienda Meals orders must contain at least this many boxes before checkout is allowed. Enforced in the cart and again when the order is submitted. Set to 0 to turn the minimum off. Does not affect à-la-carte, Party Trays, catering or equipment rental.'
 where key = 'minimum_meal_plans';
