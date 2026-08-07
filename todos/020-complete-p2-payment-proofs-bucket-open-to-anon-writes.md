---
status: complete
priority: p2
issue_id: "020"
tags: [security, supabase, storage, rls, pii]
dependencies: ["017"]
---

# P2: anyone with the anon key can write arbitrary files into the private payment-proofs bucket

## Problem Statement
The only INSERT policy on the private `payment-proofs` bucket is unconditional. Verified against
production 2026-08-06 via `pg_policies`:

```
policyname : "anyone can upload a payment proof"
cmd        : INSERT
roles      : {public}
with_check : (bucket_id = 'payment-proofs'::text)
```

There is no size limit, no MIME restriction, no rate limit, and no tie to an actual order. The
`anon` key ships in the web bundle (it is designed to be public), so **any unauthenticated caller
can POST arbitrary files of arbitrary size into this bucket indefinitely** — a storage-cost and
abuse vector, and a private bucket holding customer payment screenshots is a bad place to let
strangers park content.

The bucket is genuinely private and reads are locked down — `"admins read payment proofs"` is
`SELECT … using (bucket_id = 'payment-proofs' and is_admin())` — so this is a WRITE-side problem,
not a disclosure one. Uploaded junk is not publicly readable.

Note there is also **no DELETE policy at all**. That is why todo 017's "Solution B" (have the client
delete its own orphan after a failed order) is inert: an anon `.remove()` matches no policy, deletes
nothing, and returns `data: [], error: null` — it fails *silently*.

## Why this is filed separately from 017
Narrowing this policy correctly requires knowing which keys are legitimate, and that only becomes
knowable once the SERVER mints the storage key (the core of the 017 design). Tightening it before
that would either break checkout or amount to security theatre.

**Ordering matters:** 017's client rewrite must ship and stale clients must drain BEFORE this policy
is narrowed, or a customer whose checkout tab predates the deploy uploads to a key the new policy
rejects and loses their payment proof silently. See blocker 2 in 017.

## Proposed Solution
Land as the second half of 017:
1. Restrict the role: `to anon, authenticated` rather than `public`.
2. Add the claim predicate, so a key can only be written if a committed order already reserves it:
   `with check (bucket_id = 'payment-proofs' and private.payment_proof_key_is_claimed(name))`.
3. Put that helper in a **`private` schema**, not `public` — PostgREST publishes `public` functions
   as unauthenticated RPCs, and this one would answer "does an order reference this key?" for any
   string an attacker supplies.

Deliberately NOT in scope here (see 017 major #5): bucket-level `file_size_limit` /
`allowed_mime_types`. Mobile has no client-side size guard, so a 6 MB Android screenshot would start
failing server-side with no user-facing explanation. That needs its own change with the client
prerequisite done first.

## Acceptance Criteria
- [ ] An anon caller cannot upload to `payment-proofs` without a committed order reserving the key.
- [ ] A normal web and mobile checkout still attaches its proof.
- [ ] The helper backing the policy is not reachable as a public PostgREST RPC.

## Work Log
- 2026-08-06: Found while designing 017 (storage/RLS mapping pass) and verified directly against
  production. Not fixed in isolation because the safe fix depends on 017 landing first.

## 2026-08-07 — RESOLVED

`20260807110000` applied, AFTER confirming the create_order v6 client bundle was live.

The unconditional `"anyone can upload a payment proof"` policy is replaced by
`"upload only a proof a committed order reserved"` — `to anon, authenticated`, with
`bucket_id = 'payment-proofs' and private.payment_proof_key_is_claimed(name)`.

The helper is in `private`, not `public`: PostgREST publishes public functions as unauthenticated
RPCs, and this one answers "does an order reference this exact key?" for any string — a free
existence oracle. RLS predicates evaluate as the caller, so anon still holds EXECUTE on it; keeping
it out of an exposed schema is what stops it also being callable directly. Claims are time-bounded
to 2 hours so a reserved-but-unused key can't be uploaded to weeks later.

### Verified with the REAL anon key over HTTP (the credential that ships in the web bundle)
- upload to an **unclaimed** key → **403** `new row violates row-level security policy`
- upload to a key a committed order **reserved** → **200**
- `POST /rest/v1/rpc/payment_proof_key_is_claimed` → **404**, not exposed
- test artefacts cleaned up; bucket left at 2 objects, 0 orphans

Deliberately NOT included (todo 017 major #5): bucket-level size/MIME limits — mobile has no
client-side size guard and would fail silently.
