-- ============================================================================
-- Phase 1: Catalog + Orders + Contact
-- Replaces the n8n/Google-Sheets data layer with Supabase as system of record.
-- Scope is intentionally limited to what the WEBSITE does today:
--   * read the menu (categories + items)
--   * submit an order (with payment proof) and a contact-form message
-- Auth/roles (Phase 2), admin writes (Phase 3) and drivers/tracking (Phase 5)
-- are added in their own migrations.
-- ============================================================================

-- ---------- helper: keep updated_at fresh -----------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- enums -----------------------------------------------------------
-- Full status sets defined up front so later phases don't need ALTER TYPE.
create type public.order_status as enum (
  'pending', 'confirmed', 'preparing', 'ready',
  'assigned', 'picked_up', 'delivered', 'cancelled'
);

create type public.order_type as enum ('delivery', 'pickup', 'catering');

-- ---------- categories ------------------------------------------------------
create table public.categories (
  id          serial primary key,
  slug        text not null unique,            -- e.g. 'check-a-lunch', 'fun-boxes'
  name        text not null,
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------- menu_items ------------------------------------------------------
-- The shared catalog. BOTH web and (later) mobile read this table. Only the
-- admin console (Phase 3) writes it. price is stored in CENTAVOS (integer) to
-- avoid floating-point money bugs.
create table public.menu_items (
  id           uuid primary key default gen_random_uuid(),
  category_id  int references public.categories(id) on delete set null,
  name         text not null,
  description  text,
  image_url    text,                            -- public URL (ImageKit today, Storage later)
  price_cents  int  check (price_cents is null or price_cents >= 0),  -- NULL = "price on request" (some catering trays)
  item_type    text,                            -- main/side/starch/drink/dessert/pasta/sandwich/salad/rice bowls...
  is_available boolean not null default true,
  is_catering  boolean not null default false,
  sort_order   int     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_menu_items_category on public.menu_items(category_id);
create index idx_menu_items_available on public.menu_items(is_available);
create trigger trg_menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

-- ---------- orders ----------------------------------------------------------
-- client_id references auth.users directly (nullable) so GUEST CHECKOUT keeps
-- working now; Phase 2 adds the profiles table that extends auth.users.
create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_ref          text not null unique,       -- MM-YYYYMMDD-HHMM-xxxx
  client_id          uuid references auth.users(id) on delete set null,
  status             public.order_status not null default 'pending',
  order_type         public.order_type   not null default 'delivery',

  -- customer contact snapshot (guests have no account row to join)
  customer_first_name text not null,
  customer_last_name  text not null,
  customer_email      text not null,
  customer_phone      text not null,

  -- delivery details
  delivery_address   text,
  delivery_date      date,
  delivery_time      text,
  special_requests   text,

  -- money (centavos)
  subtotal_cents     int not null check (subtotal_cents >= 0),
  delivery_fee_cents int not null default 0 check (delivery_fee_cents >= 0),
  total_cents        int not null check (total_cents >= 0),

  payment_proof_url  text,                        -- private Storage path
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_orders_client on public.orders(client_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_created on public.orders(created_at desc);
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------- order_items -----------------------------------------------------
-- unit_price_cents is a PRICE SNAPSHOT taken at order time, so later menu price
-- edits never rewrite historical order totals.
create table public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  menu_item_id     uuid references public.menu_items(id) on delete set null,
  item_name        text not null,                 -- snapshot of name
  item_type        text,                          -- snapshot of main/side/starch
  qty              int  not null default 1 check (qty > 0),
  unit_price_cents int  not null check (unit_price_cents >= 0),
  notes            text,
  -- meal-plan grouping (Double-the-Protein / Balanced Diet instances)
  plan_instance_id text,
  plan_type        text,
  created_at       timestamptz not null default now()
);
create index idx_order_items_order on public.order_items(order_id);

-- ---------- contact_submissions --------------------------------------------
create table public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  email       text not null,
  topic       text,
  message     text not null,
  created_at  timestamptz not null default now()
);
create index idx_contact_created on public.contact_submissions(created_at desc);

-- ============================================================================
-- Row Level Security
-- Posture: the public site can READ the live menu and CREATE orders/messages,
-- but can never read, list, update, or delete anyone's data. Admin writes
-- arrive in Phase 3 via the (authenticated) admin role.
-- ============================================================================
alter table public.categories          enable row level security;
alter table public.menu_items          enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.contact_submissions enable row level security;

-- Catalog: world-readable, but only ACTIVE/AVAILABLE rows to anon/auth.
create policy "categories are publicly readable"
  on public.categories for select
  using (is_active = true);

create policy "available menu items are publicly readable"
  on public.menu_items for select
  using (is_available = true);

-- Orders: anyone may CREATE an order (guest checkout). No select/update/delete
-- for anon/authenticated here — clients reading their own history arrives with
-- auth in Phase 2.
create policy "anyone can create an order"
  on public.orders for insert
  with check (true);

create policy "order items can be created with an order"
  on public.order_items for insert
  with check (true);

-- Contact: anyone may submit; nobody can read via the client API.
create policy "anyone can submit a contact message"
  on public.contact_submissions for insert
  with check (true);

-- ============================================================================
-- Storage buckets
--   menu-images    : PUBLIC  (catalog photos shown on web + mobile)
--   payment-proofs : PRIVATE (customer payment screenshots — sensitive)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- menu-images: world-readable; writes locked to admin/service (Phase 3).
create policy "menu images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'menu-images');

-- payment-proofs: a guest can UPLOAD a proof during checkout, but NOBODY can
-- read them back through the client API (only service_role / admin tooling).
create policy "anyone can upload a payment proof"
  on storage.objects for insert
  with check (bucket_id = 'payment-proofs');
