/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mirari: {
          paper: '#FAF9F6',        // Warm archival paper
          surface: '#FFFFFF',      // Crisp card & panel
          surfaceAlt: '#F3EFE8',   // Subtle tinted section
          ink: '#15171B',          // Main editorial text
          muted: '#4E5764',        // Secondary reading text
          dim: '#7E8896',          // Timestamps, captions, subtle footnotes
          line: '#E8E4DA',         // Editorial hairline divider
          border: '#DED8CC',       // Subtle borders
          space: '#0A0E17',        // Deep cosmos container for space experiments
          spacePlate: '#111624',   // Space simulator background
          spaceBorder: '#1F2A3F',  // Space simulator border
          amber: '#C2410C',        // Terra/Astral amber accent
          amberLight: '#FFF7ED',
          cobalt: '#0369A1',       // Scientific blue
          cobaltLight: '#F0F9FF',
          emerald: '#047857',
        },
      },
      fontFamily: {
        serif: ['"Newsreader"', '"Noto Serif TC"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', '"Noto Sans TC"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
