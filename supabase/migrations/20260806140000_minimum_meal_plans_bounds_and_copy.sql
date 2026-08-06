-- ============================================================================
-- minimum_meal_plans — admin-facing copy + bounds
-- ----------------------------------------------------------------------------
-- label/description live in the DB and AdminSettings only ever writes `value`,
-- so the copy can't be fixed from the UI. The old description promised
-- enforcement that didn't exist until create_order v5; it now does.
--
-- The bounds CHECK is the real guard: before this, the only limit was an HTML
-- min={1} on the admin input, so a fat-fingered 155 instead of 15 made checkout
-- unreachable store-wide with no constraint to stop it, and 0 ("no minimum")
-- couldn't be expressed at all. 0..500 is generous enough for a corporate
-- catering minimum while still catching a 1500-for-15 typo.
--
-- Scoped by key so the order_notify_* rows are untouched. All functions used are
-- IMMUTABLE, so this is a legal CHECK.
--
-- Deliberately does NOT write `value` — that is the admin's setting to own, and
-- rewriting it on every deploy would destroy the capability this feature adds.
-- Re-runnable.
-- ============================================================================

update public.app_settings
   set label = 'Minimum lunch boxes to check out',
       description = 'Check-A-Lunch and Fun Box orders must contain at least this many boxes before checkout is allowed. Enforced in the cart and again when the order is submitted. Set to 0 to turn the minimum off. Does not affect à-la-carte, Party Trays, catering or equipment rental.'
 where key = 'minimum_meal_plans';

alter table public.app_settings
  drop constraint if exists app_settings_minimum_meal_plans_bounds;

alter table public.app_settings
  add constraint app_settings_minimum_meal_plans_bounds check (
    key <> 'minimum_meal_plans'
    or (
      jsonb_typeof(value) = 'number'
      and (value #>> '{}')::numeric between 0 and 500
      and (value #>> '{}')::numeric = floor((value #>> '{}')::numeric)
    )
  );

comment on constraint app_settings_minimum_meal_plans_bounds on public.app_settings is
  'minimum_meal_plans must be a whole number 0..500. Stops a typo from making checkout unreachable store-wide.';
