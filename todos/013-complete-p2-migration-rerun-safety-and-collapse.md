---
status: complete
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
- 2026-08-06: Re-verified as **STILL OPEN** during a staleness audit of all pending todos (007,
  008, 011, 009, 010, 012, 014, 015 all turned out to be already-fixed-but-unclosed; this one is
  real). Both files are byte-identical to their original commit `74e4096` — the non-idempotent
  `create table` / `create policy` / `create trigger` statements are untouched.

  **⚠️ Solution A is no longer valid — do not follow it as written.** It says "safe because
  nothing is deployed yet". Everything is now deployed to prod (`fbzwicfvhrtyfqjounvo`), so
  deleting `…092100` would rewrite applied migration history. Use **Solution B**: add the
  idempotency guards to `…083606` and keep both files.

  **Acceptance criterion 2 ("one source of truth for the trigger function body") is now
  obsolete**, not achievable-but-skipped: `notify_order_created` / `_order_notify_post` has been
  `create or replace`d several times since (`20260528120000` added the exception wrapper,
  `20260806103000` added the plan-grouping ids, and `20260806150000` — written, unapplied —
  repoints it at `_notify_config`). The last definition wins; the duplication is historical noise
  in files that have already run. Re-scope this ticket to criterion 1 only.

  Deliberately NOT auto-fixed: editing already-applied migrations unattended is the kind of change
  that wants a human watching a `db reset` afterwards.

- 2026-08-06: **CLOSED.** Criterion 1 done for both named files, criterion 2 formally dropped.

  `20260525083606_company_profile_order_notify.sql` — guards added (Solution B, since A's
  "nothing is deployed yet" premise is dead): `create table if not exists`, and
  `drop trigger/policy if exists` before each of `trg_company_profile_updated_at`,
  `"admins read company profile"`, `"admins update company profile"` and
  `trg_notify_order_created`. The `insert … on conflict do nothing`,
  `create extension if not exists` and `create or replace function` were already idempotent.
  Added a header warning that the file must not be re-run ALONE against an existing DB — its
  `trg_notify_order_created` is the original `total_cents`-based version, superseded by
  `20260528130000`; a full ordered replay is fine because the later migration corrects it.

  `20260525092100_order_notify_via_edge_function.sql` — needed nothing. It contains exactly one
  statement, `create or replace function`, which is already re-runnable. (The todo's premise that
  this file needed deleting was the "collapse" half, now obsolete.)

  Criterion 2 ("one source of truth for the trigger function body") is dropped as obsolete: the
  function has been `create or replace`d three more times since (20260528120000, 20260806103000,
  20260806150000). Last definition wins; the duplication is inert text in already-applied files.

  **Wider finding, filed separately as todo 019:** the same non-idempotency exists in 5 OTHER
  migrations, including the foundational schema ones. Not fixed here — see 019 for why.
