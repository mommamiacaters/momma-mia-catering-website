---
status: complete
priority: p2
issue_id: "005"
tags: [code-review, quality, performance]
dependencies: []
---

# P2: Auth subscription leak + bound list image decode size

## Problem Statement
1. **Auth subscription leak / dead `loading`.** `store/auth.ts init()` calls
   `supabase.auth.onAuthStateChange(...)` but never unsubscribes (typed `() => void`), and
   the `loading` field is set but read nowhere. Bounded (init runs once at root) but untidy.
2. **List images decode at source resolution.** `image_url` is passed raw to expo-image at
   88×88 (rows), 64×64 (category circles), and the popular tile. expo-image decodes to the
   *source* size; ~74 full-res photos resident ≈ up to ~280 MB bitmap memory worst case →
   GC thrash / OOM risk on low-end Android. (loremflickr placeholders are 400×400 so small;
   the pre-existing ImageKit/Storage URLs may be full-res — verify.)

## Findings (kieran-typescript #5, performance-oracle #1)
- `apps/mobile/store/auth.ts:16-19,9`; `apps/mobile/app/_layout.tsx:9-11`.
- `packages/supabase/src/menu.ts:45` (URL source); consumed in `MenuItemRow`/`MenuItemCard`/`CategoryCircles`.

## Proposed Solutions
1. `init()` returns the unsubscribe (`data.subscription.unsubscribe`); root effect cleans it up. Wire `loading` into a splash gate or remove it.
2. Derive a thumbnail URL in `menu.ts normalizeRow` (Supabase image-transform `?width=200`, or store a `thumb_url`). ~30× memory cut. **Verify actual stored image dimensions first** — if already ≤~200px, downgrade to nice-to-have.

## Recommended Action
(blank — triage)

## Acceptance Criteria
- [x] Auth state subscription is cleaned up; `loading` is used or removed.
- [~] List/circle images bounded — see note (server transform unavailable; on-device downsample + detail→expo-image).

## Work Log
- 2026-05-24: Filed from /workflows:review (kieran #5, performance-oracle #1).
- 2026-05-24: (1) DONE — `auth.ts init()` now returns `() => data.subscription.unsubscribe()`;
  `_layout.tsx` effect returns it (cleanup on unmount). Dead `loading` field removed (read nowhere).
  (2) PARTIAL — VERIFIED source dims: 49 Storage images are full-res (~1.5 MB JPEG each), NOT small.
  BUT Supabase image-transform endpoint returns **HTTP 403** (not enabled on this plan), so a
  `?width=200` thumbnail URL isn't possible. The menu lists already use **expo-image** (Glide/
  SDWebImage downsample to the 88×88 / 64×64 view size on-device + memory-disk cache + recyclingKey),
  which bounds decode memory in practice. Switched the item-detail hero from core RN `<Image>`
  (no downsample/cache) → **expo-image** (`contentFit`/`cachePolicy`). TRUE server-side bounded
  thumbnails need either Supabase Storage image transforms (Pro) or resize-on-upload in the admin
  console — filed as the real follow-up; loremflickr items are already 400×400. Both apps tsc clean.
