---
title: "Mobile Phase A — Shared Foundation (packages/db, packages/supabase + mobile Supabase wiring)"
type: feat
status: completed
date: 2026-05-24
origin: docs/brainstorms/2026-05-24-mobile-client-app-brainstorm.md
---

# ✨ Mobile Phase A — Shared Foundation

## Enhancement Summary

**Deepened on:** 2026-05-24 (5 parallel agents: architecture, TypeScript, simplicity,
pattern-consistency reviewers + Expo/Supabase pitfalls research). Findings verified
against the **installed** `@supabase/supabase-js@2.106.1` and the generated types file.

### Key changes from the first draft
1. **Cut `packages/validation`** (was 3 packages → now **2**). It was admitted
   placeholder wired in Phase D/E and pulled in an unused `zod` dep. Deferred to the
   phase that first needs a real schema. (simplicity + architecture consensus)
2. **`packages/db` barrel no longer redefines `Tables<T>`.** Verified: the generated
   `database.types.ts` already exports `Tables`/`TablesInsert`/`TablesUpdate`/`Enums`
   (lines 340/369/394/419). Redefining `Tables<T>` = **`TS2308` build break**. Reuse the
   generated helper; add only an explicit `Json`/`Database` re-export for safety.
3. **Removed `processLock` / `lock` from the mobile client.** Verified: it is **not**
   exported by `@supabase/supabase-js@2.106.1` (only by `@supabase/auth-js`). Phase A
   has no sessions, so `lock` is unnecessary now; revisit at auth (Phase E).
4. **`fetchMenuItems` row type derived via `QueryData`; `normalizeRow` inlined** and
   pinned to mirror `apps/web/src/services/menuService.ts:84-99` exactly (category
   array-or-object unwrap, `'uncategorized'` fallbacks, `price_cents == null ? null : /100`).
5. **`CatalogItem.categorySlug` → `category`** to match web's existing field name
   (avoids forced renames during the later web migration).
6. **Factory options type derived** (`Parameters<typeof createClient<Database>>[2]`)
   instead of hand-pinned `SupabaseClientOptions<'public'>`.
7. **Added per-package `tsconfig.json` + `pnpm -r exec tsc --noEmit` gate** — the
   `web:build` gate alone never type-checks `packages/supabase` (false green).
8. **Encoded four guardrail invariants** (see "Guardrail Invariants").

---

## Overview

Stand up the monorepo's shared `packages/` layer and wire the Expo mobile app to the
**existing** hosted Supabase backend, so later phases build on one source of truth.

This is **plumbing, not features**. Exit state: `@momma-mia/db` (shared types) and
`@momma-mia/supabase` (client factory + menu query) exist, the web app consumes the
shared types, and mobile can read live `menu_items` rows on the emulator.

Scope = the "A — Shared foundation" section of the brainstorm
(see brainstorm: `docs/brainstorms/2026-05-24-mobile-client-app-brainstorm.md`).
NativeWind + Expo Router are **Phase B**, out of scope.

## Problem Statement / Motivation

- "Admin changes reflect on web **and** mobile" requires **one** generated-types
  source + **one** client/query layer. Today the types live inside `apps/web`.
- Mobile has no `@supabase/supabase-js` dep yet, so it can't read the catalog.
- The web Supabase client is browser-configured (`detectSessionInUrl: true`,
  implicit `localStorage`); RN needs `AsyncStorage` + polyfill + `detectSessionInUrl:false`.

## Guardrail Invariants (encode these; they're the latent landmines)

1. **Shared packages stay React-free — forever.** `apps/web` is React **18.3.1**,
   `apps/mobile` is React **19.2.0** (verified). Any `react`/`react-native` import in
   `packages/*` under `nodeLinker: hoisted` risks dual-React "Invalid hook call".
   `packages/db` and `packages/supabase` import neither — keep it that way.
2. **The factory never reads env.** Apps inject `url`/`key` (web `import.meta.env`,
   mobile `process.env.EXPO_PUBLIC_*`). Keeps the package build-tool-agnostic.
3. **One regen path.** A single committed root script writes the generated types;
   the old `apps/web/src/types/database.types.ts` is **deleted** after the move so a
   stale regen can't resurrect it.
4. **The `menu_items` select string lives in exactly one place** (`fetchMenuItems`).
   Web keeps a *tracked* copy this phase; it is a known clone until web migrates.

## Proposed Solution

`packages/*` glob + `nodeLinker: hoisted` already exist in `pnpm-workspace.yaml`;
there's no `packages/` dir yet.

