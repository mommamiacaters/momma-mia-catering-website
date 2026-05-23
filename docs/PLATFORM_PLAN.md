# Momma Mia Platform Plan — Web + Mobile on Supabase

> Status: **Proposal / not yet started.** Author: senior review (backend + frontend + UX).
> Scope: migrate the data layer from n8n+Google Sheets to **Supabase**, refactor the codebase into a **monorepo**, and add a **React Native (Expo) mobile app** for **clients, riders, and admins** with **live map tracking** (a "Grab for Momma Mia"). Eventually surface the map on the website too.
> Standing constraint: **n8n stays connected** — it becomes a downstream automation layer (email, Sheets mirror, chatbot), not the system of record.

---

## 0. Executive summary & key decisions

| # | Decision | Recommendation | Why |
|---|----------|----------------|-----|
| D1 | Repo strategy | **Single monorepo** (pnpm + Turborepo): `apps/web`, `apps/mobile`, shared `packages/*` | One schema → one set of generated types → web + mobile can't drift. Directly satisfies "admin changes reflect on both." |
| D2 | System of record | **Supabase Postgres** (Auth + Realtime + Storage + Edge Functions + PostGIS) | Real DB, real auth, RLS, geo queries. n8n+Sheets can't do multi-role auth or live tracking. |
| D3 | n8n's new role | **Downstream automation**, triggered by Supabase Database Webhooks | Keeps all existing integrations (email, Sheets, Groq chatbot) with zero loss; decouples side-effects from data. |
| D4 | Rider tracking | **Supabase Realtime Broadcast** on private `delivery:{id}` channels + **foreground service** location (not "always" background) | Cheapest/most scalable live feed; foreground-service pattern avoids the worst store-review friction. |
| D5 | Maps | **Mobile:** `react-native-maps` + Google provider. **Web:** Mapbox GL JS. **ETA/routing:** Google Directions called server-side from an Edge Function. | Google's traffic data is strongest in PH; Mapbox web free tier is generous; server-side keeps keys private. |
| D6 | Auth/roles | `profiles` table + `app_role` enum (`client`/`driver`/`admin`) + role mirrored into JWT `app_metadata` via Custom Access Token Hook | Cheap RLS (no table join per query) + authoritative table + Realtime channel authorization by role. |
| D7 | Store accounts | **Organization accounts on both stores.** Start the **D-U-N-S** application immediately. | Org account skips Google's new 12-tester/14-day production gate and lists the business name. D-U-N-S is the longest lead-time item (~2 wks). |
| D8 | Payments | Keep **GCash proof-upload** for v1; add **PayMongo/Xendit** (GCash+Maya+cards) later | Food delivery is a "physical service" → **exempt** from Apple/Google in-app-billing fees. |
| D9 | Map on website | **Yes — phase it in after mobile.** Same Broadcast channel + Mapbox GL JS. | Useful for customers without the app; near-free given the shared backend. |

**Longest lead-time items (start now, in parallel with code):**
1. Apple **D-U-N-S number** (free, ~days–2 weeks).
2. Apple Developer Program enrollment ($99/yr) + Google Play Console ($25 one-time) — both as **organization**.
3. Decide payment aggregator (PayMongo vs Xendit) — not needed until the payments phase, but pick early.

---

## 1. Current state (what we're migrating from)

**Stack:** Vite + React 18 + TypeScript + Tailwind + PrimeReact, react-router-dom v7. Deployed static to **GitHub Pages** (`mommamiacaters.com`) via GitHub Actions. **No backend, no auth, no database.**

**Everything dynamic is an n8n webhook backed by a Google Sheet:**

| Feature | Frontend caller | n8n webhook | Backing store |
|---------|-----------------|-------------|---------------|
| Menu (read) | `src/services/menuService.ts` (5-min cache) | `GET /webhook/menu` | Google Sheet |
| Checkout (write) | `src/services/orderService.ts` (`X-MM-Auth-Token` header) | `POST /webhook/checkout` | Email + Sheet |
| Contact form | `src/pages/ContactPage` | `POST /webhook/contact-form` | Email |
| Chatbot | `src/components/Chatbot` | `POST /webhook/momma-mia-chat` | Groq LLM + Sheet |

