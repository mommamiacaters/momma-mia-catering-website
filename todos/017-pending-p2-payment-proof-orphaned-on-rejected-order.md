---
status: pending
priority: p2
issue_id: "017"
tags: [data-integrity, storage, checkout]
dependencies: []
---

# P2: a rejected order leaves the payment proof orphaned in storage

## Problem Statement
`submitOrder` uploads the payment-proof image to the private `payment-proofs` bucket and *then*
calls `create_order`, passing the resulting path as `p_payment_proof_url`. If the RPC raises,
the whole plpgsql transaction rolls back — no `orders` row, no `order_items` — but the uploaded
blob is already committed to storage and now has nothing referencing it.

Result: a private bucket that accumulates unreferenced customer payment screenshots (PII), with
no row to reconcile them against. Worse for the customer: they have already transferred money via
the InstaPay QR, and the only artefact of it is a file nobody will ever look at.

## Current mitigation (already shipped, reduces but does not remove the window)
`CheckoutPage.handleSubmit` calls `verifyMinimum()` — a cache-bypassing read of
`app_settings.minimum_meal_plans` — *before* `setStatus("submitting")`, and therefore before the
upload runs. The same check also runs before the payment QR is shown. So the common cause of a
late rejection (below-minimum cart) is caught ahead of the upload.

What remains is a genuine race plus the other raise paths in `create_order`:
item sold out (`is_available` flipped), meal plan deactivated, an admin raising the minimum
between the two reads, orphan-component/duplicate-box rejections.

## Why it wasn't fixed alongside the minimum work
`create_order` takes `p_payment_proof_url` as an **input parameter** and writes it in the same
INSERT. Uploading after a successful RPC would need either a second RPC or an anon-permitted
UPDATE on `public.orders` — a new write path and a new RLS surface, materially larger and riskier
than the feature it was attached to. Deferred deliberately rather than bolted on.

## Proposed Solutions
**A (recommended):** upload after the order exists. Add a narrow
`attach_payment_proof(p_order_id uuid, p_order_ref text, p_path text)` SECURITY DEFINER RPC that
sets `payment_proof_url` only when it is currently NULL and the ref matches. Client order becomes
create → upload → attach. Keeps the anon role off `orders` UPDATE entirely.
Note: the order-notify trigger fires on the finalize UPDATE, so the store email would send before
the proof is attached — either move the notify to fire on attach, or accept a proof-less first
email (the admin Orders view can show it once attached).

**B:** best-effort cleanup — on RPC failure, `remove()` the just-uploaded object. Simple and no
new SQL surface, but it is a client-side compensating action: it won't run if the tab closes or
the network drops, so it shrinks the leak rather than closing it.

**C:** a scheduled reconciliation (pg_cron) deleting objects in `payment-proofs` older than N days
with no matching `orders.payment_proof_url`. Complements A or B; also cleans up whatever has
already accumulated.

Recommend **A + C** (C to sweep existing orphans, which B cannot).

## Acceptance Criteria
- [ ] A `create_order` rejection leaves no unreferenced object in `payment-proofs`.
- [ ] A normal order still ends up with its proof attached and visible in `/admin`.
- [ ] Existing orphaned objects are identified and removed.

## Work Log
- 2026-08-06: Raised by the adversarial review of the order-minimum work; explicitly deferred
  there (rejected-for-that-change, logged rather than dropped) because it needs a new write path.
  Exposure narrowed the same day by running the minimum check before the upload.
