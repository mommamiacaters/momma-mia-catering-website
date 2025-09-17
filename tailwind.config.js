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
    },
  },
  plugins: [],
};