**Domain shapes today** (`src/types/index.ts`): `MenuItem { name, description, price, category, type, image }` where `type ∈ {main, side, starch}`; meal-plan logic in `useOrderManagement` (Double-the-Protein = 2 main/1 side/1 starch, Balanced = 1/1/1, min 15 plans); orders carry a `paymentProof` base64 image and an `orderRef` (`MM-YYYYMMDD-HHMM-xxxx`).

**Brand tokens** (`tailwind.config.js`) — reuse these verbatim across web + mobile:
`brand-primary #E36A2E` (orange) · `brand-secondary #F3E7D8` (cream) · `brand-text #2E2A25` · `brand-accent #F2B34A` (gold) · `brand-divider #D9CDBE`. Fonts: **Arvo** (headings/serif) + **Poppins** (body).

> Implication: the backend is **greenfield**. We design the Supabase schema cleanly and point the *existing* web data layer (`menuService`/`orderService`) at Supabase — a small, contained swap — rather than rewriting the UI.

---

## 2. Target architecture

```
                         ┌─────────────────────────────────────────┐
                         │                SUPABASE                  │
                         │  Postgres + PostGIS  (system of record)  │
   apps/web (Vite) ─────►│  Auth (client/driver/admin via JWT)      │
   apps/mobile (Expo)───►│  Realtime  (Broadcast: delivery:{id})    │
   admin (web + mobile)─►│  Storage   (menu images, payment proofs) │
                         │  Edge Functions (email trigger, ETA,     │
                         │                  account-deletion, n8n   │
                         │                  fan-out)                │
                         └───────────────┬──────────────────────────┘
                                         │ Database Webhooks (on insert/update)
                                         ▼
                         ┌─────────────────────────────────────────┐
                         │                  n8n                     │
                         │  (UNCHANGED INTEGRATIONS, now downstream) │
                         │  • order/contact email notifications     │
                         │  • Google Sheets mirror (reporting)      │
                         │  • Groq chatbot                          │
                         └─────────────────────────────────────────┘

Maps:  mobile = react-native-maps (Google) · web = Mapbox GL JS
ETA/routing = Google Directions, called server-side from an Edge Function
```

**Key principle:** the apps talk to **Supabase only**. n8n is invoked *by* Supabase (Database Webhook → n8n webhook) for side-effects. This means the website's "submit order" stops POSTing to n8n and instead `INSERT`s into `orders`; a webhook then fires the existing n8n email/Sheets flow. **No n8n workflow is deleted** — the trigger source just moves from "frontend" to "Supabase."

---

## 3. Data model (initial schema)

