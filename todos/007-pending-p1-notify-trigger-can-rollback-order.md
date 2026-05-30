---
status: pending
priority: p1
issue_id: "007"
tags: [code-review, data-integrity, security, supabase, trigger]
dependencies: []
---

# P1: notify trigger can roll back a customer's checkout (unguarded body)

## Problem Statement
`notify_order_created()` runs **synchronously inside the `create_order` finalize UPDATE
transaction**. `net.http_post` itself is async (can't block — perf agent confirmed), BUT the
synchronous parts of the function can RAISE and roll back the order:
- **Malformed `order_notify_url`** (admin free-text in `app_settings`) → `net.http_post`'s argument
  validation raises **synchronously** (a typo like `htttp://…` or a bare host) → the finalizing
  `update public.orders` rolls back → **the customer's checkout fails**.
- If `pg_net` is ever dropped/disabled, `net.http_post` errors → **all order creation breaks**, not
  just emails.

The "notification never blocks the order" guarantee is therefore false on these paths. A single bad
character in one admin settings field takes down all ordering.

## Findings (data-integrity-guardian, HIGH)
- `supabase/migrations/20260525083606_company_profile_order_notify.sql:79` and
  `supabase/migrations/20260525092100_order_notify_via_edge_function.sql:44` — `perform net.http_post(...)`
  with `url := v_url` where `v_url` is admin free-text; no exception handling around the body.
- `if v_url is null or v_url = ''` guards empty but NOT malformed URLs.

## Proposed Solutions
**A (recommended):** wrap the entire notify body in an exception swallow so nothing it does can abort
the order:
```sql
begin
  -- select recipient/url/secret, jsonb_agg items, net.http_post(...)
exception when others then
  return new;  -- notification must NEVER fail an order
end;
```
Pros: bulletproofs the "never blocks the order" guarantee. Cons: silent notify failures (acceptable —
already fire-and-forget; pair with monitoring of `net._http_response`).
**B:** validate `v_url` with a regex before posting (`v_url ~ '^https?://'`) + keep going. Weaker
(doesn't cover pg_net-missing).

## Recommended Action
(blank — triage)

## Technical Details
Both migrations share the same un-guarded body; apply the `exception` wrapper in the create-or-replace
(`20260525092100…`). Depends on `create_order` finalize (`20260524132145_create_order_fn.sql:97-100`).

## Acceptance Criteria
- [ ] A malformed `order_notify_url` in `app_settings` does NOT fail `create_order` (order still commits).
- [ ] `pg_net` unavailable does not break order creation.
- [ ] Notification failures are swallowed (verified: bad URL → order ok, no email, no exception to client).

## Work Log
- 2026-05-25: Filed from /workflows:review (data-integrity-guardian HIGH #2).
