/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ✅ Primary brand color + optional shades
        primary: {
          DEFAULT: '#FF8C32', // orange CTA
          50: '#FFF4E9',
          100: '#FFE3CC',
          200: '#FFC199',
          300: '#FF9F66',
          400: '#FF7C33',
          500: '#FF8C32', // default
          600: '#E67828',
          700: '#B55B1D',
        },
        // ✅ Neutral / secondary (charcoal gray)
        secondary: {
          DEFAULT: '#2C2C2C',
          50: '#F2F2F2',
          100: '#E0E0E0',
          200: '#B3B3B3',
          300: '#808080',
          400: '#4D4D4D',
          500: '#2C2C2C', // default
          600: '#1F1F1F',
          700: '#141414',
        },
        // ✅ Accent (golden yellow for badges/highlights)
        accent: {
          DEFAULT: '#FFC107',
          50: '#FFF8E1',
          100: '#FFECB3',
          200: '#FFE082',
          300: '#FFD54F',
          400: '#FFCA28',
          500: '#FFC107', // default
          600: '#FFB300',
          700: '#FFA000',
        },
        sidebar: {
          bg: '#2c3e50',
          hover: '#34495e',
          active: '#3498db',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        // Headings: shop name, category titles, dish names in the popup (self-hosted, no Google request)
        display: ['"Fraunces Variable"', 'Georgia', 'serif'],
      },
      spacing: {
        15: '3.75rem',
      },
      borderWidth: {
        3: '3px',
      },
      backgroundImage: {
        'app-gradient': 'linear-gradient(to right, white, #FFF8F0, #FFF0E0)',
      },
    },
  },
  plugins: [],
};