```
packages/
  db/            # @momma-mia/db        — generated Supabase types (ONE source)
  supabase/      # @momma-mia/supabase  — createSupabaseClient factory + fetchMenuItems
apps/
  mobile/
    lib/supabase.ts   # RN client from the factory (AsyncStorage + url polyfill)
    .env              # EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY (hosted project)
  web/                # 4 type imports repointed to @momma-mia/db; client untouched
```

> `packages/validation` and `packages/config` (PLATFORM_PLAN §6) are **intentionally
> deferred** — created in the phase that first needs them. Web's working
> `supabase.ts`/`menuService.ts` are **not** rewritten in Phase A (types only).

## Technical Approach

### 1. `packages/db` — generated types (single source)

- **Move:** `apps/web/src/types/database.types.ts` → `packages/db/src/database.types.ts`
  (plain `mv`; user handles git per [[feedback-no-git-staging]]). **Delete the original.**
- `packages/db/package.json`: `{ "name":"@momma-mia/db", "private":true, "version":"0.0.0", "main":"./src/index.ts", "types":"./src/index.ts" }`
- `packages/db/src/index.ts` — **do not redefine `Tables`** (collision, verified):
  ```ts
  // Single source of Supabase types. NEVER hand-edit database.types.ts (generated).
  export * from './database.types';                 // re-exports Tables/Enums/Json/Database/...
  export type { Json, Database } from './database.types'; // explicit: guard against export* drop
  import type { Tables } from './database.types';    // reuse the GENERATED helper
  export type MenuItemRow = Tables<'menu_items'>;    // keep: Phase B uses it
  // (CategoryRow/OrderRow omitted — no Phase A/B caller; add when imported)
  ```
- `packages/db/tsconfig.json`: minimal `{ strict, moduleResolution:"bundler", noEmit }`.
- **Repoint the 4 web importers** to `@momma-mia/db` (only `Database`/`Json` consumed):
  `apps/web/src/lib/supabase.ts:5`, `services/settingsService.ts:5`,
  `hooks/useStoreSettings.ts:10`, `pages/admin/AdminSettings.tsx:7`.
- Add `"@momma-mia/db": "workspace:*"` to `apps/web/package.json`.
- Add a root script: `"db:types": "supabase gen types typescript ... > packages/db/src/database.types.ts"` (single place the path lives).

### 2. `packages/supabase` — client factory + menu query

- `packages/supabase/package.json`: `@momma-mia/supabase`, `main`/`types` → `src/index.ts`,
  deps `{ "@supabase/supabase-js":"^2.106.1", "@momma-mia/db":"workspace:*" }`.
  **No `react`/`react-native`** (Invariant 1).
- `packages/supabase/src/client.ts` — factory with a **derived** options type (TS M2):
  ```ts
  import { createClient } from '@supabase/supabase-js';
  import type { Database } from '@momma-mia/db';

  type ClientOptions = Parameters<typeof createClient<Database>>[2]; // exact param type
  export function createSupabaseClient(url: string, anonKey: string, options?: ClientOptions) {
    return createClient<Database>(url, anonKey, options);
  }
  export type AppSupabaseClient = ReturnType<typeof createSupabaseClient>;
  ```
- `packages/supabase/src/menu.ts` — row type inferred from the query; `normalizeRow`
  inlined to match `menuService.ts:84-99` (faithful per pattern review):
  ```ts
  import { type QueryData } from '@supabase/supabase-js';
  import type { AppSupabaseClient } from './client';

  // CatalogItem is an intentional VIEW MODEL (renames/derives) — not a DB row.
  export interface CatalogItem {
    id: string; name: string; description: string | null;
    price: number | null;            // price_cents/100; null = "price on request"
    category: string; categoryName: string;   // slug + display name (match web shape)
    type: string | null; image: string | null;
    isAvailable: boolean; isCatering: boolean;
  }

  const menuQuery = (c: AppSupabaseClient) =>
    c.from('menu_items')
     .select('id, name, description, image_url, price_cents, item_type, is_available, is_catering, category:categories(slug, name)')
     .eq('is_available', true)
     .order('sort_order', { ascending: true });
  type MenuRow = QueryData<ReturnType<typeof menuQuery>>[number];

  function normalizeRow(row: MenuRow): CatalogItem {
    const cat = Array.isArray(row.category) ? row.category[0] : row.category; // embed array-or-object
    return {
      id: row.id, name: row.name, description: row.description,
      price: row.price_cents == null ? null : row.price_cents / 100,         // null preserved (NOT 0)
      category: cat?.slug ?? 'uncategorized', categoryName: cat?.name ?? 'Uncategorized',
      type: row.item_type, image: row.image_url,
      isAvailable: row.is_available, isCatering: row.is_catering,
    };
  }

  export async function fetchMenuItems(client: AppSupabaseClient): Promise<CatalogItem[]> {
    const { data, error } = await menuQuery(client);
    if (error) throw error;
    return (data ?? []).map(normalizeRow);
  }
  ```
