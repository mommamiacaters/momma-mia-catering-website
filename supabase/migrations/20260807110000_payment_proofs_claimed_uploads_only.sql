-- ============================================================================
-- payment-proofs: only accept an upload a committed order has reserved (todo 020)
-- ----------------------------------------------------------------------------
-- The only INSERT policy on this bucket was:
--
--   "anyone can upload a payment proof"  INSERT  to public
--   with check (bucket_id = 'payment-proofs')
--
-- Unconditional. The anon key ships in the web bundle by design, so ANY
-- unauthenticated caller could POST arbitrary files, of any size, into a
-- private bucket holding customer payment screenshots — a storage-cost and
-- abuse vector, and a bad place to let strangers park content. (Reads were
-- never open: "admins read payment proofs" is is_admin()-gated.)
--
-- This could not be narrowed until create_order v6 (20260807100000) made the
-- SERVER mint the storage key, because until then a legitimate key was
-- indistinguishable from one an attacker invented.
--
-- ⚠️ RUN THIS ONLY AFTER THE NEW CLIENT BUNDLE IS LIVE. A browser tab loaded
-- before that deploy still uploads to its own key first, and this policy will
-- reject it. That is not silent and does not lose the order: both clients treat
-- a failed upload as non-fatal, and renderStoreAlert branches on
-- `!o.paymentProofUrl` to tell the store no proof is on file — so the worst case
-- in the drain window is an order the store has to chase a receipt for.
--
-- Re-runnable.
-- ============================================================================

-- The helper lives in `private`, NOT `public`: PostgREST publishes public
-- functions as unauthenticated RPCs, and this one answers "does an order
-- reference this exact key?" for any string a caller supplies — a free
-- existence oracle. RLS predicates are evaluated as the CALLER, so anon still
-- needs EXECUTE on it; keeping it out of an exposed schema is what stops it
-- also being callable directly.
create schema if not exists private;

create or replace function private.payment_proof_key_is_claimed(p_name text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.orders o
     where o.payment_proof_url = p_name
       -- Time-bounded so a reserved-but-unused key can't be uploaded to weeks
       -- later. The client uploads seconds after the RPC returns; two hours is
       -- slack for a slow phone, not a window worth attacking.
       and o.created_at > now() - interval '2 hours'
  );
$$;

revoke all on function private.payment_proof_key_is_claimed(text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.payment_proof_key_is_claimed(text) to anon, authenticated;

drop policy if exists "anyone can upload a payment proof" on storage.objects;
drop policy if exists "upload only a proof a committed order reserved" on storage.objects;

create policy "upload only a proof a committed order reserved"
  on storage.objects
  for insert
  to anon, authenticated
  with check (
    bucket_id = 'payment-proofs'
    and private.payment_proof_key_is_claimed(name)
  );

-- Deliberately NOT in this migration (see todo 017 major #5): bucket-level
-- file_size_limit / allowed_mime_types. Mobile has no client-side size guard,
-- so a 6 MB Android screenshot would start failing server-side with nothing
-- explaining why. That wants its own change with the client work done first.
