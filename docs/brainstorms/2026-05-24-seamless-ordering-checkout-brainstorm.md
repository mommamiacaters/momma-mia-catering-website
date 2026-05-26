---
date: 2026-05-24
topic: seamless-ordering-checkout
---

# Seamless Ordering + Checkout (Mobile) — Flagship-Quality UX

## What We're Building

Elevate the Momma Mia mobile app's ordering experience to feel like Uber Eats / Grab:
order and adjust quantities **without ever leaving the menu**, a persistent
**"View cart" bar**, a **full-screen cart** reached from a **top-right cart icon**,
and a polished checkout. Also fix the **category filter tap** so it scrolls
*precisely* to the chosen section.

## Why This Approach

The flagship food-app loop keeps users on the menu: inline quantity steppers +
a sticky view-cart bar + a quick cart surface. We adopt that loop, anchored to
the Uber Eats / Grab interaction language, mapped onto the existing brand
(orange `#E36A2E` / cream). Builds on the current Expo Router + NativeWind +
Zustand foundation rather than replacing it.

## Key Decisions (confirmed with user)

- **Cart surface = full-screen modal** (Expo Router `presentation: 'modal'` route),
  opened from the top-right cart icon AND the sticky view-cart bar. (User picked
  modal over bottom-sheet/drawer.)
- **Inline quantity steppers on menu cards** — `+` morphs into `− qty +` in place
  (reads/writes the Zustand cart). Tapping the card body still opens item detail.
- **Remove the bottom Cart tab** → 3 tabs (Menu / Orders / Account). Cart entry =
  top-right icon (with badge) + sticky "View cart · N · ₱total" bar.
- **Precise scroll-to-category** — tapping a chip lands exactly on the section
  (measured section offsets via `onLayout` + `scrollTo`, not best-effort
  `scrollToLocation`). Fixes the reported bug.
- **Reference language:** Uber Eats / Grab (clean cards, sticky rail, view-cart bar).

## The seamless loop (UX spec)

1. Browse menu (sticky category rail, sticky section headers).
2. Tap `+` on a card → becomes `− 1 +` inline; cart badge + view-cart bar animate in.
3. Adjust quantities inline or in the cart; subtotal updates live.
4. Tap top-right cart icon OR view-cart bar → full-screen cart modal (line items,
   per-item steppers, remove, subtotal) → "Go to checkout".
5. Checkout (existing screen, polished) → place order → confirmation.

## Open Questions (for planning)

- Inline stepper: animate the `+`→`−qty+` morph (LayoutAnimation/reanimated) or
  instant swap? (Lean: subtle layout animation, respect reduced-motion.)
- View-cart bar: float above the tab bar on Menu only, or app-wide? (Lean: Menu +
  item detail; checkout/cart already show totals.)
- Keep the item detail screen as the "full info" view (yes — inline add is the
  fast path, detail is the rich path).

## Next Steps
→ `/workflows:plan` for file-level implementation (compound engineering).