- `packages/supabase/src/index.ts`: `export * from './client'; export * from './menu';`
- `packages/supabase/tsconfig.json`: minimal strict config (so it's type-checked standalone).

### 3. `apps/mobile` — Supabase wiring (RN-specific glue stays here)

- Install: `npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill`
  + workspace deps `@momma-mia/supabase`, `@momma-mia/db` (`workspace:*`).
- `apps/mobile/.env`:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://fbzwicfvhrtyfqjounvo.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=<copy from apps/web/.env VITE_SUPABASE_ANON_KEY>
  ```
- `apps/mobile/lib/supabase.ts` — **no `processLock`** (not exported by 2.106.1):
  ```ts
  import 'react-native-url-polyfill/auto';                 // MUST be the first import
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { AppState } from 'react-native';
  import { createSupabaseClient } from '@momma-mia/supabase';

  export const supabase = createSupabaseClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { storage: AsyncStorage, autoRefreshToken: true,
              persistSession: true, detectSessionInUrl: false } },
  );

  // Auto-refresh while foregrounded. (Offline-refresh hardening → Phase E, with auth.)
  AppState.addEventListener('change', (s) =>
    s === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());
  ```
- **Smoke test** (temporary in `App.tsx`, removed in Phase C): `fetchMenuItems(supabase)`
  in a `useEffect`, render "Loaded N menu items".

### 4. Metro / TypeScript resolution

- **Metro:** `apps/mobile/metro.config.js` already has the canonical monorepo
  `watchFolders=[monorepoRoot]` + `nodeModulesPaths` — **keep it as-is.** Verification
  order if a `@momma-mia/*` import fails: (1) `npx expo start --clear`; (2) check the
  package is hoisted/symlinked; (3) only then touch the resolver. **Do not** "simplify
  to auto-config" as a first move (it would drop the known-good explicit paths), and
  **do not** pre-add a `babel module-resolver` alias — verify the source-package import
  actually fails before adding transpile config (official Expo monorepo pattern says
  Metro+Babel transpile sibling `src` packages within watchFolders).
- **TypeScript:** no path aliases — pnpm symlinks `node_modules/@momma-mia/*` → `packages/*`,
  and each package's `"types": "./src/index.ts"` resolves. Each package ships its own
  `tsconfig.json` so it's checkable standalone.

## Acceptance Criteria

- [x] `packages/db`, `packages/supabase` exist with the package.json shapes above;
      `pnpm install` links them (verified `apps/mobile/node_modules/@momma-mia/{db,supabase}` symlinks).
- [x] `database.types.ts` lives in `packages/db/src/`; the original under
      `apps/web/src/types/` is **deleted**; the 4 web imports point at `@momma-mia/db`.
- [x] **`pnpm run web:build` succeeds** (live-site regression gate — `✓ built in 3.28s`).
- [x] **`tsc --noEmit` clean for the typed surfaces:** `@momma-mia/db`, `@momma-mia/supabase`,
      and `apps/mobile` all pass. (Note: a full `pnpm -r exec tsc` is NOT globally green because
      `apps/web` carries **7 pre-existing** type errors — unused vars + a lib-target `.at()` +
      an enum cast — none React-types-related and none introduced here. Web ships via Vite
      (no `tsc` gate), so `web:build` is web's real gate.)
- [x] `apps/mobile` depends on `@momma-mia/supabase`, `@momma-mia/db`,
      `@supabase/supabase-js`, AsyncStorage, `react-native-url-polyfill`.
- [x] On emulator, the smoke test renders **"Loaded 74 menu items ✅"** (live hosted DB).
- [x] No `packages/validation`, NativeWind, or Expo Router introduced (deferred).
- [x] No `react`/`react-native` import in any `packages/*` (Invariant 1).

## Implementation Notes & Verification (completed 2026-05-24)

- **`@types/react` dedup (new, unplanned but necessary):** adding the RN deps surfaced the
  web-React-18 / mobile-React-19 split — root hoisted `@types/react@18.3.29` while RN nested
  19.x, breaking `apps/mobile` `tsc` (`bigint`/`ReactNode` JSX errors). Fixed with
  `overrides: { '@types/react': 19.2.15 }` in **`pnpm-workspace.yaml`** (pnpm 11 no longer reads
  the `package.json` `pnpm` field). Verified web build + web types unaffected (its 7 tsc errors
  predate this and aren't React-types errors).
- **Metro cache gotcha:** after linking workspace packages mid-session, Expo Go showed a stale
  "@momma-mia/supabase could not be found" LogBox. Fix = `npx expo start --clear` + `adb
  force-stop host.exp.exponent` to force a real JS re-fetch (an `am start` only foregrounds).
  Confirmed resolution works via 3 signals: clean `tsc`, a 200 `index.bundle` containing the
  symbols, and Metro logging `Android Bundled (772 modules)` with no error.
- **Verified:** `menu_items` readable by the anon key (74 rows); mobile app renders the count.
- **Windows install flake:** the `@types/react` relink hit a transient `primereact_tmp` ENOENT;
  cleared stray temp dirs + reinstalled (settled in 1.7s).

## Dependencies & Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Metro can't resolve/transpile `@momma-mia/*` source pkg | Med | `nodeLinker: hoisted` + existing explicit resolver; `--clear`; verify before adding babel config |
| supabase-js bundles `ws`/`stream` → Metro `node:*` error (realtime) | Med | Don't import realtime in Phase A; if it surfaces, add resolver shim/disable realtime ([supabase-js#1434]) |
| Moving types breaks web build | Low | 4 type-only imports; gated on `web:build` |
| `processLock`/doc-vs-version drift | Resolved | Verified absent in 2.106.1 → removed; use `@supabase/auth-js` if needed in Phase E |
| `Tables<T>` collision in db barrel | Resolved | Verified generated helper exists → reuse it, don't redefine |
| Dual React (18 web / 19 mobile) | Low | Invariant 1: shared packages React-free; hoisting dedupes |
| Offline session loss via startAutoRefresh | Deferred | No sessions in Phase A; harden in Phase E (NetInfo gate) |
| SDK 55 New Arch enforced | Low | `app.json` has no stale `newArchEnabled:false` (verified); nothing to do |

## Deferred Follow-ups (tracked, not Phase A)

- **Web migration onto the shared layer** (sequence: client first → then make
  `menuService.getFullCatalog` call `fetchMenuItems`, keeping web's cache + legacy
  `MenuData` reshaping as a web-side adapter; reconcile `CatalogItem` field names).
- **Collapse `apps/web/src/types/menu.ts`** (`Category`, `MenuItemRecord`) onto
  `@momma-mia/db` — currently a hand-written duplicate of two tables.
- **`packages/validation`** (zod) — create at Phase D (cart) with real schemas.
- **`packages/config`** (shared eslint/tsconfig presets) — when config drift appears.

## Sources & References

### Origin
- **Brainstorm:** [docs/brainstorms/2026-05-24-mobile-client-app-brainstorm.md](../brainstorms/2026-05-24-mobile-client-app-brainstorm.md)
  — client-app-first, Supabase-first (backend already built), shared `packages/`.

### Internal references (verified)
- `apps/web/src/types/database.types.ts` (generated; exports `Tables`@340, `Enums`@419 — move + don't redefine)
- `apps/web/src/services/menuService.ts:73-99` (canonical query + `normalizeRow` behavior to mirror)
- `apps/web/src/lib/supabase.ts:5,7-23` (client config + `Database` import)
- `apps/mobile/metro.config.js` (already-correct monorepo resolver — don't simplify away)
- `node_modules/@supabase/supabase-js/dist/index.d.mts:677` (exports `createClient`, `QueryData`, `SupabaseClientOptions`; **no `processLock`**)
- `node_modules/@supabase/auth-js/dist/module/lib/locks.d.ts:106` (`processLock` lives here)
- `pnpm-workspace.yaml` (`packages/*` glob + `nodeLinker: hoisted`); `docs/PLATFORM_PLAN.md:206-226`

### External references
- Expo monorepos: https://docs.expo.dev/guides/monorepos/
- Supabase RN quickstart: https://supabase.com/docs/guides/auth/quickstarts/react-native
- Supabase `QueryData` typing: https://supabase.com/docs/reference/javascript/typescript-support
- supabase-js RN `ws`/realtime issue: https://github.com/supabase/supabase-js/issues/1434
- Expo env vars (`EXPO_PUBLIC_`, `--clear`): https://docs.expo.dev/guides/environment-variables/
- byCedric/expo-monorepo-example: https://github.com/byCedric/expo-monorepo-example
