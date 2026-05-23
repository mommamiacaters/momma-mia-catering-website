# Momma Mia Catering Website

A React-based website for Momma Mia Catering -- a food service business offering packed lunches, party trays, fun boxes, full-service catering, and equipment rental. The site features a dynamic meal ordering system, AI-powered chatbot, and contact form, all backed by n8n webhooks on AWS. 

**Live site:** [https://mommamiacaters.com](https://mommamiacaters.com)

---

## Tech Stack

- **React 18 + TypeScript** -- Component-driven UI with static type safety
- **Vite** -- Fast development server and optimized production builds
- **Tailwind CSS** -- Utility-first styling with custom design tokens
- **PrimeReact** -- Sidebar, Accordion, and ProgressBar components
- **React Router v7** -- Client-side routing with SPA navigation
- **n8n** -- Webhook backend for menu data, chatbot, and contact form.
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

Run any of these from the **repo root**:

| Command                       | Runs                              | Where / Result                                   |
|-------------------------------|-----------------------------------|--------------------------------------------------|
| `npm run start`               | **Web + Mobile** together         | Web in browser **+ mobile on the Android emulator** |
| `npm run start:web`           | Web only                          | http://localhost:5173                            |
| `npm run start:mobile`        | Mobile on the **Android emulator**| Boots an Android Studio AVD and opens the app    |
| `npm run start:mobile:expo`   | Mobile via **Expo Go**            | Prints a **QR code** to scan on your phone       |

> 💡 `pnpm run start:web` (etc.) works identically — `npm run` is only acting as the script runner here.

**Two ways to run mobile:**
- `start:mobile` (also used by `npm run start`) runs `expo start --android` — it launches the Android emulator and opens the app directly. Have an AVD configured in Android Studio first.
- `start:mobile:expo` runs plain `expo start` and prints a QR code; scan it with **Expo Go** on a physical phone (phone and computer must be on the same network).

**Running both with `npm run start`:** output is split into color-coded `[web]` (blue) and `[mobile]` (magenta) streams, and a single `Ctrl+C` stops both. Note that Metro/Expo's interactive keypress menu (`r` to reload, etc.) is unreliable when both apps share one terminal — for active mobile debugging, run a mobile command in its own terminal.

> 🛠️ **Emulator won't launch?** If `--android` hangs or targets a phantom device, start the emulator manually from Android Studio first (or `emulator -avd <name>`), confirm it's listed under `adb devices`, then re-run the command.

### Build & Lint (web)

| Command             | Description                      |
|---------------------|----------------------------------|
| `npm run web:build` | Build the web app for production |
| `npm run web:lint`  | Run ESLint on the web app        |

---

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_N8N_BASE_URL=http://your-n8n-instance:5678
VITE_N8N_LOCAL=http://localhost:5678
```

- `VITE_N8N_BASE_URL` is used in production.
- `VITE_N8N_LOCAL` is the fallback for local development.

---

## Backend Integration

The website connects to n8n webhooks for the following endpoints:

| Endpoint                     | Method | Description                                      |
|------------------------------|--------|--------------------------------------------------|
| `/webhook/menu`              | GET    | Fetches menu data with 5-minute client-side cache |
| `/webhook/momma-mia-chat`    | POST   | AI chatbot conversation                          |
| `/webhook/contact-form`      | POST   | Contact form submission                          |

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
