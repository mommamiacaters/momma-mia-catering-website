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

```
src/
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

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/<your-username>/momma-mia-catering-website.git
   cd momma-mia-catering-website
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (see [Environment Variables](#environment-variables) below).

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Available Scripts

| Command             | Description                        |
|---------------------|------------------------------------|
| `npm run dev`       | Start development server           |
| `npm run build`     | Build for production                |
| `npm run preview`   | Preview production build locally    |
| `npm run lint`      | Run ESLint                          |

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
