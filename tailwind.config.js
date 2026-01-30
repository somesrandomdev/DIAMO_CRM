/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1C7ED6',
        secondary: '#74C0FC',
        background: '#F8F9FA',
        accent: '#FFD43B',
        success: '#40C057',
        error: '#FA5252',
        warning: '#FFD43B',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}