import { copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * GitHub Pages answers any unknown path with 404.html. Making that file the app
 * itself boots a deep link (/services/check-a-lunch) directly, instead of a
 * redirect page that bounced through /?/services/... and loaded twice.
 */
const spaFallback = (): Plugin => ({
  name: "spa-404-fallback",
  apply: "build",
  closeBundle() {
    const dist = resolve(__dirname, "dist");
    copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"));
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), spaFallback()],
  optimizeDeps: {
    exclude: ["lucide-react"],
  },
  assetsInclude: [
    "**/*.JPG",
    "**/*.jpg",
    "**/*.jpeg",
    "**/*.png",
    "**/*.gif",
    "**/*.svg",
  ],
});
