---
status: pending
priority: p3
issue_id: "019"
tags: [data-integrity, supabase, migration, tooling]
dependencies: []
---

# P3: five more migrations are not re-run safe (the rest of the 013 class)

## Problem Statement
Todo 013 fixed `20260525083606`. An audit of all 26 migrations found the same non-idempotent DDL
in **5 more**, including the foundational schema files. A `db reset`, a partial replay, a preview
branch, or a re-paste into the SQL editor hard-fails part-way through and leaves the database
half-migrated — which is worse than failing cleanly, because the failure point is arbitrary.

## Inventory (audited 2026-08-06)

| Migration | Issues |
|---|---|
| `20260521231036_phase1_catalog_orders.sql` | 5× `create table`, 7× `create policy`, 3× `create trigger`, 7× `create index`, 2× `create type` — all unguarded |
| `20260522000853_phase2_auth_roles.sql` | 1× `create table`, 9× `create policy`, 3× `create trigger`, 1× `create type` |
| `20260522005030_phase3_admin_menu_images.sql` | 1× `create policy` |
| `20260522120000_phase4_app_settings.sql` | 1× `create table`, 2× `create policy`, 1× `create trigger` |
| `20260805120000_meal_plans_and_sub_categories.sql` | 2× `create trigger` |

Everything from `20260525083606` onward is otherwise clean (`create or replace function`,
`create … if not exists`, `drop … if exists` before create, `on conflict do nothing`).

## Why this wasn't fixed alongside 013
Two reasons, both about verification rather than effort:

1. **It can't be verified here.** Proving a replay works means actually running one — `supabase db
   reset` against a local or branch database. Neither the Supabase CLI nor a local Postgres is
   installed on the maintainer's machine (all prod work goes through the Management API). Static
   edits to foundational schema migrations that nobody can replay are exactly the kind of change
   that looks fine and isn't.
2. **`create type` has no `IF NOT EXISTS`.** Those two need a `do $$ begin … exception when
   duplicate_object then null; end $$;` wrapper rather than a one-word edit, so this is not a
   pure find-and-replace.

## Proposed Solution
Do it in one pass, with a replay to prove it:
1. `create table X` → `create table if not exists X`.
2. `create index` → `create index if not exists`.
3. Prepend `drop policy if exists "…" on <table>;` to every `create policy`.
4. Prepend `drop trigger if exists <name> on <table>;` to every `create trigger`.
5. Wrap each `create type` in a `duplicate_object` exception block.
6. **Verify with an actual `supabase db reset`** (needs the CLI) — twice, to prove the second run
   is a clean no-op. Without step 6 this ticket should not be closed.

Note the same caveat 013 carries: several of these files define objects that LATER migrations
supersede. Re-running one file alone against a live database can therefore revert an object to an
older definition. Replay is only safe in full migration order.

## Acceptance Criteria
- [ ] All 26 migrations re-run cleanly from scratch.
- [ ] A second consecutive replay is a no-op (no errors, no duplicate objects).
- [ ] No migration file's *behaviour* changed — guards only.

## Work Log
- 2026-08-06: Filed from the migration audit done while closing 013.