```sql
-- roles
create type app_role     as enum ('client','driver','admin');
create type order_status as enum ('pending','confirmed','preparing','ready',
                                  'assigned','picked_up','delivered','cancelled');
create type order_type   as enum ('delivery','pickup','catering');
create type delivery_status as enum ('unassigned','assigned','en_route_pickup',
                                     'picked_up','en_route_dropoff','delivered');

create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  role       app_role not null default 'client',
  full_name  text, phone text, avatar_url text,
  created_at timestamptz default now()
);

create table driver_details (
  driver_id        uuid primary key references profiles(id) on delete cascade,
  vehicle_type     text, plate_no text,
  is_online        boolean not null default false,
  current_location geography(Point,4326),     -- latest position (GiST indexed)
  updated_at       timestamptz default now()
);

create table categories (
  id serial primary key, name text not null, sort_order int default 0,
  is_active boolean default true
);

-- the shared catalog: BOTH web and mobile read this; ONLY admins write it
create table menu_items (
  id          uuid primary key default gen_random_uuid(),
  category_id int references categories(id),
  name text not null, description text, image_url text,   -- image_url -> Storage
  price_cents int not null,
  type        text,                                       -- main/side/starch (legacy meal-plan)
  is_available boolean default true, is_catering boolean default false,
  sort_order  int default 0, updated_at timestamptz default now()
);

create table orders (
  id            uuid primary key default gen_random_uuid(),
  order_ref     text unique not null,            -- keep MM-YYYYMMDD-HHMM-xxxx
  client_id     uuid references profiles(id),    -- nullable: guest checkout still allowed
  status        order_status not null default 'pending',
  order_type    order_type   not null default 'delivery',
  subtotal_cents int not null, delivery_fee_cents int default 0, total_cents int not null,
  delivery_address text, delivery_geo geography(Point,4326),
  scheduled_for timestamptz,                      -- catering events
  payment_proof_url text,                         -- Storage path
  special_requests text,
  created_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id),
  qty int not null default 1,
  unit_price_cents int not null,                  -- PRICE SNAPSHOT at order time
  notes text
);

create table deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references orders(id) on delete cascade,
  driver_id uuid references profiles(id),         -- null until dispatched
  status delivery_status not null default 'unassigned',
  pickup_geo geography(Point,4326), dropoff_geo geography(Point,4326),
  eta timestamptz,                                -- server-computed from Directions API
  assigned_at timestamptz, picked_up_at timestamptz, delivered_at timestamptz
);

-- DOWNSAMPLED history/audit only — the LIVE dot goes over Broadcast, not this table
create table driver_locations (
  id bigserial primary key,
  driver_id uuid references profiles(id),
  delivery_id uuid references deliveries(id),
  geo geography(Point,4326) not null,
  recorded_at timestamptz default now()
);

create index on driver_details using gist (current_location);
create index on driver_locations using gist (geo);
```

**Notes**
- **Guest checkout stays possible** (`orders.client_id` nullable) so the public website doesn't force signup — important for conversion. Logged-in clients get history.
- **Price snapshot** in `order_items.unit_price_cents` so menu price changes never rewrite past orders (a classic catering/e-comm correctness bug).
- **Live tracking is NOT a hot table.** `driver_locations` is sampled (~every 15–30s or 50m of movement) for ETA/audit; the real-time customer view comes from the Broadcast channel.

---

## 4. Auth, roles & RLS

**Model:** `profiles.role` is the source of truth; a **Custom Access Token Auth Hook** copies it into JWT `app_metadata.role` on every token issue. RLS reads `auth.jwt() -> 'app_metadata' ->> 'role'` — no per-query table join.

> Security note: store role in `app_metadata` (server-controlled), **never** `user_metadata` (user-editable). Putting an authorization field where the user can edit it is a classic privilege-escalation hole.

| Table | client | driver | admin | anon (public site) |
|-------|--------|--------|-------|--------------------|
| `menu_items` / `categories` | read | read | **read + write** | read |
| `orders` | own only (`client_id = auth.uid()`) | read of *assigned* delivery's order only | all | insert (guest checkout) |
| `deliveries` | read own order's delivery | own only (`driver_id = auth.uid()`) | all + assign | — |
| `driver_details` | — | own only | all | — |
| `realtime.messages` (Broadcast) | **read** `delivery:{id}` if own order | **write** `delivery:{id}` if assigned | read all | — |

Dispatch (assigning a driver, finding nearest driver) goes through **admin-only `SECURITY DEFINER` RPCs** so RLS doesn't block the cross-row matching query.

---

## 5. Live tracking architecture

- **Live feed = Supabase Realtime Broadcast** on a **private** channel `delivery:{deliveryId}`. The rider app publishes its GPS; the customer app/web and admin subscribe. **No DB write per ping** → cheap and scales.
- **Realtime Authorization (on by default):** RLS policies on `realtime.messages` ensure only the assigned rider can *write* the channel and only the order's client + admins can *read* it. Policies are cached per connection, not re-checked per message.
- **PostGIS** (enable via Dashboard → Database → Extensions) for: nearest-driver dispatch (`<->` KNN operator), distance/geofencing (`ST_DWithin`, `ST_Contains` for delivery zones), inside a `find_nearest_drivers(lng,lat)` RPC.
- **Sampling:** device emits every **3–5s gated by ~10m displacement** (a parked rider stops emitting). Persist a **downsampled** track to `driver_locations` (~15–30s / 50m) for ETA + audit.
- **ETA:** Google Directions/Distance Matrix called **server-side from an Edge Function**, cached — key never ships to the client.

