/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand palette (approximated from provided menu image)
        'brand-primary': '#E36A2E', // headers / accents
        'brand-secondary': '#F3E7D8', // page background
        'brand-text': '#2E2A25', // primary text
        'brand-accent': '#F2B34A', // secondary accent
        'brand-divider': '#D9CDBE', // subtle borders/dividers
      },
      fontFamily: {
        'arvo': ['Arvo', 'serif'],
        'poppins': ['Poppins', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        // Route-change enter: opacity + a 4px rise. Kept to transform/opacity only
        // so it stays on the compositor and never triggers layout.
        'page-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
        // No fill mode: the end state IS the natural state, and a filling
        // transform would stay on the page wrapper forever — turning it into
        // the containing block for every `fixed` descendant (order drawer,
        // bag button, admin modals), which pins them to the page instead of
        // the viewport and kills their internal scrolling.
        'page-in': 'page-in 200ms ease-out',
      },
    },
  },
  plugins: [],
};
