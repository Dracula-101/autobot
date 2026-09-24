/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        'surface-3': v('surface-3'),
        line: v('line'),
        'line-2': v('line-2'),
        ink: v('ink'),
        'ink-2': v('ink-2'),
        'ink-3': v('ink-3'),
        primary: v('primary'),
        'primary-ink': v('primary-ink'),
        accent: v('accent'),
        mint: v('mint'),
        amber: v('amber'),
        rose: v('rose'),
        violet: v('violet'),
        sky: v('sky'),
        'a-hunt': v('a-hunt'),
        'a-prep': v('a-prep'),
        'a-body': v('a-body'),
        'a-class': v('a-class'),
        'a-life': v('a-life'),
      },
      opacity: {
        8: '0.08',
        12: '0.12',
        35: '0.35',
        45: '0.45',
        65: '0.65',
        85: '0.85',
      },
      fontFamily: {
        sans: ['Nunito', 'ui-rounded', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: 'var(--card-shadow)',
        lift: 'var(--lift-shadow)',
      },
      borderRadius: {
        card: '22px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pop: {
          '0%': { transform: 'scale(0.6)' },
          '60%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both',
        pop: 'pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'sheet-up': 'sheet-up 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
}
