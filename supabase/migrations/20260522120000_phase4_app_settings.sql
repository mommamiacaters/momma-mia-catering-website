-- ============================================================================
-- Phase 4: App settings (store-level configuration)
-- A small key/value store so the business can tune store behaviour from the
-- admin console without a code deploy. First setting: minimum_meal_plans
-- (the "Check A Lunch" minimum-box gate that used to be a hardcoded constant).
--
-- Design notes:
--   * value is jsonb so settings can be numbers, strings, booleans or objects.
--   * is_public gates anon readability — storefront-facing settings (like the
--     minimum) are public; anything sensitive defaults to admin-only.
-- ============================================================================

create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  label       text not null,                 -- human label shown in the admin UI
  description text,                           -- helper text shown in the admin UI
  is_public   boolean not null default false, -- readable by anon (storefront)?
  updated_at  timestamptz not null default now()
);

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

alter table public.app_settings enable row level security;

-- Public site may read ONLY settings flagged public (e.g. the order minimum).
create policy "public settings are readable"
  on public.app_settings for select
  using (is_public = true);

-- Admins read everything and are the only ones who may write.
create policy "admins manage settings"
  on public.app_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- seed -------------------------------------------------------------
insert into public.app_settings (key, value, label, description, is_public)
values (
  'minimum_meal_plans',
  '15'::jsonb,
  'Minimum lunch boxes per order',
  'Customers must build at least this many lunch boxes before they can check out.',
  true
)
on conflict (key) do nothing;
