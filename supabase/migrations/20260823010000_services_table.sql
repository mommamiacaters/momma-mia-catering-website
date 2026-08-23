-- ============================================================================
-- Services: the five service pages, editable from the admin console
-- ----------------------------------------------------------------------------
-- Until now a service's name, page heading, glyph and homepage photo lived in
-- three separate frontend constants (constants/services.ts,
-- constants/serviceContent.ts, constants/serviceIcons.tsx), so renaming one or
-- taking one off the homepage needed a code change and a deploy. This table
-- moves those values into the database behind the existing admin console.
--
-- Keyed by SERVICE SLUG for the same reason carousel_images is: two of the five
-- services (catering, equipment-rental) have no row in public.categories, and
-- the ones that do disagree on spelling (service 'party-trays' vs category
-- 'party-tray').
--
-- image_url is NULLABLE and seeded NULL on purpose: null means "use the photo
-- bundled with the site", which is exactly what every service uses today. So
-- this migration changes nothing visible until someone uploads a replacement.
-- Uploads land in the existing PUBLIC `menu-images` bucket under
-- `services/<slug>/<uuid>.<ext>`, which already carries public read and an
-- is_admin()-gated write policy, so no storage policy is needed here.
--
-- Descriptions stay in the frontend: they are not editable in this release, and
-- seeding a copy here would just create a second source that can drift.
--
-- Fully re-runnable.
-- ============================================================================

create table if not exists public.services (
  slug         text primary key,
  name         text not null,                 -- label on the homepage panel
  page_title   text not null,                 -- heading on /services/<slug>
  icon_id      text not null default 'lunch-box',
  image_url    text,                          -- null = use the bundled photo
  storage_path text,                          -- object key in `menu-images`
  kind         text not null default 'orderable',
  is_active    boolean not null default true, -- off = hidden from the homepage
  sort_order   int not null default 0,
  updated_at   timestamptz not null default now(),
  constraint services_kind_check check (kind in ('orderable', 'quote')),
  constraint services_name_not_blank check (length(btrim(name)) > 0),
  constraint services_page_title_not_blank check (length(btrim(page_title)) > 0)
);

-- The storefront's read: active services of one kind, in display order.
create index if not exists idx_services_active_order
  on public.services(kind, sort_order, slug)
  where is_active;

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS — admin-only writes, and every row readable.
--
-- Deliberately NOT gated on is_active, unlike carousel_images. The storefront
-- has to tell "this service is deactivated" apart from "this service has no row
-- yet", and an RLS filter makes those two cases identical: both just come back
-- absent. Hiding the row would make a deactivated service reappear on the
-- homepage. The storefront filters is_active itself. Nothing here is sensitive
-- (it is a list of service names, and every /services/<slug> page is public
-- regardless).
-- ============================================================================
alter table public.services enable row level security;

drop policy if exists "active services are publicly readable" on public.services;
drop policy if exists "services are publicly readable" on public.services;
create policy "services are publicly readable"
  on public.services for select using (true);

drop policy if exists "admins manage services" on public.services;
create policy "admins manage services"
  on public.services for all
  using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Seed: exactly what the frontend constants say today, so the storefront looks
-- identical the moment this lands.
-- ============================================================================
insert into public.services (slug, name, page_title, icon_id, kind, sort_order)
values
  ('check-a-lunch',    'Check-a-Lunch',    'Check-A-Lunch',      'lunch-box',    'orderable', 1),
  ('party-trays',      'Party Trays',      'Party Trays',        'cloche',       'orderable', 2),
  ('merienda-meals',   'Merienda Meals',   'Merienda Meals',     'merienda-cup', 'orderable', 3),
  ('catering',         'Catering',         'Catering Services',  'chafing-pan',  'quote',     4),
  ('equipment-rental', 'Equipment Rental', 'Equipment Rental',   'utensils',     'quote',     5)
on conflict (slug) do nothing;
