import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        saffron: {
          DEFAULT: '#F97316',
          dark: '#EA580C',
          soft: '#FFF3E8',
        },
        cream: {
          DEFAULT: '#F5EDD8',
          2: '#FEF3DC',
          3: '#E8DFC8',
        },
        plum: {
          DEFAULT: '#1C0F3F',
          2: '#2D1147',
          3: '#3D1A5C',
        },
        indigo: {
          DEFAULT: '#1C0F3F',
          light: '#3C2A8A',
          muted: '#7B68C0',
        },
        coral: {
          DEFAULT: '#F96167',
        },
        gold: {
          DEFAULT: '#D4A853',
        },
        'warm-white': '#FFFDF7',
        'ink-on-indigo': '#F8F7FF',
        ink: {
          DEFAULT: '#1C0F3F',
          3: '#7A6E5A',
        },
        safe: '#10B981',
        danger: '#F43F5E',
        warning: '#F59E0B',
      },
      fontFamily: {
        fraunces: ['Fraunces', 'serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
