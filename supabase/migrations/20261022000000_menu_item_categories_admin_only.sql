-- ============================================================================
-- Only admins may change which services a dish is sold under.
--
-- 20260831000500 created the write policy as `to authenticated using (true)`,
-- so any signed-in customer could delete memberships (dishes vanish from the
-- pickers) or rewrite per-service prices. Every other catalog table already
-- gates writes on is_admin(); this brings memberships in line.
--
-- The home-category trigger is SECURITY DEFINER, so it keeps working for any
-- menu_items write regardless of this policy. Reads stay public. Re-runnable.
-- ============================================================================

drop policy if exists "authenticated manage menu_item_categories" on public.menu_item_categories;
drop policy if exists "admins manage menu_item_categories" on public.menu_item_categories;
create policy "admins manage menu_item_categories"
  on public.menu_item_categories for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
