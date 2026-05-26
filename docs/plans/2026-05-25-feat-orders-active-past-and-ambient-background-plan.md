---
title: Orders Active/Past sections + ambient warm background
type: feat
status: completed
date: 2026-05-25
---

# ✨ feat: Orders "In progress" vs "Past" sections + ambient warm background

## Overview

Two related mobile polish items the user asked for (with the `mobile-app-ui-design` skill):

1. **Orders tab structure** — surface any *ongoing* order in a clear section at the **very top**, with a separate **Past orders** section below. Drop the absolute **date** from order cards and replace it with more useful detail (what was ordered, item count, status). Make sure a realistic **sample past order** is visible.
2. **Ambient background** — replace the flat cream background (Orders list + Order detail, and Home/Account for consistency) with something that "feels natural but not bland": a subtle warm gradient + soft brand-tinted accents behind the existing white cards.

> **Important context:** the Active/Past split, the live **pulsing dot**, friendly status text (`friendlyStatus`), and the **active-card item summary** were already implemented last turn (`apps/mobile/app/(tabs)/orders.tsx`, `components/PulsingDot.tsx`, `lib/orders.ts`) and are **tsc-clean** — but they never rendered on the emulator because the Metro reload was blocked by a wedged adb server. **Image #7 is the pre-rework UI.** This plan = finish the **Past card** redesign + add the **background** + seed/verify sample data + get it to actually bundle.

## Problem Statement / Motivation

