---
status: complete
priority: p2
issue_id: "003"
tags: [code-review, quality, bug]
dependencies: []
---

# P2: Scroll-spy active-chip freeze (sparse offsets) + inconsistent error handling

## Problem Statement
Two small correctness bugs:
1. **Scroll-spy freezes the active chip on manual scroll.** `onScroll` scans
   `sectionOffsets.current` with `if (offs[i] != null && offs[i] <= y) active = i; else break;`
   — an unmeasured **hole** (`null`) at index `i` hits `else break`, stopping the scan and
   freezing the active category at the last contiguous measured section. (This is the
   observed "active chip doesn't sync while scrolling" symptom.)
2. **`e.message` on `unknown` catch.** `orders.tsx` and `lib/orders.ts fetchMyOrders` do
   `.catch((e) => setError(e.message))`, assuming `e` is an Error; a non-Error throw renders
   `undefined`. Other sites correctly use `e instanceof Error ? e.message : '...'`.

## Findings (kieran-typescript #4/#6)
- `apps/mobile/app/(tabs)/index.tsx:75-78` — `break` on null hole.
- `apps/mobile/app/(tabs)/orders.tsx:24`, `apps/mobile/lib/orders.ts:126` — unguarded `e.message`.

## Proposed Solutions
1. `for (...) { if (offs[i] == null) continue; if (offs[i] <= y) active = i; else break; }`
2. `setError(e instanceof Error ? e.message : 'Failed to load orders.')` at both sites.

## Recommended Action
(blank — triage). Both are ~1-line, low-risk; good quick wins.

## Acceptance Criteria
- [x] Manually scrolling the menu updates the active category chip through every section.
- [x] A non-Error rejection in order fetch shows a readable message, not blank.

## Work Log
- 2026-05-24: Filed from /workflows:review (kieran-typescript #4/#6).
- 2026-05-24: Fixed. `index.tsx:75-79` now `if (offs[i] == null) continue;` (was `else break`).
  `orders.tsx:24` + `lib/orders.ts` guarded with `e instanceof Error ? e.message : '…'`.
  tsc clean. Verified on Android emulator: scrolling into Add-ons flips the active chip
  from "Check-a-Lunc" → "Add-ons" (previously froze). DONE.
