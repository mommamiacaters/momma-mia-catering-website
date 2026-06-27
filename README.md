# Momma Mia Catering Website

A React-based website for Momma Mia Catering -- a food service business offering packed lunches, party trays, fun boxes, full-service catering, and equipment rental. The site features a dynamic meal ordering system, AI-powered chatbot, and contact form, all backed by Supabase (Postgres + Edge Functions). 

**Live site:** [https://mommamiacaters.com](https://mommamiacaters.com)

---

## Tech Stack

- **React 18 + TypeScript** -- Component-driven UI with static type safety
- **Vite** -- Fast development server and optimized production builds
- **Tailwind CSS** -- Utility-first styling with custom design tokens
- **PrimeReact** -- Sidebar, Accordion, and ProgressBar components
- **React Router v7** -- Client-side routing with SPA navigation
- **Supabase** -- Postgres (catalog, orders, leads), Auth, Storage, and Edge Functions (order emails + Gemini chatbot)
- **GitHub Pages** -- Hosting with custom domain

---

## Project Structure

The web app (`apps/web/`) is organized as follows:

```
apps/web/src/
  components/       # Reusable UI components
    Accordion/      # Meal plan item accordion (PrimeReact)
    Carousel/       # Image carousel with drag-to-swipe and lightbox
    Chatbot/        # AI-powered chat widget with service selection
    CheckALunch/    # Check-a-Lunch meal plan ordering UI
    ContactSection/ # Full-bleed CTA section
    Footer/         # Site footer with newsletter signup
    Image/          # Lazy-loaded image wrapper
    MealCard/       # Service card for masonry grid
    Navigation/     # Top nav with scroll-hide behavior
    ProductCatalog/ # Menu item grid with add/remove controls
    ProgressBar/    # PrimeReact progress bar wrapper
    ShoppingBag/    # Floating bag button + sidebar toggle
    Sidebar/        # Order summary sidebar (PrimeReact)
  constants/        # Shared constants (nav links, social links, meal plan config)
  hooks/            # Custom React hooks (useOrderManagement)
  images/           # Static image assets organized by service
  pages/            # Route-level page components
    AboutPage/
    ContactPage/
    MealsPage/
    ServicePage/
  services/         # API service layer (menuService with caching)
  types/            # Shared TypeScript type definitions
  utils/            # Utility functions (meal plan distribution algorithm)
```

---

## Monorepo Layout

This project is a **pnpm workspace** containing two apps:

```
momma-mia-catering-website/
├── apps/
│   ├── web/        # @momma-mia/web    — React 18 + Vite website  (this repo's main site)
│   └── mobile/     # @momma-mia/mobile — Expo (React Native) app
├── package.json    # root scripts to run either app, or both at once
└── pnpm-workspace.yaml
```

All commands below are run from the **repo root**.

---

## Getting Started

### Prerequisites

- **Node.js 18+**
- **pnpm 9+** — enable via `corepack enable` (this repo uses pnpm, **not** npm/yarn)
- For mobile: the **Expo Go** app on your phone, or an Android/iOS emulator

> ⚠️ **Always install with `pnpm install`.** Running `npm install` or `yarn` here creates a competing lockfile and a `node_modules` layout that breaks Expo/Metro.

### Installation

```bash
git clone https://github.com/<your-username>/momma-mia-catering-website.git
cd momma-mia-catering-website
pnpm install
```

Then create a `.env` file for the web app (see [Environment Variables](#environment-variables) below).

---

## Running the Apps

Run any of these from the **repo root** (`pnpm run …` and `npm run …` both work):

| Command                       | Runs                               | Result                                                          |
|-------------------------------|------------------------------------|-----------------------------------------------------------------|
| `npm run start`               | **Web + Mobile** together          | Web in the browser **and** the mobile app on the Android emulator |
| `npm run start:web`           | Web only                           | http://localhost:5174 (or 5173 if free)                         |
| `npm run start:mobile`        | Mobile on the **Android emulator** | Auto-boots the `momma_pixel` AVD, starts Metro, opens the app   |
| `npm run start:mobile:expo`   | Mobile via **Expo Go**             | Prints a **QR code** for a physical iPhone / Android phone      |

> 💡 `npm run start` is the everyday command: it launches the **website and the mobile app on the Android emulator** at the same time (color-coded `[web]` blue / `[mobile]` magenta; one `Ctrl+C` stops both).

### Mobile — the two ways to run

**① Android emulator** (default — used by `npm run start` and `npm run start:mobile`)

`start:mobile` runs `scripts/run-android.mjs`, which does the whole dance for you:
1. starts the adb server,
2. **boots the `momma_pixel` emulator** if one isn't already running,
3. waits for it to finish booting,
4. sets `adb reverse tcp:8081` (so the emulator can reach Metro),
5. starts Metro and **opens the app on the emulator automatically**.

_Prereqs:_ Android Studio + an AVD named **`momma_pixel`** (override with `MOMMA_AVD=<name>`), **Expo Go installed on that emulator**, and `ANDROID_HOME` / `ANDROID_SDK_ROOT` pointing at your SDK.

**② Expo Go on a physical phone — iPhone _or_ Android**

```bash
npm run start:mobile:expo        # prints a QR code (phone + computer on the same Wi-Fi)
```
- **iPhone:** open the **Camera** app, point it at the QR → opens in Expo Go.
- **Android:** open **Expo Go** → _Scan QR code_.
- Strict/!shared network? use a tunnel: `pnpm --filter @momma-mia/mobile exec expo start --tunnel`.

> For active mobile debugging, run `npm run start:mobile` in **its own terminal** — Metro's interactive keys (`r` reload, `a` reopen on Android) are unreliable when web + mobile share one terminal.

> 🛠️ **Troubleshooting**
> - **"No Android connected device found" / `expo start --android` fails:** that's exactly why `start:mobile` uses the helper script (it boots the emulator itself). If it still can't, open the AVD once from Android Studio, confirm `adb devices` lists `emulator-5554`, then re-run.
> - **App shows a blue "Something went wrong":** the `adb reverse` mapping was lost (e.g. after `adb kill-server` or an emulator reboot). Just re-run `npm run start:mobile` — or manually `adb -s emulator-5554 reverse tcp:8081 tcp:8081` and reload. _(Tell-tale: the Metro log shows **no** "Bundled" line — it's a connectivity issue, not your code.)_
> - **`expo start --android` targets a phantom `emulator-5562`:** the Nahimic `NTKDaemonService` (port 5563) confuses adb. The helper script sidesteps it; to use `--android` directly, stop that service (admin).

### Build & Lint (web)

| Command             | Description                      |
|---------------------|----------------------------------|
| `npm run web:build` | Build the web app for production |
| `npm run web:lint`  | Run ESLint on the web app        |

---

## Mobile App Distribution (EAS Update)

The mobile app is published as an **over-the-air (OTA) update** to Expo's cloud, fetched on demand by Expo Go. This gives you a permanent demo URL anyone can open on their iPhone/Android without a paid Apple Developer account, without your PC running, and without re-installing.

**One-time cloud setup is already done** for this repo (Expo project `kitdaniellim/momma-mia`, ID `ab9df9a6-e698-420d-895e-467d8a6bf739` — see `apps/mobile/app.json` and `apps/mobile/eas.json`). You only repeat the setup if you fork.

### Releasing an update to production

Every time you change mobile code and want viewers to see it:

```bash
cd apps/mobile
eas update --branch production --message "<one-line description of the change>"
```

What happens:
1. Metro bundles your app for iOS + Android (~2-5 min, both targets in parallel).
2. Hermes compiles both bundles to bytecode.
3. The bundles + assets are uploaded to Expo's CDN at `https://u.expo.dev/<projectId>`.
4. The update is registered on the `production` branch.
5. You get an EAS Dashboard URL with a QR code anyone can scan.

The next time someone opens Expo Go and taps your project, they get the new bundle automatically — no re-install, no re-scan.

### How viewers open the app on their iPhone

**Option A — Sign-in flow (best for repeat use):**
1. Install **Expo Go** from the App Store (one-time).
2. Open Expo Go → Profile tab → Sign in with your Expo account.
3. Tap **Projects** → "Momma Mia" → app launches full-screen.
4. After first load the bundle is cached — subsequent opens work offline.

**Option B — QR scan (best for sharing with someone new):**
1. Open your update's EAS Dashboard page: `https://expo.dev/accounts/<account>/projects/momma-mia/updates/<update-id>`.
2. Have the viewer scan the QR with iPhone Camera (not Expo Go itself).
3. iOS deep-links into Expo Go and loads the bundle.

### Updating the mobile app — checklist

| Step | Command | Notes |
|---|---|---|
| 1. Test locally | `npm run start:mobile:expo` | Scan QR with Expo Go on the same Wi-Fi |
| 2. Confirm `apps/mobile/.env` has the right Supabase vars | — | `EXPO_PUBLIC_*` prefix required |
| 3. Publish | `cd apps/mobile && eas update --branch production --message "<change>"` | ~3 min |
| 4. Open Expo Go on phone | — | The new bundle downloads on next launch |

> 💡 **Two channels available.** `--branch production` is what viewers consume. `--branch preview` is for internal-only test builds when you want to test a risky change without affecting the demo your boss is about to open.

### Mobile distribution gotchas

> 🛠️ **Workspace-root EAS commands write configs to the wrong place.**
> EAS commands (`eas init`, `eas update`, `eas build`) **must be run from `apps/mobile/`**, not from the repo root. The CLI looks for `app.json` adjacent to the cwd — running from root creates a stray `app.json` at workspace root and leaks credentials into the wrong location.

> 🛠️ **`@supabase/supabase-js` uses `import(OTEL_PKG)` which Hermes can't compile.**
> The ESM dist of `@supabase/supabase-js@^2.106` lazy-loads `@opentelemetry/api` via a dynamic `import()` with a variable argument. Hermes (the production JS engine) refuses to compile this because it can't statically resolve the module path. The fix is captured in `patches/@supabase+supabase-js+<version>.patch` and re-applied by `patch-package` on every `pnpm install` — **don't remove the `postinstall` script.** If you upgrade Supabase, regenerate the patch: edit `node_modules/@supabase/supabase-js/dist/index.mjs` to replace the `loadOtel()` body with `Promise.resolve(null)`, then `npx patch-package @supabase/supabase-js`.

> 🛠️ **pnpm refuses to install `expo-updates` via `eas update:configure`.**
> pnpm 11 in workspace mode blocks `pnpm add` calls that look like they target the workspace root, which Expo CLI's auto-installer triggers. Workaround: install `expo-updates` manually first (`cd apps/mobile && pnpm add expo-updates@~29.0.18`), then re-run `eas update:configure`.

> 🛠️ **Windows Defender + pnpm temp-rename races.**
> See [`patches/`](#) and the `--config.package-import-method=copy` flag. Add `node_modules` to Defender exclusions on long-term dev machines.

---

## Scaling: From Expo Go Demo to App Store

The current setup (EAS Update + Expo Go) is the **free demo tier**. Each step up costs more time/money but removes constraints. Ladder:

| Stage | What viewers see | Constraints | Cost |
|---|---|---|---|
| **1. Current — EAS Update + Expo Go** | Tap "Momma Mia" project in Expo Go, app launches full-screen | Viewers need Expo Go installed; bundle must match Expo Go's SDK | Free |
| **2. Custom dev client via EAS Build** | "Momma Mia" icon on home screen, no Expo Go required | iOS install needs paid Apple Dev account ($99/yr) OR sideloading (7-day re-sign cliff) | $99/yr (iOS) or free (Android sideload) |
| **3. TestFlight beta** | Real install with in-app updates; up to 10,000 testers via invite link | Apple review (~24 hr first time, ~hours after); requires App Store Connect | Same $99/yr |
| **4. App Store + Google Play production** | Public install for anyone in the Philippines App Stores | Full app review (~1-7 days first submission); store listing assets required | $99/yr (Apple) + $25 once (Google) |

### Stage 2: Custom dev client (next step from here)

When you outgrow Expo Go (e.g., need push notifications, custom native modules, or just want a "Momma Mia" icon on the home screen):

```bash
cd apps/mobile
eas build --platform ios --profile preview     # cloud Mac build, ~15 min, outputs an .ipa
eas build --platform android --profile preview # outputs an .apk
```

Profiles are defined in `eas.json`:
- **`development`** — a dev client with the debugger UI, used during native development (when you outgrow Expo Go and need to test features Expo Go doesn't support).
- **`preview`** — internal release: a real signed `.ipa`/`.apk`, distributed via QR install link (no App Store needed). This is the "Momma Mia icon on home screen, no Apple Dev account for Android, $99/yr for iOS" stage.
- **`production`** — production-quality build destined for the App Store.

Once you have a preview build installed, **`eas update --branch production`** continues to work — the dev client fetches updates from the same channel. So the OTA workflow you have now scales unchanged.

### Stage 3: TestFlight (closed beta)

When the app is solid enough to share with beta testers:

```bash
eas build --platform ios --profile production
eas submit --platform ios --latest          # auto-uploads the build to App Store Connect
```

Then in App Store Connect, add the build to a TestFlight group, send the invite link to testers. They install via the TestFlight app on iPhone — real installs, real updates, no Expo Go.

Apple requires you to fill out an Export Compliance form once per build (your `app.json` already declares `usesNonExemptEncryption: false`, which auto-passes this for most apps).

### Stage 4: App Store + Play Store production

After the TestFlight beta is stable:
- **App Store**: from App Store Connect, "Submit for Review" → Apple reviews (1-7 days first time). You'll need: store listing (description, screenshots from at least one device size), age rating, privacy policy URL, support URL.
- **Play Store**: `eas submit --platform android` → Google Play Console handles the rest. Faster review (hours, sometimes minutes) but stricter policy checks on data collection.

### When to skip stages

- If your audience is *Filipino catering customers*, jump from Stage 1 → Stage 4 once the app is production-ready. TestFlight is mainly useful when you have technical beta testers giving feedback.
- If your audience is *yourself + a few partners*, you can live in Stage 2 (preview builds shared via QR) indefinitely — no store review, no public listing.

### Ongoing-cost summary

| Per year | What | When |
|---|---|---|
| **$99** | Apple Developer Program | Required from Stage 2 (iOS) onward |
| **$25 once** | Google Play Developer | Required from Stage 4 (Android) |
| **Free** | EAS Build (30 builds/month) + EAS Update (unlimited at this size) | Suitable through Stage 4 for small apps |

---

## Environment Variables

Create `apps/web/.env`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable anon key>
```

Only the publishable (anon) key belongs in the client — RLS is the real boundary.
n8n is fully retired, so the old `VITE_N8N_*` / `VITE_CHECKOUT_TOKEN` vars are gone.

---

## Backend Integration

Everything runs on Supabase (n8n decommissioned):

| Feature        | How                                                                           |
|----------------|-------------------------------------------------------------------------------|
| Menu / catalog | `menu_items` table read by `menuService.ts` (5-minute client cache)           |
| Orders         | `create_order` SECURITY DEFINER RPC; emails via `order-notify` Edge Function   |
| AI chatbot     | `chat` Edge Function (Gemini 2.5 Flash); quote leads → `quote_requests` table  |
| Contact form   | Insert into `contact_submissions`; owner email via a trigger → `order-notify`   |

All transactional email is sent by the `order-notify` Edge Function (Resend),
driven by DB triggers (`kind`: `store_alert`, `customer_confirmation`,
`customer_receipt`, `contact_message`, `quote_lead`).

---

## Deployment

The site is deployed to GitHub Pages via GitHub Actions. The workflow builds the Vite project and deploys to the `gh-pages` branch. A custom domain (`mommamiacaters.com`) is configured via the `CNAME` file.

To deploy manually: push to the `main` branch and the GitHub Actions workflow will handle the rest.

---

## Key Architecture Decisions

- **Shared types** in `src/types/` eliminate duplicate interface definitions across components.
- **`useOrderManagement` hook** extracts all meal plan ordering logic from ServicePage, keeping the page component focused on layout and rendering.
- **`mealPlanUtils.ts`** provides a reusable item distribution algorithm used by both Sidebar and Accordion.
- **`menuService.ts`** is a singleton with built-in 5-minute caching to reduce redundant network requests.
- **Constants are centralized** in `src/constants/` (navigation links, social links, meal plan configuration) to keep configuration out of component code.
- **GitHub Pages SPA routing** is handled via a custom `404.html` redirect, ensuring client-side routes work correctly on page refresh.

---

## Design Tokens

Defined in `tailwind.config.js`:

| Token             | Value     | Usage                          |
|-------------------|-----------|--------------------------------|
| `brand-primary`   | `#E36A2E` | Orange -- buttons, headers, accents |
| `brand-secondary` | `#F3E7D8` | Cream -- page backgrounds      |
| `brand-text`      | `#2E2A25` | Dark brown -- body text         |
| `brand-accent`    | `#F2B34A` | Gold -- gradients, highlights   |
| `brand-divider`   | `#D9CDBE` | Tan -- borders, dividers        |

**Fonts:**
- **Arvo** (serif) -- Headings
- **Poppins** (sans-serif) -- Body text
