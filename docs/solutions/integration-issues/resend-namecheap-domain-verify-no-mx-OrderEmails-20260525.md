---
module: Order Emails
date: 2026-05-25
problem_type: integration_issue
component: email_processing
symptoms:
  - "Namecheap Advanced DNS 'Type' dropdown has no 'MX Record' option, so Resend's required MX can't be added"
  - "Resend domain stays Unverified; sending to real customers rejected with 'can only send testing emails to your own email address'"
  - "Resend API GET /domains returns 401 {\"name\":\"restricted_api_key\",\"message\":\"This API key is restricted to only send emails\"}"
root_cause: config_error
resolution_type: config_change
severity: high
tags: [resend, namecheap, mx-record, dkim, supabase-edge-function, transactional-email, dns-verification, send-only-key]
---

# Troubleshooting: Resend transactional email won't verify/send (Namecheap MX missing + send-only key + test-mode gate)

## Problem
After moving Momma Mia order email from the (offline) self-hosted n8n to a Supabase Edge Function
(`order-notify`) sending via Resend, three separate, individually-confusing blockers stopped
customer-facing email from working. Each looks like a different failure but they're all
configuration gates between Resend, Namecheap DNS, and the Resend API key's scope.

## Environment
- Module: Order Emails (Supabase-native pipeline)
- Stack: Supabase Edge Functions (Deno) + Resend; DNS on **Namecheap**; site on GitHub Pages
- Project ref: `fbzwicfvhrtyfqjounvo` (Momma Mia dev)
- Affected Component: `supabase/functions/order-notify/index.ts` + Resend domain `mommamiacaters.com`
- Date: 2026-05-25

## Symptoms
- In Namecheap → **Advanced DNS → Host Records → Add New Record**, the **Type** dropdown lists A,
  AAAA, ALIAS, CAA, CNAME, NS, SRV, TXT, URL Redirect — **but no "MX Record"**. Resend's
  `send → feedback-smtp.<region>.amazonses.com` MX therefore cannot be entered.
- Resend domain card shows **Unverified**; sends to arbitrary recipients fail. In unverified/test
  mode Resend only allows **from `onboarding@resend.dev`** and **to the account-owner email**.
- Trying to read the domain's DNS records programmatically (`GET https://api.resend.com/domains`
  with the app's API key) returns **401 `restricted_api_key`** — the key is send-only.

## What Didn't Work

**Attempt 1 — look for the MX type in the Host Records dropdown.**
- Why it failed: Namecheap **hides the MX Record type whenever Mail Settings = "Email Forwarding"**
  (the default). It assumes it is managing mail routing for you, so custom MX entry is disabled.

**Attempt 2 — fetch the exact DNS records (full DKIM key) via the Resend API to hand to the user.**
- Why it failed: the application API key is **scoped "Sending access" only**, so `GET /domains`
  is 401. DNS record values (esp. the ~200-char DKIM `p=…`) must be copied from the Resend
  **dashboard → Domains → <domain>** with the per-row copy button.

**Attempt 3 (anticipated) — keep Mail Settings on "Email Forwarding" and just add the TXT records.**
- Why it's insufficient: DKIM (TXT) + SPF TXT can be added that way, but Resend's verification set
  also wants the **MX** on the `send` subdomain (custom MAIL FROM / bounce path). Without flipping
  to Custom MX you can't add it, so the domain won't fully verify for sending.

## Solution

**1. Unhide the MX type in Namecheap — switch Mail Settings to "Custom MX".**
Namecheap → Advanced DNS → **MAIL SETTINGS** dropdown → change **"Email Forwarding" → "Custom MX"**.
The Host Records **Type** dropdown then gains **"MX Record"**.
- Safe when the domain isn't used for *receiving* email (here the business inbox is a plain Gmail,
  `mommamiacaters@gmail.com`, and the domain is just a GitHub-Pages site). If `@domain` forwarding
  *is* in use, re-add the forwarding MX records manually after switching.

**2. Add Resend's four records (Host = short form; Namecheap auto-appends the domain):**

| Type | Host | Value | Priority |
|------|------|-------|----------|
| TXT  | `resend._domainkey` | full `p=MIGfMA…wIDAQAB` (copy from Resend dashboard) | — |
| MX   | `send` | `feedback-smtp.ap-northeast-1.amazonses.com` (match Resend's region!) | 10 |
| TXT  | `send` | `v=spf1 include:amazonses.com ~all` | — |
| TXT  | `_dmarc` | `v=DMARC1; p=none;` | — |

> The MX region varies by Resend domain region — Momma Mia's was **Tokyo `ap-northeast-1`**, NOT the
> docs' default `us-east-1`. Always copy the exact value from the dashboard.

**3. Verify in Resend, then point the Edge Function's sender at the verified domain.**
```bash
# only AFTER Resend shows the domain "Verified"
npx supabase secrets set --project-ref fbzwicfvhrtyfqjounvo \
  ORDER_FROM_EMAIL="Momma Mia Caters <orders@mommamiacaters.com>"
```

**4. Verifying delivery without the dashboard** (the send-only key can still *send*):
```bash
# real send to a NON-owner address — fails in test mode, succeeds once verified
curl -s -X POST "https://<ref>.supabase.co/functions/v1/order-notify" \
  -H "Content-Type: application/json" -H "X-MM-Auth-Token: <secret>" \
  -d '{"kind":"customer_receipt","to":"someone-else@example.com","order":{...},"items":[...]}'
# {"sent":true,...} == verified-domain path works for any recipient
```

## Why This Works
1. **Root cause is configuration, in three places:** (a) Namecheap couples MX entry to the Mail
   Settings mode — "Email Forwarding" *intentionally* suppresses the MX type; only "Custom MX"
   exposes it. (b) Resend gates unverified domains to owner-only/`onboarding@resend.dev` to prevent
   spam from unowned domains — verifying via DKIM+SPF+MX lifts the gate. (c) A "Sending access" API
   key has no management scope, so domain reads 401 by design.
2. Switching to Custom MX lets the `send` MX (Resend's Amazon SES MAIL FROM/bounce host) land,
   completing the SPF/return-path alignment Resend checks; DKIM TXT proves domain ownership; together
   the domain flips to Verified and SES/Resend will deliver to anyone.
3. Pointing `ORDER_FROM_EMAIL` at the now-verified domain means the From passes DKIM/SPF alignment
   → inbox placement instead of rejection.

## Prevention
- When wiring Resend on **Namecheap**, set **Mail Settings → Custom MX first** (before hunting for
  the MX type). Confirm whether the domain receives mail; if so, preserve the forwarding MX.
- **Host field takes the short name** (`send`, `resend._domainkey`, `_dmarc`) — Namecheap appends the
  domain. Pasting the FQDN creates `send.domain.com.domain.com` and silently never verifies.
- **Copy DNS values from the Resend dashboard**, not docs/screenshots — the DKIM key is long and the
  **MX region is per-domain** (`ap-northeast-1` here, not `us-east-1`).
- Keep the email-provider key **send-only**; do domain/DNS reads in the dashboard or with a separate
  full-access key — don't widen the app key's scope just to read records.
- Test the **non-owner** path explicitly (a send to an address you don't own) to prove verification —
  an owner-address test passes even in restricted test mode and gives false confidence.

## Related Issues
- See also: [pg-net-trigger-can-rollback-transaction-supabase-20260525.md](../best-practices/pg-net-trigger-can-rollback-transaction-supabase-20260525.md) — the DB-trigger side of this same order-email pipeline (why the `pg_net` POST is fire-and-forget so a mail failure never rolls back the order).
