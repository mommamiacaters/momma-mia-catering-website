-- ============================================================================
-- Service page carousels: admin-managed images (public.carousel_images)
-- ----------------------------------------------------------------------------
-- The five service pages (/services/:slug) render their photo carousel from a
-- hardcoded list of bundled imports in the frontend (SERVICE_CONTENT_MAP), so
-- swapping a single photo needs a code change and a deploy. This table moves
-- that list into the database, behind the same admin console that already
-- manages the menu.
--
-- Keyed by SERVICE SLUG, not by category_id: two of the five carousels
-- (catering, equipment-rental) have no row in public.categories at all, and the
-- ones that do disagree on spelling (service 'party-trays' vs category
-- 'party-tray'). A plain slug is the only key that covers all five.
--
-- Images live in the existing PUBLIC `menu-images` bucket under
-- `carousel/<service_slug>/<uuid>.<ext>`. That bucket already has public read
-- and an is_admin()-gated "admins manage menu images" policy covering the whole
-- bucket, so no storage policy is added here. storage_path is kept alongside
-- the URL so deleting a row can delete the object too.
--
-- The frontend keeps the hardcoded images as a FALLBACK: zero active rows for a
-- slug means the page renders exactly what it renders today, so this migration
-- can land before any image is uploaded.
--
-- Fully re-runnable.
-- ============================================================================

create table if not exists public.carousel_images (
  id           bigint generated always as identity primary key,
  service_slug text not null,                 -- e.g. 'check-a-lunch', 'party-trays'
  image_url    text not null,                 -- public URL served to the storefront
  storage_path text,                          -- object key in `menu-images`; NULL for externally hosted images
  alt_text     text,
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Covers the storefront read (one slug, in display order) and the admin list.
create index if not exists idx_carousel_images_slug_order
  on public.carousel_images(service_slug, sort_order, id);

drop trigger if exists trg_carousel_images_updated_at on public.carousel_images;
create trigger trg_carousel_images_updated_at
  before update on public.carousel_images
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS — same posture as the rest of the catalog: world-readable when active,
-- admin-only writes.
-- ============================================================================
alter table public.carousel_images enable row level security;

drop policy if exists "active carousel images are publicly readable" on public.carousel_images;
create policy "active carousel images are publicly readable"
  on public.carousel_images for select using (is_active = true);

drop policy if exists "admins manage carousel images" on public.carousel_images;
create policy "admins manage carousel images"
  on public.carousel_images for all
  using (public.is_admin()) with check (public.is_admin());
