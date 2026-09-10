/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Palet utama: teal + slate gelap (beda dari referensi yang ungu/pink/gold)
        brand: {
          50: '#effcf6',
          100: '#c9f7e5',
          200: '#94efcd',
          300: '#5fe0b7',
          400: '#2ec89e',
          500: '#12a884',
          600: '#0a8b6d',
          700: '#0a6f59',
          800: '#0c5949',
          900: '#0d4a3d',
        },
        ink: {
          900: '#0b1220',
          800: '#121b2e',
          700: '#1b2740',
        },
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
