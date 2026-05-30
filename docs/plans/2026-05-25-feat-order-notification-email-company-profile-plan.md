---
title: Order-notification email via server-side trigger + editable Company Profile
type: feat
status: completed
date: 2026-05-25
---

# 📧 feat: Order-notification email (server-side trigger) + admin-editable Company Profile

## Overview

When **any** order is placed (web or mobile), the store should be emailed at its official address
(`mommamiacaters@gmail.com`). That recipient must be **editable by the admin** in a new
**Company Profile** section on the web. Per the decisions made:

1. **Delivery = server-side trigger.** A Postgres `AFTER INSERT` trigger on `orders` (using `pg_net`)
   fires the existing n8n webhook **once**, for both apps. This is the natural home now that both
   web and mobile insert through the `create_order` RPC — and it removes the per-app email wiring.
2. **Recipient = new `company_profile` table** with a **Company Profile** admin section (extensible
   to phone/address/business name later).

> Today: web fires the email client-side via `orderService.notifyN8n` → `n8n /webhook/checkout`
> (recipient **hardcoded in the n8n workflow**); **mobile sends no email at all**. This plan moves
> the trigger server-side and the recipient into the DB.

## Problem Statement / Motivation
- **Mobile orders send no email** — `submitOrder` goes straight through `create_order` with no notify step.
- The store email is **hardcoded inside the n8n workflow** — not editable without touching n8n.
- Web's client-side `notifyN8n` is **error-prone** (you flagged a current error) and duplicates logic
  per app. A single server-side trigger fixes the mobile gap, de-duplicates, and makes the recipient
  data-driven — all at once.

## Proposed Solution

### A. `company_profile` table (singleton) + seed
`supabase/migrations/<ts>_company_profile.sql`:
```sql
create table public.company_profile (
  id                       boolean primary key default true check (id),  -- enforces ONE row
  business_name            text not null default 'Momma Mia Caters',
  order_notification_email text not null default 'mommamiacaters@gmail.com',
  contact_email            text,
  contact_phone            text,
  address                  text,
  updated_at               timestamptz not null default now()
);
insert into public.company_profile (id) values (true) on conflict do nothing;
create trigger trg_company_profile_updated_at
  before update on public.company_profile for each row execute function public.set_updated_at();

alter table public.company_profile enable row level security;
create policy "admins read company profile"   on public.company_profile for select using (public.is_admin());
create policy "admins update company profile"  on public.company_profile for update using (public.is_admin()) with check (public.is_admin());
-- (no insert/delete policy: the singleton row is seeded once; the trigger reads it as definer)
```
Secrets (n8n URL + token) live in `app_settings` (NOT committed to a migration) so they're editable
and out of git: keys `n8n_webhook_url`, `n8n_checkout_token` (set once via Management API / admin).

### B. Server-side notify trigger (`pg_net` → n8n)
Same migration (or a paired one):
```sql
create extension if not exists pg_net;

create or replace function public.notify_order_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_to    text;
  v_url   text;
  v_token text;
  v_items jsonb;
begin
  select order_notification_email into v_to from public.company_profile limit 1;
  select value #>> '{}' into v_url   from public.app_settings where key = 'n8n_webhook_url';
  select value #>> '{}' into v_token from public.app_settings where key = 'n8n_checkout_token';
  if v_url is null then return new; end if;  -- not configured → skip silently

  select coalesce(jsonb_agg(jsonb_build_object(
           'item_name', i.item_name, 'qty', i.qty,
           'unit_price_cents', i.unit_price_cents, 'plan_type', i.plan_type)), '[]'::jsonb)
    into v_items from public.order_items i where i.order_id = new.id;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type','application/json','X-MM-Auth-Token', coalesce(v_token,'')),
    body := jsonb_build_object(
      'source', 'app-order',
      'notificationEmail', v_to,
      'order', jsonb_build_object('orderRef', new.order_ref, 'status', new.status,
               'subtotalCents', new.subtotal_cents, 'totalCents', new.total_cents,
               'paymentProofUrl', new.payment_proof_url, 'createdAt', new.created_at),
      'customer', jsonb_build_object('firstName', new.customer_first_name, 'lastName', new.customer_last_name,
                  'email', new.customer_email, 'phone', new.customer_phone,
                  'deliveryAddress', new.delivery_address, 'specialRequests', new.special_requests),
      'items', v_items)
  );
  return new;
end; $$;

create trigger trg_notify_order_created
  after insert on public.orders for each row execute function public.notify_order_created();
```
- Runs `after insert`, fires-and-forgets via `pg_net` (won't block/fail the order if n8n is down).
- Reads recipient from `company_profile`, n8n url/token from `app_settings`.

### C. Remove web's client-side notify (avoid double emails)
With the trigger covering all inserts, delete the `void notifyN8n(data)` call + `notifyN8n` fn from
`apps/web/src/services/orderService.ts`. (This also retires the erroring client path.)

### D. Web admin — Company Profile section
- `apps/web/src/services/companyProfileService.ts` — `fetchCompanyProfile()` / `updateCompanyProfile(patch)` (mirror `settingsService.ts`).
- `apps/web/src/pages/admin/AdminCompanyProfile.tsx` — form: business name, **order notification email** (required, email-validated), contact email/phone, address; Save → `updateCompanyProfile`.
- Wire the route in `apps/web/src/App.tsx` (admin section) + a nav entry (alongside Settings).

### E. n8n workflow update — ⚠️ the deferred fix you mentioned
The `/webhook/checkout` workflow currently expects the **web `OrderSubmission` shape** and emails a
**hardcoded** recipient. After this change it also receives the new **`source:'app-order'`** payload
with a top-level **`notificationEmail`**. The workflow must: (1) accept/branch on `source`, and
(2) **send to `notificationEmail`** instead of the hardcoded address. Until then, the *wiring* is
done but the actual send won't be correct — this is the "fix n8n after mobile" step. (n8n at
`https://n8n.mommamiacaters.com`; update via `scripts/` + the n8n REST API, n8n API key per memory
`mommamia-checkout-gcash-email`.)

