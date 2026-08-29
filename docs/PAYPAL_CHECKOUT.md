# PayPal checkout

Adds PayPal BESIDE the InstaPay QR + receipt-upload flow — the customer picks
one on the payment step. Written for whoever has to turn it on, and for whoever
has to debug it at 3am.

## Two methods, two trust models

| | QR (GCash / bank app) | PayPal / card |
|---|---|---|
| Fees | none | ~3.4-4.4% + FX spread |
| Verification | admin eyeballs the uploaded receipt | captured against the server total before any email |
| `payment_status` | `manual_proof` | `awaiting_payment` → `paid` |
| Emails fire | at order creation (as always) | only after the capture lands |

The QR flow is byte-for-byte the pre-PayPal behaviour: `create_order` called
WITHOUT `p_payment_provider` takes exactly the old path. The security floor for
both is the same rule below; the QR path's receipt remains a human judgement,
which is what it always was.

## The one rule

**The amount never comes from the client.** `create_order` prices the cart from
the catalogue and writes `orders.total_cents`. The Edge Functions read that
column to open the PayPal order, and compare against it when the capture comes
back. A browser can say what it likes; it cannot say what an order costs.

## Flow

```
browser                     Edge Function                database / PayPal
───────                     ─────────────                ─────────────────
click PayPal
  └─ createOrder ──────────▶ (rpc) create_order ────────▶ prices cart, inserts order
                                                          payment_status=awaiting_payment
                                                          notified_at STAYS NULL  ← no email yet
     ◀── order_id, total ───┘
  └─ paypal-create-order ──▶ reads total_cents           POST /v2/checkout/orders
                             attach_paypal_order ───────▶ stores paypal_order_id
     ◀── paypal_order_id ───┘
buyer approves in the PayPal window
  └─ onApprove ────────────▶ paypal-capture-order        POST .../capture
                             record_paypal_capture ─────▶ verifies amount == total_cents
                                                          payment_status=paid, paid_at
                                                          notified_at=now() ← emails fire HERE
     ◀── order_ref ─────────┘
```

`paypal-webhook` runs the same `record_paypal_capture` for buyers who close the
tab after paying, and for refunds. Both paths converge on one function, so they
cannot disagree about what "paid" means, and only one of them can stamp
`notified_at` — the customer gets one email, not two.

## Turning it on

### 1. PayPal dashboard

At <https://developer.paypal.com/dashboard/> → **Apps & Credentials**.

Note the toggle at the top: **Sandbox** and **Live** have *different* client IDs
and secrets. Do sandbox first.

- Copy the **Client ID** and **Secret** for your app.
- Under **Webhooks**, add a webhook pointing at:
  `https://fbzwicfvhrtyfqjounvo.supabase.co/functions/v1/paypal-webhook`
  Subscribe to exactly these events:
  - `PAYMENT.CAPTURE.COMPLETED`
  - `PAYMENT.CAPTURE.DENIED`
  - `PAYMENT.CAPTURE.REFUNDED`
  - `PAYMENT.CAPTURE.REVERSED`
- Copy the **Webhook ID** it gives you.

### 2. Server secrets (never in the repo, never in the browser)

```bash
supabase secrets set \
  PAYPAL_CLIENT_ID=<client id> \
  PAYPAL_CLIENT_SECRET=<secret> \
  PAYPAL_ENV=sandbox \
  PAYPAL_WEBHOOK_ID=<webhook id> \
  --project-ref fbzwicfvhrtyfqjounvo
```

`PAYPAL_ENV` is the live-money switch: anything other than `live` uses
`api-m.sandbox.paypal.com`. It defaults to sandbox on purpose.

### 3. Browser variable

The **client ID only** — it is public by design, it ships in the PayPal SDK's
script URL either way. The secret must never appear here.

- Local: `apps/web/.env` → `VITE_PAYPAL_CLIENT_ID=...`
- Deploys: GitHub repo → Settings → Secrets and variables → Actions → new
  secret `VITE_PAYPAL_CLIENT_ID`. The workflow already passes it to the build.

### 4. Database

```bash
# in order
supabase/migrations/20260829000000_paypal_payments_part1.sql
supabase/migrations/20260829000100_create_order_v9_paypal.sql
```

Both are re-runnable. Part 2 drops the 5-argument `create_order` and creates the
6-argument one — do not run part 2 without part 1, and do not run them out of
order.

