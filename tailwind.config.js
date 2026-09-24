/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0a0b0d',
          soft: '#111319',
          card: '#14171d',
          raised: '#1a1e27',
          border: '#2a303c',
          muted: '#7a8294',
          // aliases used by older components
          dim: '#111319',
        },
        sage: {
          DEFAULT: '#8fbc9a',
          dim: '#6a9475',
          glow: 'rgba(143, 188, 154, 0.12)',
        },
        cream: {
          DEFAULT: '#f3efe6',
          dim: '#c9c2b4',
        },
        amber: {
          soft: '#d4a574',
          glow: 'rgba(212, 165, 116, 0.12)',
        },
        rose: {
          soft: '#c9898f',
          glow: 'rgba(201, 137, 143, 0.12)',
        },
        // legacy aliases → map to new system so untouched files still compile
        'ink-card': '#14171d',
        'ink-raised': '#1a1e27',
        'ink-border': '#2a303c',
        'ink-muted': '#7a8294',
        'ink-soft': '#111319',
        'amber-soft': '#d4a574',
        'amber-glow': 'rgba(212, 165, 116, 0.12)',
        'rose-soft': '#c9898f',
        'rose-glow': 'rgba(201, 137, 143, 0.12)',
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 0 rgba(255,255,255,0.04), 0 12px 40px rgba(0,0,0,0.45)',
        card: '0 1px 0 rgba(255,255,255,0.03), 0 10px 32px rgba(0,0,0,0.4)',
        lift: '0 8px 28px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(143,188,154,0.2), 0 10px 36px rgba(143,188,154,0.12)',
      },
      minHeight: { touch: '44px' },
      minWidth: { touch: '44px' },
      keyframes: {
        'check-pop': {
          '0%': { transform: 'scale(0.6)', opacity: '0.5' },
          '50%': { transform: 'scale(1.12)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'check-pop': 'check-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-up': 'fade-up 0.45s ease-out',
      },
    },
  },
  plugins: [],
}
