---
title: "Grab-style Seamless Ordering + Checkout (Mobile)"
type: feat
status: completed
date: 2026-05-24
origin: docs/brainstorms/2026-05-24-seamless-ordering-checkout-brainstorm.md
---

# ✨ Grab-style Seamless Ordering + Checkout (Mobile)

## Enhancement Summary

**Deepened 2026-05-24** with 5 parallel reviewers (frontend-races, simplicity,
TypeScript, performance) + deep implementation research. Key corrections:

1. **Scroll fix rewritten.** Abandon measured `onLayout` offsets + `getScrollResponder()`
   (untyped + **removed on the New Architecture** → won't compile; `onLayout.y` is
   relative-to-section, unreliable). Use **`scrollToLocation({ sectionIndex, itemIndex:0,
   viewOffset: RAIL_H + STICKY_H, animated:true })`** — typed and reliable since RN PR #24735.
2. **Race safety added** (the polish gap): a `spyLocked` token so the scroll-spy doesn't
   strobe the active chip during a tap-jump; live-store-state decrement (no stale-closure
   double-tap-to-zero); `navOnce` guard against double-pushing the cart modal; view-cart bar
   driven by a single shared value (no mount/unmount yo-yo).
3. **Scope trimmed** (simplicity): **defer `expo-haptics`** (new native dep), ship the stepper
   as an **instant `+`↔`− qty +` swap** (Reanimated morph = follow-up), **inline** the cart
   icon (no `CartIconButton` component), **cut rail auto-centering** (~5 categories already fit),
   keep the existing success `Alert` (defer a confirmation screen).
4. **Typed contracts** (Kieran): `MenuListSection = { title; index; data }`, `SectionList<CatalogItem, MenuListSection>`,
   `keyExtractor (item)=>item.id` (drop the dead `Array.isArray` guard), `QtyControl` takes
   `{ item: CatalogItem }` (it needs the full item to `add` at qty 0), `CategoryCircles` image is `string | null`.
5. **Perf discipline** (performance-oracle): `MenuItemRow`/`QtyControl` `React.memo` with only
   stable props + **separate** selectors (`qty`/`add`/`setQty`), fixed-numeric `88×88` `expo-image`
   + placeholder, list tuning, and **remove the `useCartCount()` call from `_layout.tsx`** with the Cart tab.

`getItemLayout` deliberately **deferred** (Performance recommended it; it needs pixel-perfect
fixed row/header heights — brittle with NativeWind — and a helper dep). Escalation path if
mount-jank or far-section imprecision appears.

---

## Overview

Refactor the Momma Mia mobile menu/cart/checkout into a flagship, GrabFood-style
experience: **circular food-image category chips**, **horizontal item rows**
(image left, text right), **inline quantity steppers**, a **floating "View cart"
bar** + **top-right cart icon**, a **full-screen cart modal**, and a polished
checkout. Fix the reported bug: **tapping a category scrolls precisely to its section.**

Carried from brainstorm (see brainstorm: `docs/brainstorms/2026-05-24-seamless-ordering-checkout-brainstorm.md`):
full-screen modal cart; inline steppers; remove Cart tab → top-right icon + view-cart
bar; Uber Eats/Grab reference; Grab visual addendum (circular chips, left-right rows, food-only).

## Visual Language (from the Grab screenshots)

