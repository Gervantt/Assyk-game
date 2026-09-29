/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        steppe: { 50: '#f6f2e8', 100: '#ece2cc', 300: '#d6c294', 500: '#b3924f' },
        sky: { 450: '#2fa3d8', 550: '#1b7fb0' },
        gold: { 400: '#f0c23c', 500: '#d9a418' },
        night: { 800: '#151a24', 900: '#0d1017' },
      },
      fontFamily: {
        display: ['"Noto Sans"', 'system-ui', 'sans-serif'],
        body: ['"Noto Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
