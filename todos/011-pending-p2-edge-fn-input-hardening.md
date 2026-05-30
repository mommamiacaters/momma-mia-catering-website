---
status: pending
priority: p2
issue_id: "011"
tags: [code-review, security, edge-function]
dependencies: ["008"]
---

# P2: Edge Function input hardening — constant-time secret, CRLF subject, recipient validation

## Problem Statement
Three hardening gaps on the send path (all in `order-notify/index.ts`):
1. **Non-constant-time secret compare** (`:87`, `!==`) → timing oracle; with `verify_jwt=false` anyone
   can hammer it to leak the secret byte-by-byte.
2. **Email header injection via subject** (`:101`) — `order_ref` flows into the subject with no `esc()`
   / no CRLF strip; `order_ref` is client-supplied to `create_order` and not validated, so a crafted
   ref with newlines can inject headers (esp. the SES path / any future raw-MIME).
3. **Unvalidated recipient** (`:98`) — `to` is never format-checked server-side (combines with the
   open-relay risk in 008).

## Findings (security-sentinel P2-2 + P2-3)
- `supabase/functions/order-notify/index.ts:87, 98, 101`.
- `apps/web/src/services/orderService.ts:71` (client-supplied `p_order_ref`, unvalidated in the RPC).

## Proposed Solutions
- Constant-time compare via `timingSafeEqual` over equal-length encoded buffers.
- `subject = subject.replace(/[\r\n]/g, " ")` before send.
- Validate `to` against an email regex; reject otherwise.
- (Optional, defense-in-depth) constrain `order_ref` to `^[A-Za-z0-9-]+$` inside `create_order`.

## Recommended Action
(blank — triage)

## Acceptance Criteria
- [ ] Secret comparison is constant-time.
- [ ] CR/LF stripped from subject; malformed recipient rejected.

## Work Log
- 2026-05-25: Filed from /workflows:review (security-sentinel P2-2/P2-3). Depends on 008 (fail-closed auth).
