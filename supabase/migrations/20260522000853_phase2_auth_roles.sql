-- ============================================================================
-- Phase 2: Auth, roles & role-aware RLS
-- Adds the profiles table (extends auth.users) with a role of client/driver/admin.
-- 'driver' exists in the enum now so Phase 5 needs no enum change, but only
-- 'client' and 'admin' are exercised by the current apps.
-- ============================================================================

create type public.app_role as enum ('client', 'driver', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.app_role not null default 'client',
  full_name   text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- ---------- auto-create a profile when a user signs up ----------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- role helper (SECURITY DEFINER avoids RLS recursion) --------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- block privilege escalation --------------------------------------
-- A client must never be able to promote themselves. Role changes are allowed
-- only for admins or for trusted server-side (service_role => auth.uid() null).
create or replace function public.prevent_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin may change a user role';
  end if;
  return new;
end;
$$;

create trigger trg_profiles_prevent_role_change
  before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ============================================================================
-- RLS policies
-- ============================================================================

-- profiles: read own (or admin reads all); update own (role guarded by trigger)
create policy "users read their own profile or admin reads all"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "users update their own profile or admin updates any"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- catalog: admins may write (the public-read policies live in Phase 1)
create policy "admins manage categories"
  on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

create policy "admins manage menu items"
  on public.menu_items for all
  using (public.is_admin()) with check (public.is_admin());

-- orders: a logged-in client sees their own; admins see and manage all.
-- (guest INSERT stays allowed via the Phase 1 policy)
create policy "clients read their own orders"
  on public.orders for select
  using (client_id = auth.uid() or public.is_admin());

create policy "admins update orders"
  on public.orders for update
  using (public.is_admin()) with check (public.is_admin());

create policy "read order items for visible orders"
  on public.order_items for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.client_id = auth.uid()
    )
  );

-- contact submissions: only admins can read them back
create policy "admins read contact submissions"
  on public.contact_submissions for select
  using (public.is_admin());

-- ---------- payment proofs: admins can read them ----------------------------
create policy "admins read payment proofs"
  on storage.objects for select
  using (bucket_id = 'payment-proofs' and public.is_admin());
