/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0c0d10',
          soft: '#12141a',
          card: '#16181d',
          raised: '#1c1f26',
          border: '#2a2e38',
          muted: '#6b7280',
        },
        sage: {
          DEFAULT: '#7dcea0',
          dim: '#5a9e78',
          glow: 'rgba(125, 206, 160, 0.15)',
        },
        amber: {
          soft: '#e8b86d',
          glow: 'rgba(232, 184, 109, 0.15)',
        },
        rose: {
          soft: '#c97b84',
          glow: 'rgba(201, 123, 132, 0.15)',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.35)',
        soft: '0 2px 12px rgba(0,0,0,0.25)',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      keyframes: {
        'check-pop': {
          '0%': { transform: 'scale(0.6)', opacity: '0.5' },
          '50%': { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'check-pop': 'check-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-up': 'fade-up 0.4s ease-out',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
}
