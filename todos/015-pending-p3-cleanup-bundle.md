---
status: pending
priority: p3
issue_id: "015"
tags: [code-review, quality, simplicity, cleanup]
dependencies: []
---

# P3: cleanup bundle — provider YAGNI, ₱NaN, form validation, stale comment

## Problem Statement
Low-risk quality/simplicity items from the review:
1. **Dual email providers (YAGNI).** The function ships both Resend AND SES (`sendSes` + 4 `AWS_*`
   reads + heavy `npm:@aws-sdk/client-sesv2@3` dynamic import) before either is deployed. Pick ONE
   (Resend is the documented simplest path; keep SES only if it's the real org target). If keeping
   SES, **pin the version** (`@3.700.0`, not floating `@3`) and distinguish import vs send errors.
2. **`₱NaN` risk** (`index.ts:42`) — `unit_price_cents * qty` is `NaN` if a field is missing (`peso`'s
   `= 0` default only catches `undefined`, not `NaN`). Coerce: `peso((i.unit_price_cents ?? 0) * (i.qty ?? 0))`.
3. **`contact_email` not validated** (`AdminCompanyProfile.tsx:73,139`) — `type="email"` never fires
   (button is `type="button"`); a malformed contact email saves. Run `isEmail` before save.
4. **Dirty-tracking via `JSON.stringify`** (`AdminCompanyProfile.tsx:66`) — key-order-fragile foot-gun;
   replace with explicit per-key compare over `Object.keys(EMPTY)`.
5. **Stale comment** in `orderService.ts:14-18` still says "the n8n webhook is fired best-effort
   afterwards" — false now (notification is server-side). Delete/fix.
6. **`dataUriToBlob` parse not guarded** (`orderService.ts:25-38`) — a malformed proof data-URI throws
   in `atob` and aborts the whole order before the RPC; move the parse inside the existing non-fatal
   proof-upload guard so a bad proof degrades to "no proof," not a failed order.
7. Cosmetic: subject double-space when `orderRef` missing (`index.ts:101`).

## Findings (code-simplicity-reviewer #2/#3 + kieran-typescript-reviewer #2/#4/#5/#6 + minors)

## Proposed Solutions
Address individually; each is small and independent. Coordinate item 1 with todo 012 (Payload/fee).

## Recommended Action
(blank — triage)

## Acceptance Criteria
- [ ] One email provider (or SES pinned). No `₱NaN` in emails. contact_email validated.
- [ ] Stale orderService comment removed; bad proof data-URI never fails the order.

## Work Log
- 2026-05-25: Filed from /workflows:review (code-simplicity #2/#3 + kieran #2/#4/#5/#6).
