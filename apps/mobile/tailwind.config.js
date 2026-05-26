/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    // NOTE: if a shared package in ../../packages/* ever uses className, add its
    // SOURCE path here (Tailwind scans literal paths; pnpm hoisting won't add it).
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Momma Mia brand palette (mirrors apps/web tailwind.config.js tokens).
      colors: {
        brand: {
          primary: '#E36A2E', // orange — buttons, headers, accents
          cream: '#F4EBDD', // page background
          secondary: '#F3E7D8', // softer cream surface
          accent: '#F2B34A', // gold — gradients, highlights
          text: '#2E2A26', // dark brown — body text
          muted: '#6B6358', // muted text
          divider: '#D9CDBE', // borders, dividers
        },
      },
    },
  },
  plugins: [],
};
