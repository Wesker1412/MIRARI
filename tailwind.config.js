/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mirari: {
          bg: '#0A0D14',          // Deep cosmic obsidian
          surface: '#111622',     // Elevated panel
          card: '#161D2C',        // Card background
          border: '#232D42',      // Subtle editorial divider
          borderLight: '#32405D', // Active border
          text: '#F3F6FB',        // Main text
          muted: '#94A3B8',       // Secondary text
          dim: '#64748B',         // Subtle captions
          amber: '#F59E0B',       // Discovery Amber / Nova
          amberGlow: '#FBBF24',
          cyan: '#06B6D4',        // Scientific Precision Cyan
          cyanGlow: '#22D3EE',
          violet: '#8B5CF6',      // Ethereal subtle accent
        },
      },
      fontFamily: {
        serif: ['"Newsreader"', '"Noto Serif TC"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', '"Noto Sans TC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'float-gentle': 'floatGentle 4s ease-in-out infinite',
        'pulse-subtle': 'pulseSubtle 2.5s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        floatGentle: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '0.9', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        },
      },
    },
  },
  plugins: [],
}
