---
module: Momma Mia Mobile (Menu)
date: 2026-05-24
problem_type: ui_bug
component: frontend_stimulus
symptoms:
  - "Active category chip stops updating while manually scrolling the menu"
  - "Chip freezes on the last contiguous section (e.g. stuck on 'Check-a-Lunch' even when 'Add-ons' is on screen)"
  - "Tapping a chip still scrolls correctly, but free-scroll never re-syncs the chip"
root_cause: logic_error
resolution_type: code_fix
severity: medium
tags: [react-native, expo, scroll-spy, sparse-array, onlayout, async-measurement]
---

# Troubleshooting: Scroll-spy active chip freezes on a not-yet-measured section

## Problem
The home menu's sticky category rail highlights the section you're scrolled to (scroll-spy).
On manual scroll the highlighted chip would freeze on an early section and never advance,
even though later sections were clearly on screen. Tap-to-jump worked; only free-scroll
sync was broken.

## Environment
- Module: Momma Mia Mobile — home menu (`apps/mobile/app/(tabs)/index.tsx`)
- Stack: Expo SDK 55, React Native 0.83.6, NativeWind v4, Expo Router v5
- Affected Component: `onScroll` scroll-spy handler over `sectionOffsets` ref
- Date: 2026-05-24

## Symptoms
- The active (orange) category chip stopped advancing partway down the list.
- It pinned to the last *contiguous* measured section and ignored everything below it.
- Scrolling deep into Add-ons / Café Menu left the chip stuck on Check-a-Lunch.
- Tapping a chip (`jumpTo`) scrolled to the right place — so offsets *were* mostly correct.

## What Didn't Work

**Attempted Solution (earlier, related):** Measuring each section's `onLayout.y` on the
inner header `View`.
- **Why it failed:** `onLayout.y` is **relative to the immediate parent**, not the scroll
  content. Every section's inner header reported the same ~21px, so all offsets collapsed
  to one value. Fixed separately by moving `onLayout` to the section **wrapper** (the direct
  child of the `ScrollView`), which yields the true content offset. After that fix the
  measured offsets were correct (e.g. `[467, 4039, 5668, 8876, 9047]`) — but the chip
  *still* froze on scroll, which led to the real root cause below.

## Solution

The scroll-spy scan terminated on the first **unmeasured hole** in the offsets array.

**Code changes** (`apps/mobile/app/(tabs)/index.tsx`):
```ts
// Before (broken): a null hole hits `else break` and stops the scan dead.
for (let i = 0; i < offs.length; i++) {
  if (offs[i] != null && offs[i] <= y) active = i;
  else break;                 // <-- a not-yet-measured offs[i] === null breaks here
}

// After (fixed): tolerate holes, keep scanning.
for (let i = 0; i < offs.length; i++) {
  if (offs[i] == null) continue;   // hole not measured yet — skip, don't stop
  if (offs[i] <= y) active = i;
  else break;                      // genuine "we've passed the viewport" terminator
}
```

`sectionOffsets.current` is a **sparse array filled asynchronously** by each section
wrapper's `onLayout`. Off-screen / not-yet-laid-out sections leave `null` holes. The old
`else break` treated a hole identically to "this section starts below the viewport," so the
scan stopped at the first hole and froze `active` at the last contiguous measured index.

## Why This Works
1. **Root cause:** conflating *"not measured yet"* (`null`) with *"past the viewport"*
   (`offs[i] > y`). Both took the `else break` path, but only the second is a valid
   stopping condition. Because RN measures layout asynchronously and lazily, holes are
   normal and transient — the scan must skip them, not abort on them.
2. **Why the fix addresses it:** `continue` skips an unmeasured index and lets the loop
   reach later sections that *are* measured, so `active` advances to the true section. The
   `break` is preserved only for the legitimate "first section starting below the current
   scroll position" case, which keeps the scan O(sections) instead of always full-width.
3. **Underlying issue:** a loop terminator (`break`) was doing double duty as both
   "missing data" and "done" — a classic sparse-array logic bug, not a measurement or
   timing bug (the earlier `onLayout` parent-relative issue was a *separate* fix).

## Prevention
- When scanning an array that is **populated asynchronously** (`onLayout`, lazy refs,
  streamed data), treat absent entries with `continue`, never `break`. `break` is only for
  a genuine ordering terminator.
- Guard each element explicitly: `if (x == null) continue;` *before* any comparison —
  `null <= y` is coercion-truthy in JS and silently corrupts the result otherwise.
- Quick manual test for any scroll-spy: scroll past at least one full section that was
  off-screen at mount. If the highlight advances, holes are tolerated; if it sticks, you
  have a terminator-vs-missing-data bug.

## Related Issues
No related issues documented yet. (Companion fix in the same change: guard `e.message`
on `unknown` catches with `e instanceof Error ? e.message : '…'` — see
`todos/003-complete-p2-scroll-spy-hole-and-error-handling.md`.)
