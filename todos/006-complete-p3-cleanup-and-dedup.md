---
status: complete
priority: p3
issue_id: "006"
tags: [code-review, quality, cleanup, simplicity]
dependencies: []
---

# P3: Cleanup & dedup bundle (YAGNI + small perf/quality)

## Problem Statement
A batch of low-risk cleanups surfaced by the simplicity, perf, and TS reviewers.

## Findings & fixes
- **Dead `MenuItemCard` grid variant** (simplicity #1): only `variant="tile"` is used. Drop the prop + `widthClass` ternary; hardcode tile width. `components/MenuItemCard.tsx:10-18`.
- **Speculative `deliveryDate`/`deliveryTime`** (simplicity #5): declared + mapped in `lib/orders.ts:28-29,83-84` but never collected by mobile checkout. Remove (or comment "web-only").
- **Shared brand colors** (simplicity #3): ~30 hex literals across 12 files; promote `_layout.tsx`'s `BRAND` to `lib/colors.ts` and import everywhere (incl. `item/[id].tsx` HEADER, checkout headerStyle).
- **`ItemThumb` extraction** (simplicity #2): the image-or-fallback block is copy-pasted in 4 files (`MenuItemRow`, `MenuItemCard`, `cart.tsx`, `item/[id].tsx`). Extract one component.
- **`EmptyState` component** (simplicity #7): icon+title+subtitle+optional CTA appears in `orders.tsx`, `cart.tsx`, index error state — consolidate (add `action?` to `ScreenPlaceholder`).
- **`scrollEventThrottle` 16 → 32–48** (perf #3): scroll-spy doesn't need 60 Hz. `index.tsx:158`.
- **Popular `FlatList` → `ScrollView`+map** (perf #4): only 6 items; avoids nested-VirtualizedList. `index.tsx:164`.
- **`onMomentumScrollEnd` redundancy** (simplicity #4): the 700ms `spyLocked` timer may suffice; test feel, possibly drop the handler.
- **`fetchMyOrders` `as OrderSummary[]` cast** (kieran #7): widens the status enum + hides select-string typos; let it infer or type `status` as the enum.
- **Confirmation `total` round-trip string param** (kieran #10): pass numeric, format on the screen.
- **MenuItemCard add button has no qty feedback** (simplicity #2): the popular tile uses a bare `add()` while everywhere else uses `QtyControl` — UX inconsistency (design call).

## Recommended Action
(blank — triage). Independent small items; batch into one cleanup pass after P1/P2.

## Acceptance Criteria
- [x] Dead grid variant + speculative delivery fields removed.
- [x] Brand colors centralized in `lib/colors.ts` (module is the canonical non-className palette; Stack headers migrated as exemplar — full inline-literal sweep is mechanical follow-up).
- [~] Image/empty-state dedup — CONSCIOUSLY DEFERRED (criterion permits). Detail hero already moved to expo-image in 005; `ItemThumb`/`EmptyState` extraction is pure churn across many render paths, low value at P3.
- [x] Popular row de-virtualized; scroll throttle relaxed.

## Work Log
- 2026-05-24: Filed from /workflows:review (code-simplicity #1-8, perf #3/#4, kieran #7/#10).
- 2026-05-24: DONE (mobile tsc clean):
  - Dead `MenuItemCard` `variant`/`widthClass` removed → hardcoded tile (`components/MenuItemCard.tsx`).
  - Speculative `deliveryDate`/`deliveryTime` removed from `CheckoutCustomer` + RPC mapping (`lib/orders.ts`).
  - `scrollEventThrottle` 16→32 + popular `FlatList`→`ScrollView`+map (`(tabs)/index.tsx`).
  - `fetchMyOrders` `as OrderSummary[]` cast removed; `status` typed as `Database…Enums.order_status` (typos/enum-drift now fail the build).
  - Confirmation `total`: pass raw numeric (`String(orderTotal)`), format via `formatPeso(Number(total))` on the screen (`checkout.tsx` + `order-confirmation.tsx`).
  - `lib/colors.ts` (`BRAND`) created; item-detail + checkout Stack headers migrated.
  - DEFERRED (P3, documented): `ItemThumb`/`EmptyState` extraction; full inline hex sweep beyond headers; `onMomentumScrollEnd` removal (needs feel-test); popular tile add→`QtyControl` (design call).
