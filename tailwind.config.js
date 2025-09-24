/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'light-pink': '#fdf2f8',
        'light-pink-50': '#fef7f0',
        'light-pink-100': '#fce7f3',
      }
    },
  },
  plugins: [],
}