## Acceptance Criteria
- [x] `company_profile` table exists (singleton, seeded with `mommamiacaters@gmail.com`); admin-only RLS. *(applied to dev)*
- [x] `pg_net` enabled; trigger fires on the create_order finalize (total 0→>0 — AFTER UPDATE, not INSERT, since items+total come after the insert) and POSTs the order (+ recipient) to n8n, fire-and-forget. *(verified: order succeeded despite the POST timing out)*
- [x] Web admin has a **Company Profile** page (`/admin/company`); editing `order_notification_email` persists; trigger reads it per order.
- [x] Web `orderService` no longer calls `notifyN8n`; both apps flow through the one server-side trigger.
- [x] `n8n_webhook_url` / `n8n_checkout_token` in `app_settings` (not committed; hidden from the Store Settings UI); trigger skips silently if unset.
- [x] Verified: a mobile/RPC order fires exactly one `net.http_post` with `notificationEmail` = company_profile value (`mommamiacaters@gmail.com`). **DELIVERY blocked**: Supabase→n8n TLS handshake times out (server-to-server) — the deferred n8n-side fix (Section E + allow Supabase egress).
- [x] mobile + web tsc clean (mobile EXIT 0; web 0 errors).

## Technical Considerations / Risks
| Item | Note / Mitigation |
|------|-------------------|
| **Secrets in migrations** | Do NOT hardcode the n8n token in a committed migration. Store url+token in `app_settings`, set via Management API/admin (one-off, non-committed). |
| **n8n payload contract** | The trigger sends a new shape + `notificationEmail`; the workflow MUST be updated to honor it (Section E) — otherwise email sends wrong/none. This is the known deferred fix. |
| **Double email during cutover** | Remove web `notifyN8n` in the same change as enabling the trigger. |
| **`pg_net` failure modes** | `net.http_post` is async/non-blocking; errors land in `net._http_response`, not the order txn. Good (order never blocked), but means failures are silent — monitor that table / n8n executions. |
| **Wrong Supabase project (MCP→H365)** | Apply DDL via the Momma Mia CLI / Management API, ref `fbzwicfvhrtyfqjounvo` only. |
| **RLS for the trigger read** | The trigger fn is `security definer` → reads `company_profile`/`app_settings` regardless of the admin-only policies. |

## Out of Scope / Follow-up
- The actual **n8n workflow rewrite** (Section E) — the user will fix the n8n side after mobile; this plan delivers the DB/admin wiring + payload contract it should consume.
- Customer **receipt** email (separate; handled by the existing gcash-email flow, memory `mommamia-checkout-gcash-email`).
- Extra company-profile fields beyond email (phone/address shipped as optional inputs; not yet surfaced on the storefront).

## Sources & References
- Web order email path: `apps/web/src/services/orderService.ts` (`notifyN8n` → `${VITE_N8N_BASE_URL}/webhook/checkout`, `X-MM-Auth-Token`).
- Settings pattern to mirror: `apps/web/src/services/settingsService.ts`, `pages/admin/AdminSettings.tsx`, `hooks/useStoreSettings.ts`, `App.tsx` admin routes.
- Order RPC (both apps insert here): `supabase/migrations/20260524132145_create_order_fn.sql`; `apps/mobile/lib/orders.ts`.
- n8n: base `https://n8n.mommamiacaters.com`, webhook `/webhook/checkout`, token in `apps/web/.env` (`VITE_CHECKOUT_TOKEN`); workflow + API key per memory `mommamia-checkout-gcash-email`.
- `pg_net` available (not yet installed), confirmed on dev `fbzwicfvhrtyfqjounvo`.