- **Category rail** = horizontal row of **circular** food photos + label; active one wears a
  **brand-orange ring** (use `border-2 border-brand-primary`, NOT Tailwind `ring-*` which
  doesn't map cleanly in RN) + a small check badge. Image = first non-null item image in the category.
- **Menu items** = vertical list of **horizontal rows**: rounded-square **bordered** image
  **left** (88×88), name + 2-line description + price right, inline `+ / − qty +` on the right.
- **Popular picks** = horizontal carousel of rounded-square image cards (Grab "Order food again").
- **Cart modal** ("My Cart") = centered title, back-arrow, "Manage" remove-mode toggle; rows with
  thumbnail + qty stepper + line price.
- Rounded corners + `border-brand-divider` on imagery; circles for categories. Brand palette unchanged.

## Technical Decisions (research-grounded, post-deepening)

| Decision | Choice | Source |
|---|---|---|
| Cart surface | Single `Stack.Screen name="cart"` `presentation:'fullScreenModal'` in root `_layout`; open `router.push('/cart')`, close `router.dismiss()`. | [Expo Modals](https://docs.expo.dev/router/advanced/modals/) |
| **Scroll-to-category (bug fix)** | `listRef.scrollToLocation({ sectionIndex, itemIndex:0, viewOffset: RAIL_H + STICKY_H, animated:true })`. Measure `RAIL_H` via the rail's `onLayout`. Keep target-aware `onScrollToIndexFailed` retry (rAF, capped ≤3). **No `getScrollResponder`, no offset map.** | RN [#24735](https://github.com/facebook/react-native/pull/24735), [SectionList](https://reactnative.dev/docs/sectionlist) |
| Active-chip ownership | `spyLocked` ref: set true in `jumpTo`, cleared on `onMomentumScrollEnd` (+800ms safety timeout). Spy returns early while locked. | frontend-races review |
| Stepper reactivity | Per-card **primitive** `useCart((s)=>s.lines[id]?.qty ?? 0)`; actions as **separate** selectors `useCart((s)=>s.add)` / `s.setQty`. Decrement reads **live** state: `useCart.getState().setQty(id, cur-1)`. | [Zustand #1936](https://github.com/pmndrs/zustand/discussions/1936) |
| Stepper visual | **v1: instant conditional swap** `+` ↔ `− qty +`. Morph (Reanimated `LinearTransition`+`Fade`, `.reduceMotion(ReduceMotion.System)`, scoped to QtyControl internals only) = follow-up. | simplicity + perf review |
| View-cart bar | Always-mounted, screen-local absolute `bottom = useBottomTabBarHeight()+12`; visibility via one `useSharedValue` driven by `count>0` boolean (translateY+opacity), not mount/unmount. | [`useBottomTabBarHeight`](https://docs.expo.dev/router/advanced/tabs/), races review |
| Cart icon | **Inline** in the Menu screen, absolute `top: insets.top+8` (Menu has `headerShown:false`). No separate component. | simplicity review |
| Nav guard | Module-level `navOnce(fn)` lock (~600ms) shared by the bar + icon → no double `push('/cart')`. | races review |
| Haptics | **Deferred** to a later polish pass. | simplicity review |

## Concurrency & Race Safety (must-implement)

- **Active chip:** `spyLocked` ref gates `onViewableItemsChanged`; set in `jumpTo`, cleared on
  `onMomentumScrollEnd` + 800ms fallback timer (cleared on unmount). Spy keys off `section.index`.
- **Scroll retry:** `onScrollToIndexFailed` is target-aware (bail if `targetRef` changed), uses
  `requestAnimationFrame` not `setTimeout(120)`, capped at ~3 attempts.
- **Stepper decrement:** compute from `useCart.getState().lines[id]?.qty`, never the closed-over
  render `qty`; set `pointerEvents="none"` on any element animating out (when morph lands).
- **Nav:** `navOnce` module lock around `router.push('/cart')` (both entry points).
- **View-cart bar:** depend on `count > 0` boolean (not raw count) so 1→2→3 doesn't re-trigger entrance.

## Architecture / data (unchanged)

`store/cart.ts` (`lines: Record<string, CartLine>`, primitive `useCartCount`/`useCartSubtotal`)
and `lib/orders.ts` (`submitOrder`/`fetchMyOrders`) stay as-is. UI/interaction refactor only —
no DB/schema/`packages/*` changes. Note `CatalogItem.image` and `.price` are **nullable** → keep fallbacks.

## Implementation Phases

### Phase 1 — Scroll-to-category bug fix (ship first; highest pain)
- `app/(tabs)/index.tsx`:
  - Type sections as `MenuListSection = { title: string; index: number; data: CatalogItem[] }`;
    build `sectionData = sections.map((s, index) => ({ title: s.name, index, data: s.items }))`.
  - Measure rail height: rail `onLayout` → `railH.current`. `STICKY_H` ≈ header height (~44).
  - `scrollToSection(i)` = `listRef.current?.scrollToLocation({ sectionIndex: i, itemIndex: 0, viewOffset: railH.current + STICKY_H, animated: true })`.
  - `jumpTo(i)`: set `spyLocked.current = true`, `setActiveIndex(i)`, `scrollToSection(i)`, arm 800ms unlock timer.
  - Spy (`onViewableItemsChanged`, stable ref): early-return if `spyLocked.current`; else set active to topmost `section.index`.
  - `onMomentumScrollEnd`: clear `spyLocked` + timer. `onScrollToIndexFailed`: target-aware rAF retry (cap 3).
- **Exit:** every chip lands exactly on its section header; no active-chip strobing.

### Phase 2 — Circular category chips
- New `components/CategoryCircles.tsx` (`React.memo`): horizontal `ScrollView`; each = circular
  `expo-image` (64×64, `rounded-full`, `cachePolicy="memory-disk"`, null→`Ionicons` fallback) inside a
  ring `View` (`active → border-2 border-brand-primary` + check badge), label beneath. Props:
  `{ categories: { title: string; image: string | null }[]; activeIndex: number; onSelect: (index: number) => void }`.
  **No auto-centering** (cut). Replaces `CategoryChips` on home.
- `index.tsx`: derive categories `{ title, image: firstNonNullItemImage }` from `sections`.

### Phase 3 — Horizontal item rows + inline stepper
- New `components/QtyControl.tsx` (`React.memo`, props `{ item: CatalogItem }`): selectors
  `qty=useCart(s=>s.lines[item.id]?.qty ?? 0)`, `add=useCart(s=>s.add)`, `setQty=useCart(s=>s.setQty)`.
  `qty===0` → `+` button (`add(item)`); else `− qty +` (`+`→`add(item)`; `−`→ live-state `setQty(item.id, cur-1)`).
  **Instant swap, no animation in v1.**
- New `components/MenuItemRow.tsx` (`React.memo`, prop `{ item }` only — nav built from `item.id`
  *inside* the row, no inline `onPress` prop): left `expo-image` **88×88 numeric** (`cachePolicy="memory-disk"`,
  `recyclingKey={item.id}`, `placeholder` color, null fallback), right column name/description/price + `<QtyControl item={item} />`.
- `index.tsx`: drop `toRows`; section `data` = `items` (one row each). `SectionList<CatalogItem, MenuListSection>`,
  `keyExtractor=(item)=>item.id` (remove dead `Array.isArray` guard), `renderItem` = stable `useCallback([])`.
  Search `FlatList` uses `MenuItemRow` too. List tuning: `initialNumToRender:8, maxToRenderPerBatch:6, windowSize:9, updateCellsBatchingPeriod:50, removeClippedSubviews:true` (flip to false when the morph lands).
- Keep `MenuItemCard` as the **popular tile** only (delete its grid branch).

### Phase 4 — Top-right cart icon + floating View-cart bar
- New `components/ViewCartBar.tsx`: always-mounted, absolute `bottom = useBottomTabBarHeight()+12`;
  `useSharedValue` driven by `useCartCount() > 0` (translateY+opacity); content = bag icon + count +
  `formatPeso(useCartSubtotal())` + "View cart"; `onPress = () => navOnce(() => router.push('/cart'))`.
  Subscribe to **count + subtotal primitives only**, never `s.lines`.
- `index.tsx`: **inline** the top-right cart icon (absolute `top: insets.top+8`, bag + count badge,
  `navOnce(push('/cart'))`); render `<ViewCartBar />`.
- New `lib/nav.ts`: `navOnce(fn)` module-level lock.

### Phase 5 — Full-screen cart modal + remove Cart tab
- `mv app/(tabs)/cart.tsx → app/cart.tsx`; restyle "My Cart" (centered title, "Manage" remove-mode,
  rows with thumbnail + `<QtyControl item={line.item} />` + line price, subtotal, "Go to checkout").
  Swap RN `Image` → `expo-image`.
- `app/_layout.tsx`: add `<Stack.Screen name="cart" options={{ presentation:'fullScreenModal', headerShown:false }} />`.
- `app/(tabs)/_layout.tsx`: **remove the `cart` Tabs.Screen AND the `useCartCount()` call** → 3 tabs.
- Repoint any `router.push('/(tabs)/cart')` → `router.push('/cart')`; run `expo start --clear` for typed-routes.

### Phase 6 — Checkout polish
- `app/checkout.tsx`: add an **Order summary** block at top (static map over cart lines + `useCartSubtotal`).
  Keep existing fields/validation/GCash proof/`submitOrder`; keep the success `Alert` (confirmation
  screen deferred).

### Phase 7 — Verify
- `tsc --noEmit` clean; bundle clean; emulator walkthrough: tap each circular category → lands exactly
  on its section, no chip strobe; add via inline stepper (badge + bar appear); rapid +/− at qty 1 (no
  double-remove glitch); open cart modal from icon + bar (no double-push); adjust qty in cart; checkout.

## Acceptance Criteria

- [x] Tapping any category chip scrolls **precisely** to that section (measured `onLayout` offsets + `scrollTo`); active chip does **not** strobe (spyLocked). NOTE: implemented via plain `ScrollView` + measured offsets, NOT SectionList+scrollToLocation (unreliable) — see plan body.
- [x] Category rail = **circular food images** with active orange ring + check; highlights on scroll (no auto-centering).
- [x] Menu items are **horizontal rows** (image left 88×88 bordered, text right).
- [x] `+` becomes `− qty +` inline (instant swap; Reanimated morph deferred — incompatible with Expo Go); live-state decrement avoids stale-qty.
- [x] Floating **View-cart bar** (RN core Animated) + top-right cart icon appear when cart non-empty (count + subtotal); `navOnce` guards double-open.
- [x] **Full-screen cart modal** (My Cart, line rows, stepper, subtotal, checkout); bottom Cart tab removed (3 tabs) + `useCartCount()` subscription deleted.
- [x] Checkout shows an order summary + existing fields/proof (place-order write-path already verified earlier).
- [x] `tsc --noEmit` clean; no Zustand render loop; primitive per-item selectors.
- [x] Food-only; no multi-service grid.

## Dependencies & Risks

| Risk | Mitigation |
|---|---|
| `scrollToLocation` to a far un-rendered section imprecise | `viewOffset` + target-aware `onScrollToIndexFailed` rAF retry (cap 3); escalate to `getItemLayout` only if needed |
| Scroll-spy strobes active chip during jump | `spyLocked` ref + `onMomentumScrollEnd` unlock + 800ms safety |
| Stale-closure double-tap-to-zero on `−` | decrement via `useCart.getState()` live state |
| Double cart-modal push | `navOnce` module lock shared by bar + icon |
| `React.memo` defeated by inline props | `MenuItemRow` takes only `item`; nav from `item.id` inside; stable `renderItem` |
| Image memory at ~74 remote images | fixed numeric `88×88`, `cachePolicy="memory-disk"`, `recyclingKey`, `placeholder`, null fallback |
| Whole-navigator re-render from leftover badge sub | delete `useCartCount()` from `_layout.tsx` |
| Removing Cart tab breaks `/(tabs)/cart` links | grep + repoint to `/cart`; `--clear` typed-routes |
| `getScrollResponder` untyped/New-Arch-removed | not used — `scrollToLocation` only |

## Sources & References

### Origin
- **Brainstorm:** [docs/brainstorms/2026-05-24-seamless-ordering-checkout-brainstorm.md](../brainstorms/2026-05-24-seamless-ordering-checkout-brainstorm.md) — full-screen modal, inline steppers, remove Cart tab → top-right + bar, Uber Eats/Grab, Grab visual addendum.

### Internal references (verified current state)
- `app/(tabs)/index.tsx` — SectionList + scroll-spy + `scrollToLocation`+`onScrollToIndexFailed` (today; refactor per Phase 1/3)
- `store/cart.ts:47-54` — primitive `useCartCount`/`useCartSubtotal`; `add` is live-state safe, `setQty(id, qty<=0)` deletes
- `components/MenuItemCard.tsx` — correct memo + selector + expo-image baseline to mirror; current `getScrollResponder` NOT present (plan text corrected)
- `app/(tabs)/_layout.tsx:15` — whole-navigator `useCartCount()` to delete with the Cart tab
- `app/(tabs)/cart.tsx` → `app/cart.tsx`; `app/checkout.tsx`; `app/_layout.tsx`; `packages/supabase/src/menu.ts` (`image`/`price` nullable)

### External references
- Expo modals / dismiss: https://docs.expo.dev/router/advanced/modals/ , https://docs.expo.dev/versions/latest/sdk/router/
- `scrollToLocation` + sticky-header fix: https://github.com/facebook/react-native/pull/24735 , https://reactnative.dev/docs/sectionlist
- Zustand v5 selector loop: https://github.com/pmndrs/zustand/discussions/1936
- Reanimated layout + reduceMotion (for the deferred morph): https://docs.swmansion.com/react-native-reanimated/docs/layout-animations/layout-transitions/
- `useBottomTabBarHeight`: https://docs.expo.dev/router/advanced/tabs/
- UX: Uber Eats (Baymard) https://baymard.com/ux-benchmark/case-studies/uber-eats ; NN/G steppers https://www.nngroup.com/articles/input-steppers/
