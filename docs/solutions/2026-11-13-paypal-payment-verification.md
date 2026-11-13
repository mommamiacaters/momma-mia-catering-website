# PayPal payment verification — 2026-11-13

**Verdict:** the live payment path is secure against every tampering attempt we ran. One real
bug was found and fixed (sandbox payments looked like real paid orders). A full sandbox card
payment could not be completed end-to-end because PayPal rejected its published test cards.

## 1. Adversarial tests against the live API (anonymous visitor, public key)

| # | Attempt | Result |
|---|---|---|
| T1 | Order with client-sent price 1¢, fake `total_cents`, fake `client_id` | ✅ Ignored — total ₱1,500.00 = 15 × DB price; `client_id` null |
| T2 | Call a `-sandbox` PayPal function without the key | ✅ 404 Not available |
| T3 | …with a guessed key | ✅ 404 |
| T4 | Start a live PayPal payment with a real order id + wrong ref | ✅ 404 Order not found |
| T5 | Capture an order that was never sent to PayPal | ✅ 409 refused |
| T6 | Forged webhook with fake PayPal signature headers | ✅ 401 Invalid signature (verified with PayPal) |
| T7 | Call `record_paypal_capture` (marks orders paid) | ✅ permission denied |
| T8 | Call `attach_paypal_order` | ✅ permission denied |
| T9 | PATCH an order to `paid` / DELETE an order | ✅ permission denied (401) |
| T10 | INSERT straight into `orders` | ✅ permission denied |
| T11 | Read `orders` | ✅ 0 rows |
| T12–T14 | Negative qty / unknown dish / empty cart | ✅ rejected by `create_order` |
| T15–T16 | Past delivery date / invalid email | ✅ rejected by the intake trigger |
| T17 | Reuse an existing order ref | ✅ rejected (unique) — see low finding L1 |
| T18 | Unknown payment provider | ✅ rejected |

## 2. Payment-recording logic (run inside a rolled-back transaction)

| Scenario | Result |
|---|---|
| Captured amount ≠ order total | ✅ `failed` / `amount_mismatch` |
| Right amount, wrong currency (USD) | ✅ `failed` |
| Correct capture | ✅ `paid` |
| Same capture replayed (webhook retry) | ✅ `duplicate`, no change |
| Late DECLINED after payment | ✅ ignored, stays `paid` |
| Refund | ✅ `refunded` |
| COMPLETED replay after refund | ✅ stays `refunded` |
| Signed-in non-admin customer updates/reads orders | ✅ 0 rows / sees 0 orders |

## 3. Sandbox end-to-end checkout

New opt-in Playwright test `apps/web/e2e/paypal-sandbox-checkout.spec.ts`
(`cd apps/web && PAYPAL_SANDBOX_E2E=1 npx playwright test e2e/paypal-sandbox-checkout.spec.ts`).
It drives the real checkout (5 Party Trays → delivery details → PayPal → guest card) against the
key-locked sandbox functions. **Result: our side works** (`create_order` and
`paypal-create-order-sandbox` returned 200 every time); **PayPal's guest card form rejected** both
published sandbox Visas. Next step: a card from the developer dashboard's Credit Card Generator
(country Philippines) via `PAYPAL_SANDBOX_CARD`, or a manual payment with a sandbox buyer account.

## Findings and fixes

| ID | Severity | Finding | Status |
|---|---|---|---|
| H1 | **High** | Sandbox (play-money) payments wrote to the live `orders` table as **paid**, counted in sales stats, and fired the real store + customer emails — an order nobody paid for could be fulfilled. | **Fixed & live**: migration `20261113000300` + capture functions redeployed. Sandbox captures are now recorded as paid but archived, labelled `[SANDBOX - not a real payment]`, and never emailed. Verified in a rolled-back transaction; live captures unchanged. |
| L1 | Low | `create_order` accepts a client-chosen `order_ref`; a duplicate returned the raw constraint error, so a caller could test whether a ref exists. | **Fixed, NOT yet applied**: migration `20261113000400` swaps a taken ref for a fresh server-minted `MM-XXXXXX` and succeeds (no error to probe); web and mobile now display the ref the server returns. Fully server-generated refs were rejected because installed mobile builds display their own ref. Verified in a rolled-back transaction (duplicate → new ref, correct total; malformed ref still rejected). Apply after approval. |
| L2 | Low | No captcha on checkout; per-email and global intake limits only. | Open — product decision (Cloudflare Turnstile is free). |
| I1 | Info | E2E agent reported "Proceed to Checkout" off-screen at 1280px. | **Not a bug**: it lives in the order drawer, which opens from the always-visible "Your Order" button. Measured after the 200 ms slide-in at 1280×720, 1366×768 and 1280×600 — fully on screen every time. No change. |

## Housekeeping

- 5 test orders created during testing (1 security test, 4 sandbox attempts; all unpaid, no emails
  sent) were moved to the private `archive` schema. Live `orders` is empty again.
- Nothing was charged; no real PayPal payment was attempted.