---

## 6. Repo restructure (monorepo)

```
momma-mia/
  apps/
    web/            # existing Vite + React site moves here (minimal changes)
    mobile/         # new Expo (React Native) app
  packages/
    db/             # `supabase gen types typescript` output — ONE source of truth
    supabase/       # shared client factory, Realtime channel/topic helpers, RPC wrappers
    validation/     # zod schemas (order, product, delivery) — used by web, mobile, AND edge fns
    config/         # shared eslint / tsconfig presets
  supabase/         # migrations, edge functions, seed.sql (Supabase CLI project)
  turbo.json  pnpm-workspace.yaml  .npmrc(node-linker=hoisted)
```

**Shared:** generated types, zod validation, Supabase/Realtime helpers. **Not shared:** UI (web = PrimeReact/Tailwind, mobile = RN components).

> **Known time-sink (de-risk first):** pnpm symlinks + Expo/EAS/Metro historically assume Yarn. Mitigate with `node-linker=hoisted` in `.npmrc` and Expo's official monorepo `metro.config.js` `watchFolders` setup. Budget ~1 day; do it in Phase 0 as a throwaway spike *before* moving the website.

> **Note on git:** the actual `mv`/restructuring commits are left to you (per your standing no-staging rule). The plan assumes you move `apps/web` and commit; I'll prep the file moves with plain `mv` when we execute.

---

## 7. Features by role × surface

Legend: ✅ in scope · ➕ later phase · — n/a

| Capability | Client (web) | Client (mobile) | Driver (mobile) | Admin (web) | Admin (mobile) |
|---|---|---|---|---|---|
| Browse menu / services | ✅ | ✅ | — | — | — |
| Guest checkout (no login) | ✅ | ➕ | — | — | — |
| Account + order history | ✅ | ✅ | — | — | — |
| Place order + payment proof | ✅ | ✅ | — | — | — |
| **Live-track my rider on map** | ➕ (phase 6) | ✅ | — | ✅ (dispatch view) | ✅ |
| Push notifications (status) | — | ✅ | ✅ | — | ✅ |
| Go online / accept job | — | — | ✅ | — | — |
| Share live GPS (foreground svc) | — | — | ✅ | — | — |
| Update delivery status | — | — | ✅ | ✅ | ✅ |
| **Configure products / menu / prices** | — | — | — | ✅ | ➕ |
| Manage categories / availability | — | — | — | ✅ | ➕ |
| Assign / reassign driver (dispatch) | — | — | — | ✅ | ✅ |
| Orders board (kanban by status) | — | — | — | ✅ | ✅ |
| Account deletion (store requirement) | ✅ | ✅ | ✅ | — | — |

**Admin product config is the linchpin of "reflects on both":** admin writes `menu_items`; both apps read the same RLS-protected table; mobile uses Realtime/refetch so changes appear without a redeploy. No more editing a Google Sheet.

---

## 8. Phased roadmap

Each phase is shippable and ordered to de-risk early. Rough sizing assumes one developer + AI assistance.

### Phase 0 — Foundations & de-risking (1 week)
- Create Supabase project (org); enable **PostGIS**; configure local stack (`supabase init` / `supabase start`).
- **Spike the pnpm + Expo/EAS/Metro monorepo** with a throwaway app to prove the toolchain on Windows.
- Stand up monorepo skeleton; move website into `apps/web` (data layer untouched yet).
- Start **D-U-N-S** application; register store accounts as **organization**.
- **Exit criteria:** `supabase start` runs locally; a blank Expo dev build boots on Android emulator; web still builds in `apps/web`.

