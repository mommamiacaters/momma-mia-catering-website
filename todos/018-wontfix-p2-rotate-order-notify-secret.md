---
status: wontfix
priority: p2
issue_id: "018"
tags: [security, supabase, vault, secrets]
dependencies: []
---

# P2: rotate `order_notify_secret` — it was admin-readable for months

## Problem Statement
The shared secret that authenticates the DB triggers to the `order-notify` Edge Function sat in
`public.app_settings`, whose policy is `FOR ALL USING (is_admin())`. RLS filters ROWS, never
COLUMNS, so every admin session that loaded `/admin/settings` received the secret in the
`fetchAllSettings()` network response — `AdminSettings.tsx` only filtered it out of the rendered
list. That was true from the day the setting was created until 2026-08-06.

The **exposure** is fixed (migrations `20260806150000` + `20260806160000` moved both values into
Supabase Vault; `app_settings` no longer holds them). The **value itself** should still be treated
as compromised and rotated.

## Why this is not urgent-but-should-happen
Anyone holding the old secret can POST arbitrary payloads to the `order-notify` function and send
mail from the DKIM-signed `mommamiacaters.com` domain. That requires having been an authenticated
admin at some point, so the realistic blast radius is small — but the whole point of rotating after
an exposure is not to have to reason about who saw it.

## The trap — this is a TWO-SYSTEM ATOMIC change
The secret exists in two places that must match:
1. `vault.secrets` (name `order_notify_secret`) — read by `public._notify_config()`.
2. The Edge Function's `ORDER_NOTIFY_SECRET` env var — compared against the inbound
   `X-MM-Auth-Token` with `timingSafeEqual`.

If they drift, `order-notify` returns 401 for every trigger call. **That failure is SILENT**: the
notify functions wrap their bodies in `exception when others` (todo 007), so a rejected send
becomes a pg WARNING — no email, no error, the order still succeeds. You would only notice by
missing emails or by reading `net._http_response`.

## Proposed Solution
1. Generate a new 48-char token (matches the current length).
2. Set it on the function first — it accepts only the new value from that moment, so do this in a
   quiet window: `supabase secrets set ORDER_NOTIFY_SECRET=…` (or the Management API; note the
   CLI is not installed on the maintainer's machine — see the prod-ops notes).
3. Immediately update the vault copy — **`vault.update_secret(id, new_secret)`**, not a
   re-`create_secret`, so the name/id stay stable:
   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'order_notify_secret'),
     '<new token>');
   ```
4. Verify with a REAL order (not a rolled-back one — you need the send to actually happen) and
   confirm the store alert + customer confirmation both arrive.
5. Optionally check `net._http_response` for any 401s during the changeover window.

## Acceptance Criteria
- [ ] A new secret is set in BOTH the vault and the Edge Function env.
- [ ] A real order produces the store alert and the customer confirmation.
- [ ] No 401s from `order-notify` after the changeover.

## Work Log
- 2026-08-06: Filed when the exposure itself was fixed by the Vault move. Deliberately NOT done
  unattended: the two-system atomicity plus the silent-failure mode make this a watch-it-happen
  change, and verifying it requires actually sending mail.

- 2026-08-06: **CLOSED AS WON'T-DO — explicit maintainer decision.** Not to be re-raised.
  The *exposure* is fixed regardless (the secret is out of `app_settings` and in Vault); this
  ticket only covered rotating the value itself. Recorded rather than deleted so the context
  isn't lost if the decision is ever revisited.
