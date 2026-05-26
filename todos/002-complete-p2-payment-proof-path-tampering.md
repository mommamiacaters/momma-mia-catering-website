---
status: complete
priority: p2
issue_id: "002"
tags: [code-review, security, supabase, storage]
dependencies: ["001"]
---

# P2: Payment-proof storage path is guessable + any caller can overwrite

## Problem Statement
Proof upload path is `${orderRef}/proof.${ext}` with `upsert: true`, and the storage
INSERT policy is `with check (bucket_id = 'payment-proofs')` with no owner/path scoping.
`orderRef` (`MM-YYYYMMDD-HHMM-xxxx`) has only ~4 chars of base36 entropy, so an attacker
who guesses/knows an orderRef can **overwrite a customer's payment proof** before an admin
reviews it (integrity/tampering). Read is admin-only, so no disclosure.

## Findings (security-sentinel #3/#4)
- `apps/mobile/lib/orders.ts:56-59` — time-based path + `upsert: true`.
- `supabase/migrations/20260521231036_phase1_catalog_orders.sql:195-197` — unscoped insert policy.

## Proposed Solutions
**A (recommended, folds into 001):** when order creation moves server-side, name the proof
path by the server-generated UUID order id (unguessable), drop `upsert`, and/or return a
signed upload URL. Scope the storage policy so a path can't be overwritten.
**B (standalone):** use the random `orderId` (UUID) instead of `orderRef` in the path now,
drop `upsert`, and tighten the storage policy to prevent overwrite.

## Recommended Action
(blank — triage)

## Technical Details
`apps/mobile/lib/orders.ts` proof path; `storage.objects` policies on `payment-proofs`.

## Acceptance Criteria
- [x] Proof object path is unguessable (UUID-based).
- [x] A second upload to an existing proof path cannot silently overwrite it.

## Work Log
- 2026-05-24: Filed from /workflows:review (security-sentinel #3/#4).
- 2026-05-24: DONE. Path now `${randomToken()}.${ext}` (mobile `lib/orders.ts`: crypto.randomUUID
  w/ high-entropy fallback, no new dep) / `${crypto.randomUUID()}.${ext}` (web `orderService.ts`),
  both with `upsert:false` (was client `orderRef` + `upsert:true`). No code reconstructs the path
  from order_ref (admin reads stored `payment_proof_url`), so the scheme change is safe. Storage
  policy left insert-only (no UPDATE policy ⇒ overwrite impossible regardless). Both apps tsc clean.