### Phase 1 — Supabase data layer + n8n inversion (1–2 weeks)
- Author migrations: `categories`, `menu_items`, `orders`, `order_items`, `contact_submissions`. Seed menu from the current Google Sheet.
- Generate types into `packages/db`; zod schemas into `packages/validation`.
- **Swap the web data layer:** `menuService` reads `menu_items`; `orderService` inserts `orders`/`order_items` + uploads proof to Storage; contact form inserts a row.
- **Wire Database Webhooks → existing n8n webhooks** so order/contact emails + Sheets mirror keep working unchanged.
- **Exit criteria:** website runs end-to-end on Supabase; n8n still sends the same emails; Google Sheet still updates (now as a mirror, not the source).

### Phase 2 — Auth & roles (1 week)
- Supabase Auth (email/password + magic link). `profiles` + `app_role`; Custom Access Token Hook → JWT claim.
- RLS policies for all tables (table from §4). Client signup + order history on web. **In-app account deletion** Edge Function (store requirement — build it now, not later).
- **Exit criteria:** a client can sign up, log in, see only their orders; admin can see all; RLS verified with the Supabase advisors.

### Phase 3 — Admin console (web) (1.5–2 weeks)
- Product/menu CRUD (categories, items, prices, availability, image upload to Storage).
- Orders board (kanban by `order_status`); order detail.
- Admin role gating end-to-end.
- **Exit criteria:** admin edits a product on web → change visible on the public site without redeploy.

### Phase 4 — Mobile app: client + ordering (2–3 weeks)
- Expo app in `apps/mobile`: auth, menu browse, cart (reuse `packages/validation`), checkout + proof upload, order history, push notifications (Expo Notifications) for status changes.
- Brand the RN UI with the existing tokens (orange/cream/Arvo/Poppins).
- **Exit criteria:** a client can order from the phone; status push works; dev build installs on Android.

### Phase 5 — Driver app + dispatch + LIVE TRACKING (3–4 weeks) ← the hard part
- Driver: go online (`driver_details.is_online`), see assigned job, **foreground-service GPS** (`expo-location` + `FOREGROUND_SERVICE_LOCATION`), publish to `delivery:{id}` Broadcast, update delivery status.
- Admin dispatch: nearest-driver RPC (PostGIS), assign/reassign, live map of active deliveries.
- Client live-track screen (`react-native-maps`) + ETA from the Directions Edge Function.
- **Prepare store assets now:** background/foreground-location declaration + **demo video** (Google), Info.plist permission strings (Apple), Privacy Nutrition Label / Data Safety form.
- **Exit criteria:** a real delivery can be assigned, tracked live on map, and completed end-to-end on physical devices.

### Phase 6 — Web map + payments + polish (2–3 weeks)
- **Web live-tracking page** (Mapbox GL JS subscribing to the same Broadcast channel) — closes your "map on the website" goal.
- **Payments:** integrate PayMongo/Xendit (GCash + Maya + cards) alongside proof-upload.
- Accessibility/perf pass (WCAG AA, touch targets ≥44px, reduced-motion), error states, empty states.

### Phase 7 — Store submission (2–4 weeks, much of it waiting)
- iOS: EAS Build (cloud, no Mac needed) → EAS Submit → TestFlight on a physical iPhone → App Store review (~1–3 days).
- Android: build AAB → closed test (skipped if org account) → production review (~3–7 days for location apps).
- Privacy policy URL live; test accounts (client + rider) provided to reviewers.

> **Total realistic timeline:** ~13–18 weeks of build for a single dev, plus a 3–4 week store buffer that overlaps the tail of development (driven mostly by D-U-N-S and review queues).

---

## 9. App store requirements (verified, 2026)

