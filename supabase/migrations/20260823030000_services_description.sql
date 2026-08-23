-- ============================================================================
-- Editable service descriptions
-- ----------------------------------------------------------------------------
-- The blurb on each homepage panel was the last part of a service still living
-- in the frontend bundle (ORDERABLE_SERVICES / OTHER_SERVICES in
-- constants/services.ts), so changing a sentence needed a deploy.
--
-- Seeded with exactly the copy the site ships today, so nothing changes until
-- someone edits it. Blank is allowed and means "fall back to the bundled copy",
-- which keeps the panel from rendering an empty gap if a description is cleared.
--
-- Fully re-runnable.
-- ============================================================================
alter table public.services
  add column if not exists description text not null default '';

update public.services set description = v.description
from (values
  (
    'check-a-lunch',
    'Packed meals with heart. Choose your meals for the week or day. Freshly prepared, delivered daily. No subscriptions—just food that works around your schedule.'
  ),
  (
    'party-trays',
    'Generous portions, easy hosting. Delicious, ready-to-serve trays for 8–10 people. Perfect for family get-togethers, potlucks, or surprise celebrations.'
  ),
  (
    'merienda-meals',
    'Pasta? Sandwich? Dessert? Curated merienda boxes you can mix and match—ideal for events, client gifts, team perks, and anything worth celebrating.'
  ),
  (
    'catering',
    'Full-service catering for any occasion. From small gatherings to big events, we bring the food, setup, and service so you can focus on hosting.'
  ),
  (
    'equipment-rental',
    'Need chafing dishes, buffet tables, or utensils? Rent what you need—no frills, no fuss, no overcharging.'
  )
) as v(slug, description)
where public.services.slug = v.slug
  and btrim(public.services.description) = '';