Afterwards regenerate the typed schema so `p_payment_provider` is known to
TypeScript:

```bash
pnpm db:types
```

### 5. Deploy the functions

```bash
supabase functions deploy paypal-create-order  --project-ref fbzwicfvhrtyfqjounvo
supabase functions deploy paypal-capture-order --project-ref fbzwicfvhrtyfqjounvo
supabase functions deploy paypal-webhook       --project-ref fbzwicfvhrtyfqjounvo
```

All three run with `verify_jwt = false` (already in `config.toml`) because guest
checkout has no session and PayPal cannot carry a Supabase JWT. That is safe
here: the two checkout functions only ever act on an order that is already
`awaiting_payment` and read the amount from the database, and the webhook
verifies PayPal's signature before it believes anything.

### 6. Test in sandbox

Use a sandbox **personal** account from **Testing Tools → Sandbox accounts** as
the buyer. Check, in order:

| Do this | Expect |
|---|---|
| Reach checkout, click PayPal, pay | order `paid`, `paid_at` set, both emails sent |
| Click PayPal, then cancel | order stays `awaiting_payment`, no email |
| Cancel, then pay | the SAME order is paid — no duplicate row |
| Pay, close the tab before it returns | webhook marks it `paid` within seconds |

```sql
select order_ref, payment_status, total_cents, payment_amount_cents,
       paid_at, notified_at
  from public.orders
 order by created_at desc limit 5;
```

### 7. Go live

Flip `PAYPAL_ENV=live`, swap **both** the secret pair and
`VITE_PAYPAL_CLIENT_ID` to the live app's values, register a live webhook, and
redeploy the functions and the site. Sandbox credentials against live (or the
reverse) fail with an opaque 401 from PayPal — if payments break right after a
switch, check this first.

## Debugging

`supabase functions logs paypal-capture-order --project-ref fbzwicfvhrtyfqjounvo`

Two log lines matter more than the rest:

- **`PAID BUT NOT RECORDED`** — PayPal took the money and our write failed. The
  webhook normally fixes this within seconds. If it has not, the customer is
  owed either an order or a refund.
- **`CAPTURE REJECTED — reason=amount_mismatch`** — PayPal captured an amount
  that is not this order's total. The row is marked `failed` with the real
  captured figure in `payment_amount_cents`. Needs a refund, not a retry.

Orders stuck in `awaiting_payment` are abandoned checkouts. They are harmless
and expected; nobody was emailed and nothing was charged.

```sql
-- anything that needs a human
select order_ref, payment_status, total_cents, payment_amount_cents, created_at
  from public.orders
 where payment_status = 'failed'
    or (payment_status = 'paid' and payment_amount_cents is distinct from total_cents)
 order by created_at desc;
```

## What was left alone

- **The QR flow itself** — same UI, same `submitOrder`, same receipt upload to
  the server-reserved key, same immediate emails. It is one tab of the payment
  step now, and the default one (most PH customers reach for GCash first).
- **Historical orders** keep `payment_status = 'manual_proof'`, their uploaded
  receipts and the `payment-proofs` bucket. Nothing was deleted.
- **The mobile app** (`apps/mobile`, not shipped) still uses the receipt-upload
  flow. Calling `create_order` without `p_payment_provider` behaves exactly as
  it did before this change — `manual_proof`, and the emails still fire on
  creation. Verified, not assumed.

## Why not Stripe / a custom portal

- **Stripe cannot onboard this business.** PH-domiciled merchants are
  preview-only/waitlisted (the workaround is owning a US LLC). Even if admitted,
  it would duplicate what PayPal already provides here: card acceptance. Two
  card processors on one small storefront is pure surface area.
- **A custom payment portal is the wrong direction entirely** — storing or even
  touching card data puts the site in PCI-DSS scope. The current design keeps
  card details inside PayPal's iframe; this site never sees them. That is the
  secure architecture, not a compromise.
- **If verified GCash ever matters** (i.e. the admin is tired of eyeballing
  receipts), the right integration is a local gateway — PayMongo or Maya
  Business — NOT Stripe. Either one drops into the exact seams built here:
  `p_payment_provider => 'paymongo'`, an `awaiting_payment` row, a
  signature-verified webhook calling a recorder that compares the paid amount
  to `total_cents` and stamps `notified_at`. The PayPal functions are the
  template.
