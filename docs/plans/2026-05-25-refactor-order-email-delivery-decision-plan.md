---
title: Order-email delivery — keep n8n or move to Supabase-native? (decision)
type: refactor
status: active
date: 2026-05-25
---

# 🧭 Decision: order-email delivery — n8n vs Supabase-native (senior-backend take)

## The question
Order-notification emails (store alert + customer receipt) currently rely on **self-hosted n8n**.
The new server-side trigger (`pg_net` → n8n) **times out on the TLS handshake** to n8n. Do we fix the
n8n path, or move email to **Supabase-native** (Edge Function + a transactional provider)?

## Context (what exists today)
- **n8n is the email engine.** `scripts/create-checkout-workflow.mjs` → `n8n-nodes-base.emailSend` over
  **Gmail SMTP**, sending to the store **and** the customer, with the **payment proof as a real
  attachment** (inline base64 was rejected — Gmail strips it). Working, non-trivial logic.
- **`PLATFORM_PLAN.md` already chose** (D3): *n8n = downstream automation triggered by Supabase
  Database Webhooks; apps talk to Supabase only; no n8n workflow deleted.* The trigger→n8n shape we
  built matches this. The same plan's diagram **also lists "Edge Functions (email trigger…)"**.
- **No `supabase/functions/` yet**; **no Resend/SES/Postmark** — email capability lives *only* in n8n.
- **Failure mode:** Supabase `pg_net` → `n8n.mommamiacaters.com` — DNS resolves instantly, **TLS
  handshake never completes** (times out). Browser→n8n works; Supabase server→n8n doesn't.
- **Already built & reusable regardless of choice:** `company_profile.order_notification_email`
  (admin-editable recipient) + the order-finalize trigger. Only the *target* of the trigger changes.

## Options

### Option A — Keep n8n; fix Supabase→n8n reachability
Trigger (Database Webhook or `pg_net`) → n8n `/webhook/checkout` (as planned).
**Pros**
- **Zero rebuild** — the Gmail-SMTP email + **proof-attachment** workflow already works.
- **Matches PLATFORM_PLAN D3** exactly; one automation hub (chatbot/Sheets/contact/orders).
- No new vendor, key, or domain DNS work.
**Cons**
- Must fix the handshake timeout. Likely cause: a firewall/SG/WAF (or Cloudflare bot-challenge) on
  the n8n box that browsers pass but server-to-server callers don't. **Supabase egress IPs are not
  static**, so "allowlist Supabase" is a *moving target* — the fix may not be clean/durable.
- **A business-critical, deliverability-sensitive notification stays coupled to a single self-hosted
  box's uptime** + a flaky egress path. n8n down = silent email loss.
- **Gmail SMTP** has sending limits + spam-folder risk at scale; no per-message delivery/bounce
  observability.

### Option B — Supabase-native: Database Webhook → Edge Function → AWS SES (or Resend)
Trigger → **Edge Function** (reads recipient from `company_profile`, renders template, sends via
**SES** — infra is already AWS — or Resend).
**Pros**
- **Removes the self-hosted dependency for the critical path.** Edge Function → SES API is a clean
  Supabase-infra → public-API HTTPS call — **the exact failure we're hitting disappears** (no inbound
  to a self-hosted box, no egress allowlist).
- **Deliverability & observability:** verified domain (SPF/DKIM on `mommamiacaters.com`), inbox
  placement, delivery/bounce/complaint events, retries — proper transactional email.
- **AWS SES is cheap** (~$0.10 / 1k) and already in the stack; **HA/managed**.
- It's the platform plan's *own* envisioned pattern (the "Edge Functions (email trigger)" box).
- Templates live in code (versioned, reviewable) vs clickops.
**Cons**
- **New surface to stand up:** first Edge Function (Deno), SES domain verification (DNS), API key as a
  Supabase secret.
- **Rebuild the email logic** — especially the **proof attachment** (Edge Function signs a URL or
  downloads the private-bucket blob and attaches it). This is the real cost.
- Two senders during migration (n8n still owns chatbot/contact/Sheets).

### Option C — Hybrid relay (Edge Function → n8n)
Trigger → Edge Function → n8n. Decouples the trigger but **still depends on reaching self-hosted
n8n** → doesn't fix the root cause. Rejected (worst of both).

## Phase-1 diagnosis result (2026-05-25) — n8n is DOWN
Probed `n8n.mommamiacaters.com` from an independent machine (not Supabase):
- DNS resolves to **35.222.111.206 (a Google Cloud IP** — note: memory said AWS, so the box may have
  been moved/rebuilt).
- **Both :443 and :80 time out at TCP connect** (`connect=0.000000s`, ~21s timeout) — no SYN-ACK.
- The main site `https://mommamiacaters.com` responds **200 in 0.3s** → general DNS/internet is fine;
  it's specifically the n8n host dropping all connections.

