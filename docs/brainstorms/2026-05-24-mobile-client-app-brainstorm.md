---
date: 2026-05-24
topic: mobile-client-app
---

# Momma Mia Mobile — Client Ordering App

## What We're Building

The customer-facing mobile app (`apps/mobile`, Expo) — the phone version of the
website's ordering flow. First milestone is a **home screen** that opens to:

1. A **search bar** pinned at the very top.
2. A catchy **"Get lunch with Mia" hero banner**.
3. A **"Recently ordered"** row (personalized once auth lands; graceful
   placeholder / popular-items until then).
4. **Check-a-Lunch menu sections** rendered from the live Supabase catalog.

Then: menu browse → item detail → cart → (auth) → checkout w/ GCash proof →
order confirmation → order history. Driver app and live tracking are out of
scope (Phase 5 of the platform plan).

## Why This Approach

- **Backend is already built.** Supabase migrations exist for `categories`,
  `menu_items`, `orders`, `order_items` (phase1), `auth + roles` (phase2),
  admin/menu images (phase3), `app_settings` (phase4). Generated types live at
  `apps/web/src/types/database.types.ts`. So "Supabase-first" is mostly *done* —
  mobile reads the same RLS-protected tables the web app uses. No new backend
  needed for menu browse.
- **NativeWind + Expo Router** reuses the web brand tokens (orange `#E36A2E` /
  cream `#F3E7D8` / Arvo + Poppins) and a file-based routing model close to the
  web's react-router mental model.
- **Expo Go is sufficient** for this app (no native maps/GPS), so dev stays on
  the emulator/QR — and the QR path avoids the NTKDaemon/adb phantom entirely.

## Key Decisions

- **Surface:** Client ordering app first (driver/admin deferred).
- **Data:** Supabase directly, via a shared client. Confirm `menu_items` has
  rows; if empty, seed from the existing menu source before building UI.
- **Stack:** Expo Router (file-based) + NativeWind v4 (Tailwind tokens) +
  `@supabase/supabase-js`.
- **Shared code (extract to `packages/`):** `db` (generated types),
  `supabase` (client factory + queries), `validation` (zod). Web later imports
  these too, killing drift. Not shared: UI (PrimeReact web vs RN).
- **"Recently ordered" depends on auth** → ships as a placeholder (sign-in CTA /
  popular items) and becomes real in the auth+checkout step.

## Open Questions

- Does `menu_items` already contain seeded rows, or is the web menu still read
  from the n8n `/webhook/menu`? (Verify first; seed if empty.)
- Exact hero banner copy — candidates: *"Hungry? Get lunch with Mia 🍱"* /
  *"Lunch sorted — get it with Mia."* / *"Your midday fix, delivered by Mia."*
- Search scope for v1: client-side filter of loaded menu (simple) vs Supabase
  full-text (later). Recommend client-side filter first.

## Build Phases

- **A — Shared foundation:** `packages/db|supabase|validation`; mobile env
  (`EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`); verify Metro `watchFolders` + pnpm.
- **B — App shell:** Expo Router entry + NativeWind config + brand theme; tab
  layout (Menu / Cart / Orders / Account).
- **C — Home screen:** search bar, hero banner, recently-ordered (placeholder),
  Check-a-Lunch sections from `menu_items`.
- **D — Browse + cart:** category → item detail → add to cart (reuse zod).
- **E — Auth + checkout + history:** Supabase auth, order insert + proof upload
  to Storage, order history → makes "recently ordered" real.

## Next Steps
→ `/workflows:plan` for file-level implementation detail, or start Phase A now.
