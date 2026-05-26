---
status: complete
priority: p2
issue_id: "004"
tags: [code-review, accessibility, quality]
dependencies: []
---

# P2: Add accessibility labels/roles to icon-only + text buttons

## Problem Statement
No primary action is unreachable, but several icon-only controls have **no a11y label**
(degraded for screen readers + fragile for automation), and ~12 text buttons lack
`accessibilityRole="button"` so they announce as plain text. `QtyControl`, `ViewCartBar`,
and `CategoryCircles` already model the correct pattern — apply it consistently.

## Findings (agent-native-reviewer)
- **Worst (icon-only / anonymous in a state):** `app/item/[id].tsx:75,82,89` (detail stepper + Add — no labels), `app/checkout.tsx:134` (proof picker becomes label-less once an image is attached), `app/cart.tsx:24,84` (back chevron, trash), `components/MenuItemCard.tsx:48` (+ button) & `:21` (card), `components/SearchBar.tsx:25,14` (clear button, input).
- **Roleless text buttons:** HeroBanner "Order now", account Sign in/out/toggle, orders "Go to Account", index "Retry", order-confirmation CTAs, cart "Go to checkout"/"Manage", checkout "Place order".
- **Consider:** fold cart count into the top cart icon label; `Field` `TextInput`s need `accessibilityLabel={label}`.

## Proposed Solution
Add `accessibilityRole="button"` + a stable `accessibilityLabel` to each control above
(e.g. "Decrease quantity", "Attach payment screenshot", `Add ${item.name}`,
`Remove ${item.name}`, "Clear search", "Search menu"). Mirror `QtyControl`'s pattern.

## Recommended Action
(blank — triage). Low-risk, mechanical; can be done in one pass.

## Acceptance Criteria
- [x] Every icon-only control has an `accessibilityLabel`.
- [x] Primary/text buttons have `accessibilityRole="button"`; the proof picker stays labeled when an image is attached.
- [x] Checkout `TextInput`s carry `accessibilityLabel`.

## Work Log
- 2026-05-24: Filed from /workflows:review (agent-native-reviewer).
- 2026-05-24: Applied across all screens — index (cart icon label w/ count, Retry),
  orders (Go to Account), MenuItemCard (card + add, tap target → h-11 w-11),
  SearchBar (input + clear), item/[id] (steppers "Decrease/Increase quantity" h-11,
  Add label w/ qty+name), cart (back, Manage, Browse, trash "Remove …" h-11, checkout),
  checkout (proof picker label survives attach, Place order w/ disabled state, Field labels),
  HeroBanner (Order now), order-confirmation (both CTAs), account (sign out/in/up +
  disabled state, mode toggle). tsc clean. DONE.
