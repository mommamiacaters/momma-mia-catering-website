---
status: pending
priority: p1
issue_id: "008"
tags: [code-review, security, edge-function, email]
dependencies: []
---

# P1: order-notify Edge Function fails OPEN → open email relay (deploy-blocker)

## Problem Statement
The function's auth check is guarded by `NOTIFY_SECRET &&` — so if `ORDER_NOTIFY_SECRET` is empty/unset
(an easy deploy misconfig), the function (deployed `verify_jwt=false`) accepts **any POST from anyone**.
Once an email provider key is set but the operator forgets the secret, it's a live **open relay**:
an attacker who learns the URL can send arbitrary emails to any `notificationEmail` they supply, with
attacker-controlled content, **from your DKIM-signed `mommamiacaters.com` domain** (phishing +
domain-reputation blast radius). Must be closed before deploy.

## Findings (security-sentinel, P2 → escalated to P1 as a deploy-blocker)
- `supabase/functions/order-notify/index.ts:87` — `if (NOTIFY_SECRET && req.headers.get(...) !== NOTIFY_SECRET)` — fail-open when secret is empty.

## Proposed Solutions
**A (recommended):** fail closed —
```ts
if (!NOTIFY_SECRET) return new Response("server misconfigured", { status: 503 });
if (req.headers.get("x-mm-auth-token") !== NOTIFY_SECRET) return new Response("unauthorized", { status: 401 });
```
Pros: no open-relay window; loud misconfig. Cons: none.
(Pair with constant-time compare — see todo 011.)

## Recommended Action
(blank — triage)

## Technical Details
`apps/mobile`… N/A. File: `supabase/functions/order-notify/index.ts`. Deployed with
`[functions.order-notify] verify_jwt = false` (config.toml), so this header check is the ONLY auth.

## Acceptance Criteria
- [ ] With `ORDER_NOTIFY_SECRET` unset, the function rejects all requests (503/401), never sends.
- [ ] With it set, only requests carrying the matching `X-MM-Auth-Token` are accepted.

## Work Log
- 2026-05-25: Filed from /workflows:review (security-sentinel P2-1; escalated — deploy-blocker, sends from verified domain).
