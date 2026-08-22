-- Admin switch for the per-dish bulk buttons ("Fill all N" / "Clear N") in the
-- lunch-box picker.
--
-- Public so the storefront can read it, boolean so the settings console renders
-- it as a toggle automatically. Seeded FALSE: the buttons are hidden until the
-- business asks for them back, and flipping the switch restores them without a
-- deploy.
insert into public.app_settings (key, value, label, description, is_public)
values (
  'show_bulk_dish_actions',
  'false'::jsonb,
  'Show "Fill all" and "Clear" on dish cards',
  'The bulk buttons under each dish in the lunch-box picker. Off means customers add dishes only with the +/- stepper. Turning this off does not change any order that has already been placed.',
  true
)
on conflict (key) do nothing;
