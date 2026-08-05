-- ============================================================================
-- Fill in the Check-a-Lunch dishes the database was missing.
--
-- The printed menu lists 66 dishes across PORK / CHICKEN / SEAFOOD / SIDE DISH /
-- DESSERT; only 26 existed. Most importantly there were NO desserts at all,
-- while three of the five plans include one — so those plans could never have
-- been completed.
--
-- Prices follow the convention already in the table (mains ₱70, sides ₱90, rice
-- ₱35). They are per-component figures, not what the customer pays: the plan
-- row in public.meal_plans carries the real price. Desserts had no precedent, so
-- they are seeded at ₱70 — REVIEW THESE in the admin console if that's wrong.
--
-- Idempotent: keyed on (category_id, name), so re-running inserts nothing new
-- and never duplicates a dish that already carries a photo.
-- ============================================================================

insert into public.menu_items (category_id, name, sub_category_id, price_cents, item_type, is_available)
select 1, d.name, s.id, d.price_cents, d.legacy_type, true
  from (values
    -- ---- PORK ----------------------------------------------------------
    ('Swedish Meatballs',                        'pork',      7000, 'main'),
    ('Grilled Pork in Peppercorn Gravy',         'pork',      7000, 'main'),
    ('Lumpia Shanghai',                          'pork',      7000, 'main'),
    ('Pork Steak',                               'pork',      7000, 'main'),
    ('Pork Caldereta',                           'pork',      7000, 'main'),
    ('Sweet & Sour Pork',                        'pork',      7000, 'main'),
    ('Pork Embutido',                            'pork',      7000, 'main'),
    ('Pork Cutlet w/ Honey Mustard Dip',         'pork',      7000, 'main'),
    ('Pork Tapa',                                'pork',      7000, 'main'),
    ('Grilled Liempo w/ Native Sauce',           'pork',      7000, 'main'),
    ('Salisbury Steak in Mushroom Gravy',        'pork',      7000, 'main'),
    ('Pork Sisig',                               'pork',      7000, 'main'),
    ('Salt & Pepper Crispy Pork',                'pork',      7000, 'main'),
    ('Pork Adobo',                               'pork',      7000, 'main'),
    ('Sweet & Sour Meatballs',                   'pork',      7000, 'main'),
    -- ---- CHICKEN -------------------------------------------------------
    ('Chicken Adobo',                            'chicken',   7000, 'main'),
    ('Canotonese Lemon Chicken',                 'chicken',   7000, 'main'),
    ('Battered Chicken in Espresso Sauce',       'chicken',   7000, 'main'),
    ('Korean Fried Chicken',                     'chicken',   7000, 'main'),
    ('Chicken Curry',                            'chicken',   7000, 'main'),
    ('Buffalo Chicken',                          'chicken',   7000, 'main'),
    ('Chicken Teriyaki',                         'chicken',   7000, 'main'),
    ('Chicken Salpicao',                         'chicken',   7000, 'main'),
    ('Fried Chicken w/ Native Sauce',            'chicken',   7000, 'main'),
    ('Chicken Cordon Bleu',                      'chicken',   7000, 'main'),
    ('Chicken Fillet in Creamy Rosemary Bechamel','chicken',  7000, 'main'),
    ('Braised Chicken in Dark Soy Mushroom',     'chicken',   7000, 'main'),
    ('Lemon Garlic Chicken Tenders',             'chicken',   7000, 'main'),
    ('Spicy Chicken Sisig',                      'chicken',   7000, 'main'),
    ('Garlic Parmesan Chicken',                  'chicken',   7000, 'main'),
    ('Chicken Fricasse',                         'chicken',   7000, 'main'),
    -- ---- SEAFOOD -------------------------------------------------------
    ('Sweet & Sour Fish',                        'seafood',   7000, 'main'),
    ('Salt & Pepper Fish',                       'seafood',   7000, 'main'),
    ('Crispy Fish Fillet in Garlic Aioli',       'seafood',   7000, 'main'),
    ('Creamy Pesto Bechamel Fish',               'seafood',   7000, 'main'),
    ('Lemon Butter Fish Fillet',                 'seafood',   7000, 'main'),
    ('Crispy Calamares',                         'seafood',   7000, 'main'),
    ('Herb Crusted Fish Fillet',                 'seafood',   7000, 'main'),
    ('Battered Squid',                           'seafood',   7000, 'main'),
    ('Fish Fillet Escabeche',                    'seafood',   7000, 'main'),
    -- ---- SIDE DISH -----------------------------------------------------
    ('Chow Pat Chin',                            'side-dish', 9000, 'side'),
    ('Buttered Potato',                          'side-dish', 9000, 'side'),
    ('Sauted Garlic Green Beans',                'side-dish', 9000, 'side'),
    ('Hashed Potato Wedge',                      'side-dish', 9000, 'side'),
    ('Potato Croquettes',                        'side-dish', 9000, 'side'),
    ('Cabbage & Carrot Stir Fry',                'side-dish', 9000, 'side'),
    ('Potato Salad',                             'side-dish', 9000, 'side'),
    ('Baked Macaaroni',                          'side-dish', 9000, 'side'),
    ('Creamy Carbonara',                         'side-dish', 9000, 'side'),
    ('Penne Bolognese',                          'side-dish', 9000, 'side'),
    ('Chicken Penne Alfredo',                    'side-dish', 9000, 'side'),
    ('Spaghetti Filipino',                       'side-dish', 9000, 'side'),
    ('Mongolian Beef Noodle',                    'side-dish', 9000, 'side'),
    ('Beef Lasagna',                             'side-dish', 9000, 'side'),
    ('Stir Fried Egg Noodle',                    'side-dish', 9000, 'side'),
    ('Potato Chips',                             'side-dish', 9000, 'side'),
    -- ---- DESSERT (none existed) ----------------------------------------
    ('Brownie Bar',                              'dessert',   7000, 'dessert'),
    ('Seasonal Fresh Fruits',                    'dessert',   7000, 'dessert'),
    ('Moist Banana Cake',                        'dessert',   7000, 'dessert'),
    ('Fruit Salad',                              'dessert',   7000, 'dessert'),
    ('Mango Panacotta',                          'dessert',   7000, 'dessert'),
    ('Chicken Macaroni Salad',                   'dessert',   7000, 'dessert'),
    ('Coffee Jelly',                             'dessert',   7000, 'dessert'),
    ('Maja Maiz',                                'dessert',   7000, 'dessert'),
    ('Maja Pandan',                              'dessert',   7000, 'dessert'),
    ('Maja Ube',                                 'dessert',   7000, 'dessert'),
    -- ---- RICE ----------------------------------------------------------
    ('Plain Rice',                               'rice',      3500, 'starch'),
    ('Garlic Rice',                              'rice',      3500, 'starch'),
    ('Yangchow Rice',                            'rice',      3500, 'starch')
  ) as d(name, sub_slug, price_cents, legacy_type)
  join public.sub_categories s on s.slug = d.sub_slug
 where not exists (
   select 1 from public.menu_items existing
    where existing.category_id = 1
      and lower(btrim(existing.name)) = lower(btrim(d.name))
 );

-- Backfill sub_category_id for anything the recategorise pass missed because the
-- row was inserted just now under a name it didn't know about.
update public.menu_items m
   set sub_category_id = s.id
  from public.sub_categories s
 where m.category_id = 1
   and m.sub_category_id is null
   and s.slug = 'side-dish'
   and coalesce(m.item_type, '') <> 'packed meal';
