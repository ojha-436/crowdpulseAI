/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        midnight: { 900: '#0a0e1a', 800: '#111827', 700: '#1a2236', 600: '#243049' },
        pulse: { 400: '#38f2b0', 500: '#00d68f', 600: '#00b377' },
        alert: { 400: '#ff6b6b', 500: '#ff4757' },
        warn: { 400: '#ffa94d', 500: '#ff8c00' },
        cyan: { 400: '#22d3ee', 500: '#06b6d4' },
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 0.4 },
          '50%': { opacity: 1 },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
