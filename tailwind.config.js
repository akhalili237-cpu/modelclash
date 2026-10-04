/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0f',
        panel: '#12121a',
        panel2: '#1a1a26',
        line: '#262637',
        accent: '#f97316',
        accent2: '#ec4899',
        gold: '#facc15',
      },
      fontFamily: {
        sans: [
          'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Inter',
          'Noto Sans', 'Noto Sans Arabic', 'Noto Sans SC', 'Noto Sans JP',
          'Noto Sans KR', 'Helvetica Neue', 'Arial', 'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      },
      animation: {
        'fade-up': 'fadeUp .35s ease both',
        blink: 'blink 1s steps(2) infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        pop: 'pop .25s cubic-bezier(.2,1.6,.4,1) both',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        blink: { '50%': { opacity: '0' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        pop: { from: { opacity: '0', transform: 'scale(.85)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
