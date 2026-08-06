---
status: complete
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

- 2026-08-06: Audited. **PARTIAL — stays open.** A first reviewer called this FIXED; an
  adversarial second pass refuted that and was right.

  **Done:** the Subtotal / Delivery fee / Total block exists and is used by all three order
  templates (`order-notify/index.ts` `totalsBlock()`), and the `Payload` interface matches the
  trigger JSON field-for-field.

  **Was NOT done — a real double-render bug, found and FIXED the same day:** `itemRows()`
  computed a plan line's components by re-filtering the whole item array by `plan_instance_id`.
  That is a query, not a consume, so two plan lines sharing one `plan_instance_id` each emitted
  the same dishes — the rendered lines summed to DOUBLE the stated Total, which is verbatim the
  artifact this ticket exists to prevent. Reproduced with a fixture (Full Feast ×2 on one box id,
  ₱150 + ₱200 → rendered ₱700 vs Total ₱350), then fixed by grouping components into a Map once
  and DELETING each group as it is emitted. 13/13 assertions now pass, including "both plan lines
  still shown" and "priced lines sum to ₱350, not ₱700".

  create_order v5 rejects duplicate `plan_instance_id`s, so new orders can't produce this — but
  pre-v5 rows aren't covered by a constraint added afterwards, and rendering shouldn't depend on
  an invariant enforced elsewhere.

  **REMAINING (why this is still pending):** the fix is in source but the edge function has NOT
  been redeployed, so the live v10 bundle still has the bug. Redeploy `order-notify`, then close.

  **Also still open (the ticket's forward-looking half):** `create_order` sets
  `total_cents = v_subtotal` and ignores `delivery_fee_cents` entirely. It is 0 everywhere today,
  so the arithmetic holds — but the first time anyone sets a delivery fee, the receipt will render
  Subtotal + Delivery fee + a Total that excludes the fee. Worth a constraint or a recompute.

- 2026-08-06 (later): the double-render fix is now DEPLOYED — `order-notify` **v11**, ACTIVE,
  `verify_jwt` still false, smoke-tested (no token → 401, wrong token → 401, GET → 405).
  Acceptance criterion 1 (rendered lines reconcile with the stated Total) is therefore MET.
  This ticket now stays open ONLY for the delivery-fee half below.

- 2026-08-06 (final): **CLOSED.** Both halves are now done.

  Half 1 — line/Total reconciliation: the double-render in `itemRows()` was fixed and deployed
  (`order-notify` v11). 13/13 assertions pass, including "two plan lines sharing one
  plan_instance_id render each dish once" and "priced lines sum to ₱350, not ₱700".

  Half 2 — the delivery-fee trap: `create_order` set `total_cents = v_subtotal` and ignored
  `delivery_fee_cents` entirely, so the first fee anyone set would have produced a receipt showing
  Subtotal + Delivery fee + a Total that excluded the fee. Fixed as an INVARIANT rather than a
  one-site patch — migration `20260806170000` adds a BEFORE INSERT/UPDATE trigger
  `trg_orders_sync_total` that computes `total_cents = subtotal_cents + delivery_fee_cents` on
  every write, so it holds no matter which path sets the fee (create_order, a future admin edit,
  a manual UPDATE). create_order's own assignment is now a harmless no-op writing the same value.

  Verified against prod in a rolled-back transaction: a 15-box order totals 315000; adding a
  ₱50 delivery fee via a plain UPDATE moves it to 320000 and
  `total_cents = subtotal_cents + delivery_fee_cents` reports true. Checked before applying that
  0 of 8 existing rows violated the invariant, so no historical data changed.
