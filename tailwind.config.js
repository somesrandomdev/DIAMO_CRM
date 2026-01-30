/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
<<<<<<< Updated upstream
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
=======
        // Core Brand Colors (Modernized)
        primary: '#1E66D0',
        'primary-hover': '#1A5BB8',
        'primary-soft': '#E7F0FF',
        
        // Neutral Foundation (Modernized)
        background: '#F9FAFB',
        surface: '#FFFFFF',
        'surface-subtle': '#F1F3F5',
        
        // Semantic Colors (Modernized)
        success: '#2F9E44',
        error: '#E03131',
        warning: '#F08C00',
        info: '#1864AB',
        
        // Text Colors (Modernized)
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
        'text-muted': '#9CA3AF',
        'text-inverse': '#FFFFFF',
        
        // Borders & Dividers (Modernized)
        'border-subtle': '#E5E7EB',
        'border-default': '#D1D5DB',
        'border-hover': '#CED4DA',
        'border-focus': '#1E66D0',
        
        // Original Diam'o Colors (for backward compatibility)
        'primary-original': '#1C7ED6',
        'primary-dark-original': '#1971C2',
        'primary-light-original': '#A5D8FF',
        secondary: '#74C0FC',
        'background-original': '#F8F9FA',
        success-original: '#40C057',
        error-original: '#FA5252',
        warning-original: '#FFD43B',
        'text-primary-original': '#212529',
        'text-secondary-original': '#6C757D',
        'text-muted-original': '#ADB5BD',
        'border-default-original': '#DEE2E6',
        'border-hover-original': '#CED4DA',
        'border-focus-original': '#1C7ED6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Modernized Typography Scale
        xs: '0.75rem',        // 12px
        sm: '0.8125rem',      // 13px
        base: '0.9375rem',    // 15px (Body)
        lg: '1.125rem',       // 18px
        xl: '1.25rem',        // 20px
        '2xl': '1.5rem',      // 24px
        '3xl': '1.875rem',    // 30px
        '4xl': '2rem',        // 32px (H1)
      },
      borderRadius: {
        // Modernized Border Radius
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        full: '9999px',
      },
      spacing: {
        // Spacing remains the same for consistency
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem',
      },
      boxShadow: {
        // Modernized Shadow System
        sm: '0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 12px rgba(0,0,0,0.06)',
        none: 'none',
      },
      transitionDuration: {
        // Modernized Transitions
        fast: '120ms',
        normal: '200ms',
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
>>>>>>> Stashed changes
      },
    },
  },
  plugins: [],
}
