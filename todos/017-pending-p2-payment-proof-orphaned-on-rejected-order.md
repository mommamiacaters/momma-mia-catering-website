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

---

## 2026-08-06 — designed + adversarially reviewed. NOT IMPLEMENTED. Read this before starting.

A 6-agent design pass produced a good core idea and then a 2-lens adversarial review found
**2 blockers and 4 majors in it**. The design is worth executing, but it rewrites the checkout
money path, so it needs a human watching. Do not ship it from an unattended session.

### The core insight (keep this — it is better than Solution A above)
**Invert who owns the storage key.** Have `create_order` MINT the path server-side and return it;
the client uploads only after the RPC has committed. Then "unreferenced object" stops being a bug
that cleanup chases and becomes an invariant — there is nothing to upload to until an order exists.

### ⚠️ Solution A as written above is DANGEROUS — do not implement it verbatim
`attach_payment_proof(order_id, order_ref, path)` takes a caller-supplied path and writes it into
`orders.payment_proof_url`. `order-notify/index.ts` interpolates that column straight into a
**service-role** storage fetch to attach the proof to the store email. A crafted path (traversal
into another bucket) would turn that RPC into a service-role read-and-exfiltrate primitive.
A server-minted key removes the caller-supplied path entirely, so the sink never opens.

### BLOCKERS found in the proposed design — fix before implementing
1. **A paid order could never reach the store.** The design defers the `notified_at` stamp until a
   second client round-trip ("confirm"). If the tab dies between `create_order` and confirm — flaky
   mobile data, app backgrounded, browser kills the tab — the order is committed and PAID but no
   email ever sends. That is strictly worse than the orphaned blob this ticket is about.
   **Fix: keep `create_order` stamping `notified_at` unconditionally, exactly as v5 does.**
2. **The deploy window silently destroys proofs.** A customer whose checkout tab was opened before
   the migration uploads to a client-minted `randomUUID()` key; the new claim-scoped storage policy
   denies it, and the order completes with no proof and no signal.
   **Fix: two deploys — server-minted path + client rewrite FIRST (policy left unconditional), then
   narrow the storage policy once stale clients have drained.**

### MAJORS (also fix)
3. `p_proof_uploaded` is client-supplied and can NULL a proof that actually landed (upload commits,
   response lost). Drop the flag; let the SECURITY DEFINER function check `storage.objects` itself.
4. "New orphans become structurally impossible" is overstated for the same lost-response reason —
   keep a reconciliation sweep (the todo's Solution C) in scope.
5. Don't add bucket `file_size_limit` / `allowed_mime_types` in the same change: mobile has no
   client-side guard, so a 6 MB Android screenshot would start silently failing.
6. Writing the reserved key into `payment_proof_url` at INSERT time makes the column stop meaning
   "bytes exist at this key". Either derive the key instead of storing it, or make consumers tolerate
   a dangling key (the Edge Function already 404-falls-back; the admin viewer would need to).

Minor: put the storage-policy helper in a `private` schema — anything in `public` is published as an
unauthenticated PostgREST RPC, and this one answers "does an order reference this key?" for any string.

### Separate live finding — worth its own ticket
`storage.objects` policy **`anyone can upload a payment proof`** is INSERT, role `public`,
`with check (bucket_id = 'payment-proofs')` — **unconditional**. Anyone holding the anon key that
ships in the web bundle can write arbitrary files of any size into this private PII bucket. Verified
against prod 2026-08-06. Narrowing it is part of the design above, which is why it is not fixed here.
There is also **no DELETE policy at all**, which is why Solution B is inert: an anon `.remove()`
deletes nothing and returns `data: [], error: null` — it fails silently.

### Orphan inventory (verified 2026-08-06; `payment_proof_url` stores the bare object name)
4 objects in `payment-proofs`, **3 unreferenced**:
- `97809bcf-8626-4a89-a007-7b4482e03a58.png` — 2026-05-24, ~0 MB
- `78a717ba-cb79-485d-9b23-4adac096b3d7.jpg` — 2026-05-24, **2.70 MB**
- `9159d37a-ee40-47c9-baa9-b2a1865154bd.png` — 2026-08-05, ~0 MB
Referenced: `b3e8c941-2052-4332-a0d3-27f8f7d4e752.jpg` (order MM-20260805-2244-9738) — KEEP.
Purge script ready at `<scratchpad>/purge-orphan-proofs.mjs` (dry-run by default). Not executed:
deleting customer payment evidence is irreversible, so it wants a human confirming the list.
