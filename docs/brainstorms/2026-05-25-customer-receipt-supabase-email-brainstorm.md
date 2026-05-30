---
date: 2026-05-25
topic: customer-receipt-supabase-email
---

# Supabase-native order emails — finish the company alert + add customer confirmation & delivery receipt

## What We're Building
Move all Momma Mia order email off the (offline) self-hosted n8n box onto the existing
Supabase Edge Function path. Three email events, all through ONE generalized `order-notify`
function selected by a `kind` discriminator:

| Event (DB trigger) | `kind` | Recipient | Template |
|---|---|---|---|
| Order finalized (`total 0 → >0`) | `store_alert` | `company_profile.order_notification_email` | store ops alert (exists) |
| Order finalized (`total 0 → >0`) | `customer_confirmation` | `orders.customer_email` | "We got your order!" (NEW) |
| Status → `delivered` (admin) | `customer_receipt` | `orders.customer_email` | itemized Grab-style receipt (NEW) |

## Why This Approach
- **n8n is dead infra** (TCP connect times out; host offline) — diagnosed in the decision doc.
  No config fixes a down box, so the critical, deliverability-sensitive path moves in-platform.
- **Reuse, don't rebuild.** The `order-notify` function, `company_profile` recipient, `pg_net`
  trigger, and shared-secret auth already exist and the trigger→function hop is verified reachable.
  We extend rather than add new functions: one provider integration, one secret, one set of logs.
- **One POST per email** (not one per event). The finalize trigger fires two POSTs (store +
  customer); delivery fires one. Each email is independent — a customer-send failure can't suppress
  the store alert, and each lands as its own `net._http_response` row for debugging.

## Key Decisions
- **Provider: Resend** — simplest from Deno (one fetch, no SDK), and already used in the H365 portal.
- **Customer gets two emails** (Grab parity): instant confirmation on submit + receipt on delivery.
- **Receipt = itemized HTML, NO payment-proof image** — Grab never shows your payment screenshot
  back; the proof stays a store-only artifact.
- **`kind` discriminator over separate functions** — shared peso/escape/HTML-shell helpers; subject +
  body branch on `kind`. Recipient passed explicitly as `to` (back-compat: fall back to legacy
  `notificationEmail` ⇒ treated as `store_alert`).
- **Delivery trigger guarded `new.status='delivered' AND old.status<>'delivered'`** — idempotent
  against repeated saves; total unchanged so it can't collide with the finalize trigger.
- **DRY the SQL** via a `_order_notify_post(p_kind, p_to, p_order_id)` helper so finalize + delivery
  build the identical payload shape in one place.

## Open Questions
- Seeding `app_settings.order_notify_url` / `order_notify_secret` + deploy + Resend domain verify are
  **user steps** (CLI + console). Captured as a runbook, not blocking the code.

## Next Steps
→ Implement: generalize `order-notify/index.ts` (3 templates) + new migration (helper + extend
  finalize + add delivery trigger) + seed/deploy runbook.
