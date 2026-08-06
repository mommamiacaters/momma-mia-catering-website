---
status: pending
priority: p3
issue_id: "016"
tags: [security, supabase, defense-in-depth]
dependencies: []
---

# P3: `order_ref` is client-supplied and unvalidated in `create_order`

## Problem Statement
`p_order_ref` is generated client-side and inserted into `public.orders.order_ref` with no
format check (`create_order`, the `insert into public.orders` at the top of the body). A caller
hitting the RPC directly with the anon key can set it to anything — including newlines, HTML,
or a value that collides with a real reference.

It flows onward into the notification payload and into the email subject.

## Why this is P3 and not higher
The two exploitable consequences are already closed downstream:
- **Header injection**: `order-notify/index.ts` strips CR/LF from the subject before send
  (`subject.replace(/[\r\n]/g, " ").trim()`), and the only transport is Resend's JSON API —
  there is no raw-MIME path to inject into.
- **HTML injection**: every interpolation in the templates goes through `esc()`.

What remains is data hygiene rather than a live vulnerability: garbage references in the orders
table, and a possible duplicate/confusing reference on a kitchen ticket.

## Findings
- Split out of todo 011, where it was listed as "(Optional, defense-in-depth)" and explicitly
  outside that ticket's acceptance criteria. 011 is otherwise complete.
- `apps/web/src/services/orderService.ts` generates the ref via `generateSecureOrderRef()`;
  `apps/mobile/lib/orders.ts` via `makeOrderRef()`. Both produce `^[A-Za-z0-9-]+$` today — only
  a direct RPC call can deviate.

## Proposed Solutions
**A (recommended):** validate in `create_order` before the insert —
```sql
if p_order_ref is null or p_order_ref !~ '^[A-Za-z0-9-]{6,40}$' then
  raise exception 'Invalid order reference';
end if;
```
Cheap, matches the existing raise style, and both clients already comply.
Check both generators against the pattern before shipping.

**B:** a CHECK constraint on `public.orders.order_ref`. Stronger (covers every write path) but
would reject any legacy row that doesn't match — audit existing data first.

## Acceptance Criteria
- [ ] A crafted `p_order_ref` containing whitespace/newlines/control characters is rejected.
- [ ] Orders placed normally from web and mobile still succeed unchanged.

## Work Log
- 2026-08-06: Split out of todo 011 when that ticket was verified and closed.
