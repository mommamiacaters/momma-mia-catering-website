---
status: pending
priority: p2
issue_id: "009"
tags: [code-review, data-integrity, supabase, trigger]
dependencies: []
---

# P2: notify trigger keys off a mutable money column (0-total misses + double-fire)

## Problem Statement
The trigger fires `WHEN (old.total_cents = 0 AND new.total_cents > 0)` — using a mutable money value
as a "creation" flag. Two defects:
1. **Missed fire:** an order whose items legitimately sum to **0** (a `price_cents = 0` promo/sample —
   allowed by `menu_items.check(price_cents >= 0)`) does `0 → 0`, the WHEN is false, and **staff are
   never notified** of a real order.
2. **Future double-fire / mis-fire:** any later feature that re-sums `total_cents` (cancel+requote
   `>0→0→>0`, partial refund `5000→0→4000`) will re-trigger the email — though today only `status`
   is edited post-create.

## Findings (data-integrity-guardian, HIGH #1 + MEDIUM #3)
- `supabase/migrations/20260525083606_company_profile_order_notify.sql:123` — the `WHEN` clause.
- `create_order` finalize: `20260524132145_create_order_fn.sql:97-100` (sets total from 0 → sum).

## Proposed Solutions
**A (recommended):** add a `notified_at timestamptz` to `orders`, set it inside the function, and gate
`WHEN (new.notified_at is null)` → fires exactly once per order regardless of total mutations or $0.
**B:** notify directly from `create_order` after the final UPDATE (no trigger; explicit single fire).
**C:** gate on the finalize transition via subtotal/items presence rather than `total > 0`.

## Recommended Action
(blank — triage)

## Acceptance Criteria
- [ ] A $0 order (free item) still sends a notification.
- [ ] Re-summing an order's total later does NOT re-send (idempotent / once-per-order).

## Work Log
- 2026-05-25: Filed from /workflows:review (data-integrity-guardian HIGH#1 + MEDIUM#3).