**Conclusion: the n8n instance is offline/unreachable — NOT a Supabase egress/firewall/WAF issue.**
This is the root cause of both the new trigger's timeout *and* (almost certainly) the pre-existing
"web order email error" (web POSTs to the same dead host). No trigger/config change fixes a down box.

This **resolves the Option-A "fix reachability" question**: the only "fix" is operational — restart /
rebuild the n8n VM (and re-point DNS if it moved) — which is precisely the single-point-of-failure the
strategic recommendation warns about. Recommendation below is **reinforced** by this outage.

## Recommendation (senior-backend)
**Phase it. Unblock on n8n now; move transactional email to Supabase + SES as the end-state.**

1. **Now — unblock (Option A, time-boxed):** diagnose the n8n handshake timeout (SG/WAF/Cloudflare).
   If it's a quick, durable fix (e.g., the n8n box was just blocking server callers), ship it — the
   email + attachment already work, and it honors D3. **Time-box it**: if the fix depends on
   allowlisting non-static Supabase egress IPs (fragile) → stop and do Phase 2.
2. **Strategic — own the critical path (Option B):** stand up a Database Webhook → **Edge Function →
   SES** path for order email. Start with the **store notification** (no attachment — this is what's
   broken now, and it's easy). Then migrate the **customer receipt + proof attachment** off n8n and
   retire `/webhook/checkout`. **n8n keeps** the chatbot, contact form, and Sheets mirror — fully
   consistent with "n8n = downstream automation," just not for the *critical, deliverability-sensitive*
   email.

**Why this and not "just keep n8n":** order notifications are business-critical and deliverability
matters (the store must reliably learn an order arrived; the customer must get a receipt in their
inbox). Hanging that on a self-hosted box reached over a non-guaranteed path — the very thing failing
now — is the wrong long-term home. SES/Edge Functions are the managed, observable, in-platform fit,
and the reachability bug evaporates.

**When Option A wins instead:** if standing up SES/Edge Functions is out of scope, the team wants zero
new infra, AND the handshake turns out to be a one-line SG fix — then keep n8n and move on. The
decision hinges on Phase-1 diagnosis.

## Technical Approach (if Option B is chosen)
- `supabase/functions/order-notify/index.ts` — receives the webhook payload (or order id), reads
  `company_profile.order_notification_email`, renders the email, calls SES (`@aws-sdk/client-ses` or
  REST), returns 200. Auth via the function's service role / a webhook secret header.
- **Database Webhook** on `public.orders` (finalize: total 0→>0, mirroring the current trigger) →
  the Edge Function URL. (Replaces the `pg_net` → n8n call; `notify_order_created()` either calls the
  Edge Function or is replaced by the managed Database Webhook.)
- **Proof attachment:** Edge Function creates a signed URL for `payment-proofs/{path}` (admin/service
  read) or downloads the blob and attaches it to the customer receipt.
- **Secrets:** `SES_*` / `RESEND_API_KEY` as Supabase function secrets (never in a migration/repo).
- **DNS:** SPF + DKIM + (later) DMARC on `mommamiacaters.com` for SES.

## System-Wide Impact
- **Interaction graph:** order finalize (`create_order` UPDATE) → Database Webhook → Edge Function →
  SES. Today: → `pg_net` → n8n (timing out).
- **Error propagation:** keep it **fire-and-forget / async** so a mail failure never fails the order
  (already true). Edge Function failures land in function logs + SES bounce events (vs n8n's black box).
- **State lifecycle:** none — email is a pure side-effect; the order is already committed.
- **API parity:** both web + mobile already insert via `create_order`, so ONE trigger covers both
  regardless of target.

## Implementation status (2026-05-25) — Option B built in-repo ✅
Built and wired (Supabase-native path); **deploy + provider creds are the remaining user steps**.
- `supabase/functions/order-notify/index.ts` — provider-agnostic (Resend **or** SES), shared-secret auth, no-op if unconfigured. `supabase/config.toml`: `[functions.order-notify] verify_jwt = false`.
- Migration `20260525092100_order_notify_via_edge_function.sql` (applied to dev) — `notify_order_created()` now POSTs to the Edge Function via `order_notify_url`/`order_notify_secret` (app_settings); n8n_* keys retired.
- **Verified:** the trigger→function hop returns **404 in <1s (`timed_out:false`)** — reachability fixed (404 = not deployed yet) vs n8n's `timed_out:true`.

## Phase 2 (2026-05-25) — customer emails built ✅ (Grab parity)
Extended the same Edge-Function path to the buyer, selected by a `kind` field:
- `supabase/functions/order-notify/index.ts` generalized — **3 templates** (`store_alert`,
  `customer_confirmation`, `customer_receipt`); recipient passed as `to` (legacy `notificationEmail`
  ⇒ `store_alert`). Provider = **Resend** (decided).
- Migration `20260525160000_customer_order_emails.sql`: DRY helper `_order_notify_post(kind,to,order)`;
  `notify_order_created()` now fires **store_alert + customer_confirmation** on finalize;
  new `notify_order_delivered()` + `trg_notify_order_delivered` (AFTER UPDATE, `new.status='delivered'
  and old.status is distinct from 'delivered'`) sends the **customer_receipt**. Admin sets status via
  the existing AdminOrders dropdown — **no frontend change**.
- Receipt = itemized HTML, **no proof image** (proof stays store-only). All fire-and-forget.

### Runbook (user — needs the supabase CLI + Resend console)
0. **Apply the migration** to dev `fbzwicfvhrtyfqjounvo` (`SUPABASE_ACCESS_TOKEN=… node scripts/_apply-remote.mjs`).
0b. **Seed the destination** (URL is public; secret is yours — pick any strong string and reuse it as
   `ORDER_NOTIFY_SECRET` in step 3):
   ```sql
   insert into public.app_settings (key, value, label, is_public) values
     ('order_notify_url',    '"https://fbzwicfvhrtyfqjounvo.supabase.co/functions/v1/order-notify"'::jsonb, 'Order-notify function URL', false),
     ('order_notify_secret', '"<choose-a-strong-secret>"'::jsonb,                                            'Order-notify shared secret', false)
   on conflict (key) do update set value = excluded.value;
   ```
1. **Install CLI:** `npm i -g supabase` (or scoop/brew). `supabase login`.
2. **Deploy:** `supabase functions deploy order-notify --project-ref fbzwicfvhrtyfqjounvo`
3. **Set secrets** (`supabase secrets set --project-ref fbzwicfvhrtyfqjounvo …`):
   - `ORDER_NOTIFY_SECRET=<the value stored in app_settings.order_notify_secret>` (the trigger sends it as `X-MM-Auth-Token`)
   - `ORDER_FROM_EMAIL="Momma Mia Caters <orders@mommamiacaters.com>"`
   - **Quick path (Resend):** `RESEND_API_KEY=…` + verify `mommamiacaters.com` in Resend (DNS).
   - **Or SES:** `AWS_REGION=… AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=…` + verify the domain in SES + request production access (sandbox only sends to verified addresses).
4. **Test:** place an order → `select status_code from net._http_response order by created desc limit 1` should be **200**, and the store inbox receives the email.
5. **Recipient** is editable anytime in the web admin **Company Profile** page.

## Acceptance Criteria (for the decision)
- [ ] Phase-1 diagnosis done: documented *why* Supabase→n8n times out and whether a durable fix exists.
- [ ] Decision recorded: keep-n8n (fixed) **or** proceed to Edge Function + SES, with the trigger/recipient (`company_profile`) reused either way.
- [ ] If Option B: store-notification email delivers via SES (verified domain) on a real order; order never blocked by a mail failure; receipt+attachment migration tracked as Phase 2.

## Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| n8n reachability fix depends on non-static Supabase egress IPs | Treat as the trigger to choose Option B (don't sink time chasing a moving target). |
| Rebuilding the proof-attachment email | Phase it after the simple store-notification; reuse the n8n template content as the spec. |
| SES sandbox (can only send to verified addresses until production access) | Request SES production access early; verify the store gmail for sandbox testing. |
| Domain auth (SPF/DKIM) misconfig → spam | Verify in SES + test with mail-tester before cutover. |
| Deviating from PLATFORM_PLAN D3 | Scoped deviation: only the *critical* email moves; n8n keeps chatbot/Sheets/contact, preserving "n8n = downstream automation." Update D3 note in the plan. |

## Sources & References
- Current trigger + recipient: `supabase/migrations/20260525083606_company_profile_order_notify.sql`; `app_settings` (n8n url/token); `apps/web/src/services/orderService.ts`.
- n8n email workflow (Gmail SMTP + proof attachment): `scripts/create-checkout-workflow.mjs`; receipt flow per memory `mommamia-checkout-gcash-email`.
- Architecture decision being refined: `docs/PLATFORM_PLAN.md` D2/D3 + the architecture diagram ("Edge Functions (email trigger…)" alongside n8n).
- Failure evidence: `net._http_response` — `timed_out`, DNS ok, TLS handshake never completes (this session, dev `fbzwicfvhrtyfqjounvo`).
- Prior infra notes: memory `mommamia-create-order-rpc`, `mommamia-platform-plan`, `mommamia-n8n-access`.
