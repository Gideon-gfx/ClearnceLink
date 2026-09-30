/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.js', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: '#5011c5',
        brandLight: '#742ee8',
        ink: '#171548',
        muted: '#6e6b91',
        line: '#dedcf4',
        canvas: '#f7f7fc',
      },
    },
  },
  plugins: [],
};
