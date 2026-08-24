import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Page load includes a live Supabase fetch for the carousel images, which
  // regularly takes ~20s on a cold dev server — 30s made beforeEach flaky.
  timeout: 60000,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
