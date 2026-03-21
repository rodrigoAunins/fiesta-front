/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // <--- ¡AGREGA ESTA LÍNEA!
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      }
    },
  },
  plugins: [],
}