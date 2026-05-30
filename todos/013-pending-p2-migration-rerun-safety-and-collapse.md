---
status: pending
priority: p2
issue_id: "013"
tags: [code-review, data-integrity, simplicity, supabase, migration]
dependencies: []
---

# P2: migration not re-run safe + collapse the two notify migrations into one

## Problem Statement
Two related issues on the same migrations:
1. **Not re-run safe:** `create table public.company_profile` (no `if not exists`), `create policy`
   (no `drop … if exists`), and `create trigger trg_notify_order_created` (no `drop … if exists`) all
   **hard-fail on re-run** — breaks `db reset` partial replays, SQL-editor re-paste, preview DBs. The
   function is `create or replace` (idempotent) but the table/trigger/policies aren't — mixed
   idempotency is exactly what yields a partially-applied migration on failure.
2. **Duplication:** `20260525092100…` re-emits the entire ~70-line `notify_order_created()` body just
   to change the two `app_settings` key names + the timeout. Since the feature is **undeployed**, the
   clean move is to edit the first migration in place and **delete the second** → one source of truth
   for the payload.

## Findings (data-integrity-guardian MEDIUM #4 + code-simplicity-reviewer #1)
- `20260525083606_company_profile_order_notify.sql:17, 29, 35, 39, 120` (non-idempotent DDL).
- `20260525092100_order_notify_via_edge_function.sql` (full-function restatement).

## Proposed Solutions
**A (recommended):** collapse into the single migration `…083606` — use `order_notify_url/secret` keys
+ 10s timeout directly, make DDL idempotent (`create table if not exists`, `drop trigger/policy if
exists` before create), delete `…092100`. (Safe because nothing is deployed yet.)
**B:** if migration history must be preserved, keep both but add the idempotency guards to `…083606`.

## Recommended Action
(blank — triage)

## Acceptance Criteria
- [ ] The migration(s) re-run cleanly (idempotent DDL).
- [ ] One source of truth for the trigger function body.

## Work Log
- 2026-05-25: Filed from /workflows:review (data-integrity-guardian MEDIUM#4 + code-simplicity #1).
