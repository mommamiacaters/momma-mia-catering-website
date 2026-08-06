-- ============================================================================
-- Notify config → Supabase Vault, PHASE B (the actual security fix)
-- ----------------------------------------------------------------------------
-- DO NOT RUN THIS UNTIL PHASE A IS VERIFIED.
-- Run scratchpad/verify-notify-config.sql first; it must report that
-- _notify_config() resolves BOTH values from the vault (source = 'vault'),
-- and you should confirm a real order/contact email still arrives.
--
-- Phase A left the app_settings rows in place as a fallback, which means the
-- secret is still readable by any admin session — i.e. the vulnerability is
-- still open until this runs. This phase:
--   1. removes the app_settings fallback from _notify_config();
--   2. deletes the two rows.
--
-- After this, the only readers are the three SECURITY DEFINER notify functions
-- (owned by postgres, which holds SELECT on vault.decrypted_secrets).
-- settingsService.fetchAllSettings() will no longer return them at all, so they
-- can't reach an admin browser even in the network response.
--
-- ROLLBACK: re-run 20260806150000 (phase A). It re-adds the fallback, and the
-- vault copies still exist, so nothing is lost. To fully restore the old shape,
-- re-insert the rows from vault:
--   insert into public.app_settings (key, value, label, description, is_public)
--   select 'order_notify_url', to_jsonb(decrypted_secret), 'Order-notify function URL', null, false
--     from vault.decrypted_secrets where name = 'order_notify_url';
--
-- Re-runnable.
-- ============================================================================

create or replace function public._notify_config(out p_url text, out p_secret text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  select decrypted_secret into p_url
    from vault.decrypted_secrets where name = 'order_notify_url';
  select decrypted_secret into p_secret
    from vault.decrypted_secrets where name = 'order_notify_secret';
exception when others then
  -- Never let config lookup abort a caller; they all treat empty as "skip".
  raise warning 'notify-config lookup failed: % (sqlstate %)', sqlerrm, sqlstate;
  p_url := null;
  p_secret := null;
end $$;

revoke all on function public._notify_config() from public, anon, authenticated;

-- Guard: refuse to drop the rows unless the vault genuinely has both values.
-- Without this a mis-ordered run would silently disable every notification.
do $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'order_notify_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'order_notify_secret';

  if v_url is null or btrim(v_url) = '' or v_secret is null or btrim(v_secret) = '' then
    raise exception 'Refusing to delete app_settings rows: vault is missing order_notify_url and/or order_notify_secret. Run phase A (20260806150000) first.';
  end if;

  delete from public.app_settings
   where key in ('order_notify_url', 'order_notify_secret');
end $$;
