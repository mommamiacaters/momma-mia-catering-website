-- Admin switch for the Other Services section (Catering + Equipment Rental).
--
-- Public so the storefront can read it, boolean so the settings console renders
-- it as a toggle automatically. Seeded FALSE: the business wants the section
-- down for now, and flipping the switch brings it back without a deploy.
--
-- Covers both surfaces the section owns: the homepage band and the
-- /other-services page it opens. The service pages themselves
-- (/services/catering, /services/equipment-rental) stay reachable by direct
-- link so an existing quote conversation does not break.
insert into public.app_settings (key, value, label, description, is_public)
values (
  'show_other_services',
  'false'::jsonb,
  'Show the Other Services section',
  'The Catering and Equipment Rental band under the homepage panels, plus the Other Services page it opens. Off hides both, so visitors only see the three services they can order online.',
  true
)
on conflict (key) do nothing;
