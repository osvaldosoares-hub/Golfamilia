/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        bebas: ['var(--font-bebas)'],
        mono: ['var(--font-mono)', 'monospace'],
        sans: ['var(--font-sans)', 'sans-serif'],
      },
      colors: {
        green: { DEFAULT: '#00D26A', dark: '#00a854' },
        gold: { DEFAULT: '#FFD700', dark: '#ccac00' },
        dark: {
          DEFAULT: '#080C12',
          2: '#0E1420',
          3: '#161D2E',
          4: '#1E2740',
        },
        red: { DEFAULT: '#FF4757' },
        blue: { DEFAULT: '#3B82F6' },
      },
      backgroundImage: {
        'field-grid': `
          repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(255,255,255,0.02) 60px),
          repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(255,255,255,0.02) 60px)
        `,
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGold: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(255,215,0,0.4)' },
          '50%': { boxShadow: '0 0 0 8px rgba(255,215,0,0)' },
        },
      },
    },
  },
  plugins: [],
}
