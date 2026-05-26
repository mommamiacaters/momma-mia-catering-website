---
title: Mobile UI/UX enhancement roadmap
type: feat
status: active
date: 2026-05-25
---

# 🎨 feat: Momma Mia mobile — UI/UX enhancement roadmap

## Overview

The mobile client app is functionally complete and already well-polished (ambient background,
Active/Past orders with live status + Reorder, visual order timeline, peak-end confirmation,
accessibility, perf). This plan is the **next layer of UI/UX**, prioritized by impact, grounded in
the `mobile-app-ui-design` skill (60/30/10 color, ≤4 font sizes / 2 weights, 8-pt grid, thumb-zone,
Peak-End, emotional feedback loops, smarter search, never-blank/empty states). The single biggest
lever — **brand typography** — is first; everything else compounds on it.

## Already done (do NOT re-plan)
Ambient warm background (`ScreenBackground`); Orders "In the kitchen" / "Past meals" split with a
live **pulsing** card + **Reorder**; Order detail with a **visual timeline** + confident status hero;
peak-end order **confirmation** (animated check); accessibility labels/roles + 44pt targets;
scroll-spy category rail; `expo-image` perf + null-price guards; server-side `create_order` RPC.

## Problem Statement / Motivation
The app *works* and is clean, but it still reads slightly generic and "quiet":
- **System fonts** carry no brand personality (skill: typography is identity; the app should feel
  like *Mia's*, warm and homey — not default Android).
- **No tactile/feedback loop** on the key moments (add-to-cart, place-order, reorder) — the skill's
  Peak-End + "success should feel rewarding" is under-used. `Alert` is used for reorder feedback
  (blocking, off-brand).
- **Search is blank** until you type (skill anti-pattern: "never show a blank search screen").
- **Home isn't personalized** for returning users; "Popular picks" is a placeholder, not real history.
- **Loading = bare spinners** in places that have content shape (orders, detail) → skeletons would
  feel faster (skill: reserve space / skeleton screens).

## Proposed Solution — phased roadmap

### Phase 1 — Brand & feedback foundation (highest impact, app-wide)

**1.1 Brand typography** *(deps: `expo-font`, `@expo-google-fonts/*`)*
- Pair a **warm display font** for headings/numbers with a **clean body sans** (candidates: display =
  *Fraunces* / *Arvo* / *Poppins-SemiBold*; body = *Poppins* / *Inter*). One family-pair, ≤4 sizes,
  2 weights (skill).
- Load via `useFonts` in `app/_layout.tsx` (gate render until loaded / keep splash). Wire into
  `tailwind.config.js` `fontFamily` tokens (`font-display`, `font-sans`) so NativeWind classes apply.
- Apply to headings (screen titles, prices, section headers, status hero) and body. **Prices/totals
  in the display font** (skill: monospace/display for big numbers).
- *Files:* `app/_layout.tsx`, `tailwind.config.js`, `lib/fonts.ts` (new), touch the `text-*` headings.

**1.2 Haptics + branded Toast (replace `Alert`)** *(dep: `expo-haptics`)*
- `lib/haptics.ts` wrappers; fire on: add-to-cart (light), qty ± (selection), **place order success**
  (success notification), **reorder** (light).
- `components/Toast.tsx` (+ a tiny zustand store or context): non-blocking branded snackbar that
  slides in (core RN `Animated`), auto-dismisses. Replace the reorder `Alert.alert(...)` in
  `orders.tsx` with `toast('Added to cart 🛒')` / `toast('Some items are no longer available')`.
- *Files:* `lib/haptics.ts` (new), `components/Toast.tsx` + `store/toast.ts` (new), `app/_layout.tsx`
  (mount the Toast host), `(tabs)/orders.tsx`, `store/cart.ts` callers, `checkout.tsx`.

**1.3 Add-to-cart micro-feedback** (Peak-End "small win")
- Cart-badge **bounce** (core RN `Animated` scale pulse) when count increases; light haptic + toast.
- *Files:* `(tabs)/index.tsx` cart badge, `QtyControl.tsx` / `MenuItemCard.tsx` add paths.

### Phase 2 — Flow & delight

**2.1 Smarter search** (skill: never-blank search)
- When the query is empty/focused, show **Recent searches** (persist last ~5 in AsyncStorage) +
  **Popular** items + **category shortcuts** — instead of nothing/the full list.
- *Files:* `components/SearchBar.tsx`, `(tabs)/index.tsx`, `lib/recentSearches.ts` (new).

**2.2 Home personalization** (returning-user)
- Time-based greeting + name when signed in ("Good morning, Kit 👋").
- Replace the placeholder "Popular picks" with a real **"Order again"** row built from the user's
  recent `order_items` (we already fetch them) — one-tap re-add. Falls back to Popular for new users.
- *Files:* `(tabs)/index.tsx`, a small `useRecentItems` hook over `fetchMyOrders`.

**2.3 Cart polish**
- Friendlier **empty cart** state (illustration/icon + "Browse the menu" CTA), subtle item add/remove
  animation, optional **"Add a drink?"** upsell row.
- *Files:* `app/cart.tsx`.

### Phase 3 — Consistency & depth

**3.1 Loading skeletons + state consistency** (skill: skeleton screens, empty/error states)
- Skeletons for **orders list** + **order detail** + **item detail** (reuse `MenuSkeleton` pattern)
  instead of bare spinners. Audit every screen for the 4 states (loading/empty/error/success).
- *Files:* `components/OrderSkeleton.tsx` (new), `(tabs)/orders.tsx`, `order/[id].tsx`, `item/[id].tsx`.

**3.2 Item detail enrichment**
- "Goes well with" pairings row, larger hero, optional per-item notes field.
- *Files:* `item/[id].tsx`.

**3.3 Order tracking depth**
- **Pull-to-refresh** on Orders + Order detail (cheap, now). *(Larger / backend-dependent, flagged
  out of scope here:* real-time status via Supabase Realtime, estimated ETA per stage, push
  notifications on status change.)*
- *Files:* `(tabs)/orders.tsx`, `order/[id].tsx`.

**3.4 Finish the design-token sweep** (carryover from todo 006)
- Migrate remaining inline hex literals to `lib/colors.ts` `BRAND`; document the type scale + spacing
  tokens so future screens are consistent.

## Technical Considerations
- **New deps** (all Expo-Go SDK 55 safe): `expo-font`, `@expo-google-fonts/<display>`,
  `@expo-google-fonts/<body>`, `expo-haptics`. Install via `npx expo install`.
- **Reanimated stays OUT** of Expo Go (TurboModule mismatch — see memory `mommamia-mobile-expo`); all
  animation = core RN `Animated` (already the pattern: `PulsingDot`, confirmation check).
- **Fonts gate first paint** — keep the splash visible until `useFonts` resolves to avoid a flash of
  system font; or render a neutral fallback.
- **Toast over the tab bar / modals** — mount the Toast host at the root so it floats above tabs and
  the full-screen cart modal.
- **No backend changes** for Phases 1–2; Phase 3.3 realtime/push is a separate backend effort.
- **Verify on emulator** after each phase (and remember: re-add `adb reverse tcp:8081` after any
  `adb kill-server` — see `docs/solutions/developer-experience/expo-go-something-went-wrong-adb-reverse-momma-mobile-20260525.md`).

## Acceptance Criteria (per phase)
- **P1:** brand fonts load and apply app-wide (headings + prices in display font; ≤4 sizes/2 weights);
  haptics fire on add/qty/place-order/reorder; reorder + add use a branded Toast (no `Alert`);
  cart badge bounces on add. tsc clean; verified on emulator.
- **P2:** empty/focused search shows recent + popular + categories; Home greets returning users and
  shows a real "Order again" row; cart has a designed empty state.
- **P3:** orders/detail/item-detail use skeletons; all screens have all 4 states; pull-to-refresh on
  orders + detail; remaining hex literals centralized in `lib/colors.ts`.

## Success Metrics
- App "feels like a brand," not a default RN app (subjective, but the font + warm bg + feedback are
  the levers).
- Key actions give immediate tactile + visual confirmation (Peak-End satisfaction).
- No blank/plain states: search, empty cart, loading all guide the user.

## Dependencies & Risks
| Risk | Mitigation |
|------|------------|
| Font loading flash / blocked first paint | Gate on `useFonts` + keep splash; test cold start. |
| Too many fonts/sizes (skill anti-pattern) | Hard cap: 1 display + 1 body, 4 sizes, 2 weights. |
| Haptics annoying if overused | Only on intentional key actions; light/selection styles. |
| Toast vs modal/tab-bar layering | Mount Toast host at root with high z-index. |
| Realtime/push scope creep | Explicitly deferred to a backend follow-up (P3.3). |
| adb/Metro reload flakiness (env) | Re-add `adb reverse`; `--clear` after dep installs. |

## Out of Scope / Future
- Supabase Realtime order status + push notifications + live rider/ETA (driver app exists in the
  platform plan — tie in there).
- Real product photography to replace loremflickr placeholders.
- Reorder from the order-detail screen (list-level Reorder shipped).
- Dark mode.

## Recommended sequencing
Ship **Phase 1 first** (typography + feedback) — it's the highest perceived-quality jump and unblocks
the "feels premium" goal. Then Phase 2 (flow), then Phase 3 (consistency/depth). Each phase is
independently shippable and verifiable.

## Sources & References
- Design lens: `mobile-app-ui-design` skill (typography limits, 60/30/10, 8-pt grid, Peak-End,
  emotional feedback, smarter search, empty/loading states, 44pt targets).
- Current screens: `apps/mobile/app/(tabs)/{index,orders,account}.tsx`, `app/{cart,checkout,order-confirmation}.tsx`, `app/item/[id].tsx`, `app/order/[id].tsx`; components `SearchBar`, `MenuItemRow`, `MenuItemCard`, `QtyControl`, `CategoryCircles`, `PulsingDot`, `ScreenBackground`, `ScreenPlaceholder`, `MenuSkeleton`, `ViewCartBar`; `lib/{colors,format,nav}.ts`, `store/{cart,auth}.ts`, `hooks/useMenu.ts`.
- Animation constraint (Reanimated out of Expo Go) + env gotchas: memory `mommamia-mobile-expo`.
- Carryover token sweep: `todos/006-complete-p3-cleanup-and-dedup.md` (deferred items).