- The Orders tab (Image #7) is a flat, undifferentiated list. A customer can't tell at a glance which order is *in progress* vs *finished*, and the most relevant thing — a live order — isn't surfaced at the top. (Skill: order tracking should "open with a confident status message"; returning-user content should be routine/progress-focused.)
- Cards lead with an **absolute date** (`5/24/2026`) — low value. What's actually useful at a glance is **what you ordered** (for recall/reorder), how many items, and the status.
- The background is flat `#F4EBDD` cream. On content-light screens (Orders list, Order detail — Images #8/#9) it reads as plain/bland.

## Proposed Solution

### A. Orders tab: two sections (`app/(tabs)/orders.tsx`)

```
┌─────────────────────────────────────────┐
│ IN PROGRESS  (1)                          │   ← only shown if active orders exist
│ ┌───────────────────────────────────────┐│
│ │ ● Still cooking 🍳            ₱210    ││   ← pulsing dot, friendly status, NO date
│ │ 2× Swedish Meatballs, Chicken Fillet  ││   ← what was ordered
│ │ ─────────────────────────────────────  ││
│ │ MM-TEST-mvp9j            Track order › ││   ← soft orange glow card
│ └───────────────────────────────────────┘│
│                                           │
│ PAST ORDERS  (1)                          │   ← section BELOW
│ ┌───────────────────────────────────────┐│
│ │ MM-20260522-1118-ba4f     Delivered ✓ ││   ← status pill (no date)
│ │ 2× Swedish Meatballs, Korean Fried…    ││   ← what was ordered  (+N more)
│ │ 4 items                        ₱265 › ││   ← item count + total  (date REMOVED)
│ └───────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

- **In progress** (top): `isActiveOrder(status)` = `pending|confirmed|preparing|ready|assigned|picked_up`. Prominent card — pulsing live dot, `friendlyStatus()` ("Still cooking 🍳", "On the way 🛵", "We've got your order"), `itemsSummary()`, total, "Track order ›", **no date**, soft orange (`shadowColor: BRAND.primary`) glow. **[already coded]**
- **Past orders** (below): `delivered|cancelled`. Compact card — **remove the date**, replace with: `itemsSummary()` line + `"N items"` + status pill (Delivered ✓ / Cancelled in red) + total + chevron. **[change needed: drop `new Date(...).toLocaleDateString()` from `PastOrderCard`, add items + count]**
- Section headers: small uppercase muted label + count chip (`SectionHeader`, already coded). **[done]**

### B. Ambient background (`components/ScreenBackground.tsx` — new, reusable)

A single absolute-fill layer the screens wrap their (now transparent) content in, replacing `className="… bg-brand-cream"`:

- **Base gradient** (`expo-linear-gradient`): warm, light-from-top, *within the cream family* so it never fights the brand —
  - top `#F7F0E6` → mid `#F4EBDD` (current cream) → bottom `#F0E2CF` (slightly deeper warm sand). Subtle (skill: "don't overuse gradients… unless subtle").
- **Soft accent blobs** (plain `View` circles, **no extra dep**, low opacity so the hard edge is imperceptible and reads as a soft tint):
  - brand-primary circle, ~280px, **~7% opacity**, top-right, partially off-screen.
  - brand-secondary (`#F3E7D8`) circle, ~200px, **~40% opacity**, bottom-left.
- Cards stay **white** with tinted shadows so they pop against the warmer field (skill: hierarchy, tinted shadows).
- Applied to: **Orders list**, **Order detail** (where the user pointed), and **Home + Account** for app-wide consistency (skill: "keep visual style consistent across the entire app"). On Home, verify the **sticky `CategoryCircles` rail** still reads against the gradient (its own cream bg + bottom border).

### C. Sample data (dev only)

- `MM-20260522-1118-ba4f` (delivered, 4 items, ₱265) **already** serves as the Past sample; `MM-TEST-mvp9j` (preparing, 2 items, ₱210) is the active sample.
- Optionally seed **one more** realistic past order (e.g., a second `delivered` order, or a `cancelled` one) so the Past section shows variety. Viewer is **admin**, so RLS shows all orders regardless of `client_id` — seed can use `client_id = null`.

## Technical Considerations

- **New dependency:** `npx expo install expo-linear-gradient` (Expo-managed, Expo Go SDK 55 compatible). No `react-native-svg` needed — blobs are low-opacity circles. (If softer radial blobs are wanted later, `react-native-svg` `RadialGradient` is the upgrade.)
- **`ScreenBackground`**: `<View style={StyleSheet.absoluteFill}>` containing the `LinearGradient` + blob circles, rendered *behind* a transparent `SafeAreaView`/`ScrollView`. Must not intercept touches (`pointerEvents="none"` on the decorative layer) or break scrolling.
- **No data-layer change**: `fetchMyOrders` already returns `order_items(item_name, qty)`; `friendlyStatus`/`itemsSummary`/`isActiveOrder` already exist in `lib/orders.ts`.
- **Render blocker**: the last reload was eaten by a wedged adb server. /work must reset adb (`adb kill-server && adb start-server`) and do a clean `expo start --clear` + relaunch so the new UI actually bundles.
- **Color tokens**: extend `lib/colors.ts` `BRAND` only if new shades are needed (gradient stops can be inline in `ScreenBackground`).

## Acceptance Criteria

- [x] **In progress** section renders at the very top (live card: pulsing dot, "Still cooking 🍳", item summary, total, "Track order", **no date**); hidden when there are no active orders. *(verified on emulator)*
- [x] **Past orders** section renders below; **no date on any order card**; past cards show item summary + `"N items"` + status pill (Delivered ✓) + total + chevron. *(verified: MM-20260522 → "Swedish Meatballs, Korean Fried Chicken +2 more", "4 items", Delivered ✓, ₱265)*
- [x] At least one realistic **delivered** sample order is visible in Past. *(MM-20260522-1118-ba4f)*
- [x] **Orders, Order detail, Home, Account** show the warm ambient background (gradient + soft blobs) instead of flat cream; white cards stay legible; no regressions. *(verified Orders + Order detail + Home)*
- [x] `expo-linear-gradient ~55.0.14` installed; mobile **tsc clean**; verified on emulator. *(crash during verify was a cleared `adb reverse`, not code — restored.)*

## Success Metrics

- A customer can identify an in-progress order in <1s (it's first, live, and labeled in plain language).
- Order cards answer "what did I order?" without opening the detail.
- Background reads as "warm/natural," not flat and not busy (no banding, cards still pop).

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Gradient/blobs overdone → bland or busy | Keep opacities subtle (7%/40%), stay in the cream family, keep cards white. Skill anti-pattern guard. |
| `expo-linear-gradient` install hiccup in Expo Go | It's a core Expo module; `expo install` pins the SDK-matched version. Low risk. |
| Background layer breaks scroll/touch or the sticky rail on Home | `pointerEvents="none"` on the decorative layer; test Home rail + scroll explicitly. |
| Banding on the subtle gradient (cheap look) | Use 3 close stops in the cream family; if banding shows, widen stop spacing or add a faint blob to break it. |
| adb/Metro reload flakiness (environment) | Reset adb server + `--clear` before verifying; this is what blocked Image #7 from updating. |

## Out of Scope / Future

- **Reorder** action on past cards (look up `menu_items` by id → add to cart) — high-value returning-user nudge, but adds cart logic; defer.
- `react-native-svg` radial-gradient blobs for an even softer background.
- Relative time ("3 days ago") on past cards — user asked to *remove* the date; revisit only if they want time-since back in a friendlier form.

## Sources & References

- Existing (last-turn) implementation: `apps/mobile/app/(tabs)/orders.tsx` (Active/Past split, `SectionHeader`, `ActiveOrderCard`, `PastOrderCard`), `apps/mobile/components/PulsingDot.tsx`, `apps/mobile/lib/orders.ts` (`isActiveOrder`/`friendlyStatus`/`itemsSummary`, `fetchMyOrders` with `order_items`).
- Order detail (background target): `apps/mobile/app/order/[id].tsx`; Home: `apps/mobile/app/(tabs)/index.tsx`; Account: `apps/mobile/app/(tabs)/account.tsx`.
- Color tokens: `apps/mobile/lib/colors.ts`.
- Design guidance: `mobile-app-ui-design` skill — order-tracking pattern (confident status, visual timeline), 60/30/10 color, 8-pt spacing, tinted shadows, "consistent visual style across the app," anti-pattern "overusing gradients/blur."
- Dev DB (sample orders), ref `fbzwicfvhrtyfqjounvo`: `MM-20260522-1118-ba4f` (delivered, 4 items, ₱265), `MM-TEST-mvp9j` (preparing, 2 items, ₱210); both `client_id null`, visible because the viewer is admin.
