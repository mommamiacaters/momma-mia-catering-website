---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, security, data-integrity, supabase, backend]
dependencies: []
---

# P1: Move order creation server-side (prices/totals/client_id are client-trusted)

## Problem Statement
Orders are created by a **direct client INSERT** into `orders`/`order_items` with RLS
`with check (true)`. The client computes `subtotal_cents`/`total_cents` and sends
`unit_price_cents` per line and `client_id`. Nothing server-side validates any of it.
A modified client (or anyone with the publishable key + the public schema) can:
- order real food for **₱0** (`total_cents: 1`, `unit_price_cents: 0`) with a forged proof,
- insert `item_name`s not in the catalog,
- set `client_id` to **another user's UID** (spoof an order into their history) or omit it.

This is a revenue/integrity hole, not theoretical. **The web `orderService.ts` has the
identical pattern** — fix both consumers via one server-side path.

Related (subsumed by the fix): silent `order_items` partial-insert failure (an order can
save with **zero line items** yet show the success screen — `lib/orders.ts:103-106`), and
the `Math.random` client-side PK (`lib/orders.ts:6-13`).

## Findings (from security-sentinel + kieran-typescript)
- `apps/mobile/lib/orders.ts:67-106` — client sends prices/totals/client_id; items insert is non-throwing.
- `supabase/migrations/20260521231036_phase1_catalog_orders.sql:162-168` — `with check (true)` insert policies.
- `apps/web/src/services/orderService.ts` — same client-side insert (parity).

## Proposed Solutions
**A. SECURITY DEFINER RPC `create_order(items jsonb, customer jsonb)` (recommended)**
- Looks up `price_cents` from `menu_items` by id; recomputes subtotal/total; rejects unknown/unavailable items; forces `client_id := auth.uid()` (null allowed only for guests); inserts order + items atomically; returns `{order_ref}`.
- Drop the `with check (true)` insert policies; grant insert only via the function.
- Pros: closes prices/totals/client_id/atomicity in one place; both apps call it. Cons: web + mobile both must switch to the RPC; ~half a day.
**B. Keep client insert + add RLS CHECK constraints** — partial only (can't recompute totals in RLS); rejected.

## Recommended Action
(blank — triage)

## Technical Details
Affected: new `supabase/migrations/*_create_order_fn.sql`, `apps/mobile/lib/orders.ts`, `apps/web/src/services/orderService.ts`, RLS policies on `orders`/`order_items`. DB `id` default `gen_random_uuid()` already exists → drop client UUID.

## Acceptance Criteria
- [ ] An order POSTed with tampered `unit_price_cents`/`total_cents` is rejected or recomputed to the true menu price.
- [ ] `client_id` is forced to `auth.uid()` (or null for guest); cannot be set to another user's id.
- [ ] Order + line items are inserted atomically; a line-items failure fails the whole order (no empty orders).
- [ ] Both mobile + web checkout use the new path; client no longer generates the PK.

## Work Log
- 2026-05-24: Filed from /workflows:review (security-sentinel #1/#2/#5, kieran #1/#2).
- 2026-05-24: RESOLVED via `/workflows:plan` → `/workflows:work`. Plan:
  `docs/plans/2026-05-24-fix-server-side-order-creation-rpc-plan.md`. Approach: Option 2 —
  unified by-id `create_order` SECURITY DEFINER RPC (search_path=''); both apps converted.
  - Migration `supabase/migrations/20260524132145_create_order_fn.sql` (applied to dev
    `fbzwicfvhrtyfqjounvo`). Drops both `with check (true)` insert policies + revokes INSERT;
    grants EXECUTE to anon/authenticated.
  - Mobile `apps/mobile/lib/orders.ts` → `rpc('create_order')`; dropped uuidv4/subtotal/inserts;
    null-price add-guard in `QtyControl` + item detail. `create_order` added to
    `packages/db/src/database.types.ts`. tsc clean.
  - Web threaded `menuItemId` (menuService→AssignedItem→OrderSubmission→CheckoutPage) +
    `orderService.ts` → `rpc('create_order')` (kept proof upload + n8n). tsc clean.
  - VERIFIED on dev: happy/unknown/atomicity/guest scenarios pass; **anon direct INSERT → 401
    "permission denied for table orders"** (hole closed); anon `create_order` RPC → 200
    (guest checkout works, server-computed total). Name-based web rejected after DB evidence
    (6 dup names diverge ₱70/₱120). Pricing parity holds: uniform per-type price + complete-plan
    gate ⇒ Σ(catalog price) ≡ web bundle price.
  - UI SMOKES DONE (2026-05-24): **Mobile** emulator tap-through (Swedish Meatballs → cart →
    checkout → place) → order `MM-20260524-2330-f8g7`: client_id null, total 7000, menu_item_id
    set. **Web** Playwright meal-plan checkout (Balanced Diet: main+side+starch → proof upload →
    submit) → order `MM-20260524-2335-00d8`: client_id null, total **19500 = bundle price**,
    all 3 menu_item_ids captured, plan_type preserved, proof path UUID-based (002). Both test
    orders deleted after verification. The same Swedish Meatballs UUID priced identically in both
    apps — parity proven with real data. (70-byte test proof left orphaned in private bucket.)

## Resources
- security-sentinel + kieran-typescript-reviewer review findings, 2026-05-24.
