import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: '/momma-mia-catering-website/', 
  plugins: [react()],
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
