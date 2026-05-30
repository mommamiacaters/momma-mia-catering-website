---
status: pending
priority: p2
issue_id: "012"
tags: [code-review, quality, correctness, edge-function]
dependencies: []
---

# P2: order email — delivery fee missing → Total doesn't reconcile with item sum

## Problem Statement
The trigger sends `order.deliveryFeeCents` (+ status, orderType, subtotalCents, deliveryDate/Time), but
the function's `Payload` interface omits them and `renderHtml` shows only itemized lines + the
server-side **Total** (which includes the delivery fee). So on a delivery order the emailed line items
sum to **less** than the stated Total with no explanation — the one artifact a human reads looks like
"the math is wrong" (likely support ping). Also the `Payload` type is a partial guess vs the real
trigger JSON (drift risk).

## Findings (kieran-typescript-reviewer #3)
- `supabase/functions/order-notify/index.ts:28-33` (Payload omits fields), `renderHtml` (no fee row).
- Trigger sends them: `20260525092100_order_notify_via_edge_function.sql:54-75`.

## Proposed Solutions
**A (recommended):** render a Subtotal / Delivery / Total block; align `Payload` to the trigger's real
JSON so the type is the contract. (Delivery fee is 0 today, but the field exists and will be used.)
**B:** if delivery fee will never be used, trim it from BOTH trigger payload and Payload (keep
producer/consumer in sync) — coordinate with simplicity todo 015.

## Recommended Action
(blank — triage)

## Acceptance Criteria
- [ ] Email Total reconciles with the displayed lines (fee shown, or provably always 0 and omitted).
- [ ] `Payload` interface matches the trigger's emitted JSON.

## Work Log
- 2026-05-25: Filed from /workflows:review (kieran-typescript-reviewer #3).
