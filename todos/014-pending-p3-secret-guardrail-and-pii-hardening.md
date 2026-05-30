---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, security, data-integrity, defense-in-depth]
dependencies: []
---

# P3: defense-in-depth — secret-public guardrail, re-seed path, PII pruning, replay

## Problem Statement
A bundle of defense-in-depth items (RLS is already correct; these prevent operational footguns):
1. **`app_settings` secret could be flagged public by mistake.** `order_notify_secret`/`order_notify_url`
   are seeded out-of-band (not in a committed migration). A hand-typed `is_public => true` would expose
   the secret to every anonymous storefront visitor via `settingsService.fetchPublicSettings`. (RLS
   correctly hides it at `is_public=false` — the risk is a manual mistake.)
2. **`company_profile` is un-reseedable via the API.** No INSERT policy → if the singleton row is ever
   deleted, no admin can recreate it through the client; `notify_order_created` then reads NULL
   recipient forever (silently).
3. **PII in `net._http_response` / logs.** The trigger POSTs full customer PII; `pg_net` logs
   request/response rows; the success body returns `to`. Retained + broadly readable to project members.
4. **No replay protection** on the webhook (static secret, no timestamp/nonce/HMAC) — low impact
   (notification only), worth it only if the surface grows.

## Findings (security-sentinel P2-4/P3-1/P3-2 + data-integrity-guardian LOW #5)
- `app_settings` RLS: `20260522120000_phase4_app_settings.sql:29-37`; `settingsService.ts:29`.
- `company_profile`: `20260525083606…:35-42` (no insert/delete policy).
- Trigger PII payload: `20260525092100…:54-75`; function success body `index.ts:116` returns `to`.

## Proposed Solutions
1. DB CHECK/trigger: `is_public` must be false where key matches `%secret%`/`%token%`/`order_notify_%`;
   OR move the secret to Supabase Vault and read it via `vault.decrypted_secrets`.
2. Add a guarded admin INSERT policy on `company_profile` `with check (id = true)` (or document SQL-only re-seed).
3. Periodically prune `net._http_response`; drop `to` from the function's success body.
4. (Optional) HMAC-of-body + timestamp window if more callers appear.

## Recommended Action
(blank — triage)

## Acceptance Criteria
- [ ] The notify secret cannot be made publicly readable.
- [ ] `company_profile` singleton is recoverable if deleted.
- [ ] No customer PII echoed into the function success body.

## Work Log
- 2026-05-25: Filed from /workflows:review (security-sentinel P2-4/P3-1/P3-2 + data-integrity LOW#5).
