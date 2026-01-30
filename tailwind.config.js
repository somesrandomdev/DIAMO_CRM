/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E66D0',
        'primary-hover': '#1A5BB8',
        'primary-soft': '#E7F0FF',
        background: '#F9FAFB',
        surface: '#FFFFFF',
        'surface-subtle': '#F1F3F5',
        success: '#2F9E44',
        error: '#E03131',
        warning: '#F08C00',
        info: '#1864AB',
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
        'text-muted': '#9CA3AF',
        'border-subtle': '#E5E7EB',
        'border-default': '#D1D5DB',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.75rem',
        xs: '0.8125rem',
        sm: '0.875rem',
        base: '0.9375rem',
        lg: '1.125rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
    },
  },
  plugins: [],
}