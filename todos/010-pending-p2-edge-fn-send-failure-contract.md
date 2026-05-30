---
status: pending
priority: p2
issue_id: "010"
tags: [code-review, reliability, edge-function]
dependencies: []
---

# P2: Edge Function returns 500 on send failure → duplicate emails under any retry layer

## Problem Statement
On a provider failure (Resend 429/5xx, SES throttle) the function returns **HTTP 500**
(`index.ts:113`). Today `pg_net` is fire-and-forget so nothing retries — but the function's own header
says it'll "later be replaced by a Supabase Database Webhook," which **does retry on non-2xx**. At that
point a transient failure → re-invoke → **duplicate store emails**, or a provider that
accepted-then-errored → double-send. The contract (at-most-once vs at-least-once) is unspecified.

## Findings (kieran-typescript-reviewer #1)
- `supabase/functions/order-notify/index.ts:104-114` — `catch` returns 500.

## Proposed Solutions
**A (recommended, matches "never block the order" philosophy):** log + return **200** on provider
errors → at-most-once; accept the rare dropped email (monitor logs). Document the choice at line 113.
**B:** keep 500 but add an idempotency key (e.g. `orderRef`) so a retry layer dedupes.

## Recommended Action
(blank — triage)

## Acceptance Criteria
- [ ] The 200-vs-500 semantics are explicit + documented in the function.
- [ ] Under a retry layer, an order does not produce duplicate notification emails.

## Work Log
- 2026-05-25: Filed from /workflows:review (kieran-typescript-reviewer #1).
