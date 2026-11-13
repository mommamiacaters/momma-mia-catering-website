-- ============================================================================
-- One-off: archive the pre-launch TEST orders and quote requests, then empty
-- the live tables so the admin console starts clean.
--
-- NOT a migration. Run once in the Supabase SQL editor (project fbzwicfvhrtyfqjounvo).
-- All-or-nothing: if any count check fails, nothing changes.
--
-- What it does
--   1. Creates schema `archive` (NOT exposed to the API: anon/authenticated get no access).
--   2. Copies orders, order_items and quote_requests into archive.* with a moved_at stamp.
--   3. Verifies the copies match row-for-row.
--   4. Deletes the originals (order_items go with their orders via ON DELETE CASCADE).
--
-- Expected at time of writing (2026-11-12): 16 orders, 1940 order_items, 5 quote_requests.
-- Triggers on orders/quote_requests fire on INSERT/UPDATE only, so no emails are sent.
-- Why not the in-app Archived tab (orders.archived_at)? That keeps test rows visible
-- in the admin console; the goal is empty live tables for launch.
-- Payment-proof files in Storage (bucket payment-proofs, ~3 MB) are left untouched.
--
-- Restore later (if ever needed): copy rows back from archive.* listing every
-- column except moved_at (orders first, then order_items).
-- ============================================================================

begin;

create schema if not exists archive;
revoke all on schema archive from public, anon, authenticated;

create table if not exists archive.orders         (like public.orders         including defaults);
create table if not exists archive.order_items    (like public.order_items    including defaults);
create table if not exists archive.quote_requests (like public.quote_requests including defaults);

-- `moved_at` (not archived_at): public.orders already has its own archived_at
-- column for the admin console's in-app "Archived" tab, and `like` copies it.
alter table archive.orders         add column if not exists moved_at timestamptz not null default now();
alter table archive.order_items    add column if not exists moved_at timestamptz not null default now();
alter table archive.quote_requests add column if not exists moved_at timestamptz not null default now();

revoke all on all tables in schema archive from public, anon, authenticated;

insert into archive.orders         select o.*,  now() from public.orders o;
insert into archive.order_items    select oi.*, now() from public.order_items oi;
insert into archive.quote_requests select q.*,  now() from public.quote_requests q;

do $$
declare
  n_o  bigint := (select count(*) from public.orders);
  n_oi bigint := (select count(*) from public.order_items);
  n_q  bigint := (select count(*) from public.quote_requests);
  a_o  bigint := (select count(*) from archive.orders         o  where exists (select 1 from public.orders         p where p.id = o.id));
  a_oi bigint := (select count(*) from archive.order_items    oi where exists (select 1 from public.order_items    p where p.id = oi.id));
  a_q  bigint := (select count(*) from archive.quote_requests q  where exists (select 1 from public.quote_requests p where p.id = q.id));
begin
  if n_o <> a_o or n_oi <> a_oi or n_q <> a_q then
    raise exception 'Archive mismatch: orders %/%, items %/%, quotes %/% — rolled back', a_o, n_o, a_oi, n_oi, a_q, n_q;
  end if;
  raise notice 'Archived % orders, % order_items, % quote_requests', a_o, a_oi, a_q;
end $$;

delete from public.orders;          -- cascades to public.order_items
delete from public.quote_requests;

do $$
begin
  if exists (select 1 from public.orders) or exists (select 1 from public.order_items) or exists (select 1 from public.quote_requests) then
    raise exception 'Live tables not empty after delete — rolled back';
  end if;
end $$;

commit;

-- Check afterwards:
-- select (select count(*) from archive.orders) archived_orders,
--        (select count(*) from archive.order_items) archived_items,
--        (select count(*) from archive.quote_requests) archived_quotes,
--        (select count(*) from public.orders) live_orders;