**Apple App Store**
- $99/yr; **organization account needs a D-U-N-S number** (free, ~days–2wks — start first).
- **Location (5.1.5 / 2.5.4):** request **"While Using"** not "Always"; specific Info.plist strings (e.g. *"Riders share live location so customers can track their delivery in real time."*). Don't gate functionality on the permission.
- **4.2 minimum functionality:** ship a **native** app (native maps/push/GPS) — do **not** WebView-wrap the existing site.
- **4.8 Sign in with Apple:** required **only if** you add Google/Facebook login. If you use Supabase email/password only, it's not required.
- **5.1.1(v) account deletion:** **must** offer in-app delete (built in Phase 2).
- Privacy Nutrition Label + privacy policy URL mandatory. ATT **not** needed unless you do cross-app ad tracking (don't add it).
- Review: ~24–48h.

**Google Play**
- $25 one-time. **Organization account skips** the new **12-tester / 14-consecutive-day** closed-test gate (which applies to personal accounts created after 2023-11-13).
- **Foreground-service location** (Android 14+): declare `FOREGROUND_SERVICE_LOCATION` + `foregroundServiceType="location"` and the FGS type on the Play Console App content page (often with a demo video). Using a foreground service for "on active delivery" lets you **avoid the harder `ACCESS_BACKGROUND_LOCATION` review** entirely.
- Data Safety form + privacy policy mandatory.
- Target **API 35 (Android 15)** now; **API 36 (Android 16)** by 2026-08-31 — current Expo SDK keeps pace.
- Review: ~24–72h, but **4–7 days** for first submission with location.

**Payments (both):** food delivery = physical/real-world service → **exempt from in-app billing**. Use GCash/Maya/cards (PayMongo/Xendit) freely. Don't sell *digital* unlockables in-app.

---

## 10. Emulation / local dev (Windows 11, no Mac)

- **Backend:** Supabase CLI local stack in Docker (`supabase start`) — Postgres+PostGIS, Auth, Realtime, Storage, Studio, Edge runtime. Migrations via `supabase migration new` / `supabase db reset`; types via `supabase gen types typescript --local`; functions via `supabase functions serve`.
- **Android:** fully testable on Windows via **Android Studio emulator** or a physical device. Use an **EAS development build** (not Expo Go — Expo Go can't load the native maps/location modules).
- **iOS without a Mac:** can't run the Simulator. Path: **EAS Build compiles iOS in Apple's cloud** → **EAS Submit uploads to TestFlight** → test on a **physical iPhone**. Requires the $99 Apple account for signing.
- **Networking gotcha:** point the mobile app at your machine's **LAN IP**, not `localhost`, to reach the local Supabase stack from emulator/device.

---

## 11. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| pnpm/Expo/EAS/Metro monorepo friction on Windows | High | Phase 0 throwaway spike; `node-linker=hoisted`; follow Expo monorepo docs |
| Background-location store rejection | Medium | Foreground-service pattern + in-app rationale screen + prepared demo video |
| D-U-N-S delay blocks Apple launch | Medium | Apply in Phase 0, week 1 |
| GPS pings rack up DB cost | Low (small biz) | Broadcast for live feed; only downsampled history persisted |
| Menu price drift rewriting old orders | Medium | Price snapshot in `order_items` |
| Losing an n8n integration during migration | Medium | Invert (don't delete) — Database Webhook → existing n8n webhook; verify emails still fire before cutover |

---

## 12. Decisions

**Confirmed (2026-05-22):**
- ✅ **Monorepo** (D1) — pnpm + Turborepo; website moves to `apps/web`, Expo at `apps/mobile`.
- ✅ **Organization store accounts** (D7) — lists "Momma Mia Catering"; skips Google's 12-tester gate. **D-U-N-S application starts in Phase 0, week 1.**
- ✅ **Auth: email/password + magic link only** (no social) — so **Sign in with Apple is NOT required** (Apple 4.8). Social login can be added later, but that would then make Apple login mandatory on iOS.

**Still open (not blocking Phase 0):**
1. **Hosting for `apps/web`:** keep GitHub Pages (works fine — Supabase is client-side) vs move to Vercel/Netlify. Recommendation: keep GitHub Pages; Edge Functions live in Supabase regardless.
2. **Payment aggregator:** PayMongo (most popular PH SME) vs Xendit (regional). Needed by Phase 6 — pick before then.

---

*Next step on approval: Phase 0 — create the Supabase project, run the monorepo toolchain spike, and start the D-U-N-S application.*
