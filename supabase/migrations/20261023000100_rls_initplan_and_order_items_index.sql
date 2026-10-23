-- ============================================================================
-- RLS: evaluate is_admin() / auth.uid() once per statement, not once per row.
--
-- Bare calls in a policy run for every row the query touches, and is_admin()
-- is SECURITY DEFINER (not inlinable) with its own profiles lookup. Wrapped in
-- (select ...) Postgres runs it once as an initPlan. Same names, same roles,
-- same logic — only the wrapping changes.
--
-- Also indexes order_items.menu_item_id: the FK is `on delete set null`, so
-- deleting a dish scanned every order line.
-- Re-runnable.
-- ============================================================================

create index if not exists idx_order_items_menu_item
  on public.order_items (menu_item_id);

-- ---------- admin-managed catalog and settings ------------------------------
drop policy if exists "admins manage settings" on public.app_settings;
create policy "admins manage settings" on public.app_settings for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins manage carousel images" on public.carousel_images;
create policy "admins manage carousel images" on public.carousel_images for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins manage meal plans" on public.meal_plans;
create policy "admins manage meal plans" on public.meal_plans for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins manage menu items" on public.menu_items;
create policy "admins manage menu items" on public.menu_items for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins manage services" on public.services;
create policy "admins manage services" on public.services for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "admins manage sub categories" on public.sub_categories;
create policy "admins manage sub categories" on public.sub_categories for all
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- company profile -------------------------------------------------
drop policy if exists "admins insert company profile" on public.company_profile;
create policy "admins insert company profile" on public.company_profile for insert
  with check ((select public.is_admin()) and id = true);

drop policy if exists "admins read company profile" on public.company_profile;
create policy "admins read company profile" on public.company_profile for select
  using ((select public.is_admin()));

drop policy if exists "admins update company profile" on public.company_profile;
create policy "admins update company profile" on public.company_profile for update
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- inbound leads ---------------------------------------------------
drop policy if exists "admins read contact submissions" on public.contact_submissions;
create policy "admins read contact submissions" on public.contact_submissions for select
  using ((select public.is_admin()));

drop policy if exists "admins read quote requests" on public.quote_requests;
create policy "admins read quote requests" on public.quote_requests for select
  using ((select public.is_admin()));

-- ---------- orders ----------------------------------------------------------
drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders for update
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "clients read their own orders" on public.orders;
create policy "clients read their own orders" on public.orders for select
  using (client_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "read order items for visible orders" on public.order_items;
create policy "read order items for visible orders" on public.order_items for select
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.orders o
       where o.id = order_items.order_id
         and o.client_id = (select auth.uid())
    )
  );

-- ---------- profiles (role changes stay guarded by trg_profiles_prevent_role_change)
drop policy if exists "users read their own profile or admin reads all" on public.profiles;
create policy "users read their own profile or admin reads all" on public.profiles for select
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "users update their own profile or admin updates any" on public.profiles;
create policy "users update their own profile or admin updates any" on public.profiles for update
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
