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
          DEFAULT: '#FFFAF7',
          2: '#FEF3E8',
          3: '#FDE8D0',
        },
        plum: {
          DEFAULT: '#1E0A2E',
          2: '#2D1147',
          3: '#3D1A5C',
        },
        ink: {
          DEFAULT: '#1C0A00',
          3: '#8C5A32',
        },
        safe: '#10B981',
        danger: '#F43F5E',
        warning: '#F59E0B',
        gold: '#FBBF24',
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
