-- ============================================================================
-- Phase 3: let admins upload/replace/delete menu photos in the menu-images
-- bucket. Public read already exists (Phase 1). This is what powers the
-- "upload image" button in the admin product manager.
-- ============================================================================
create policy "admins manage menu images"
  on storage.objects for all
  using (bucket_id = 'menu-images' and public.is_admin())
  with check (bucket_id = 'menu-images' and public.is_admin());
