/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#050505",
        surface: "#111111",
        surfaceBorder: "#222222",
        gold: {
          50: "#FFFDF0",
          100: "#FFEAA7",
          200: "#F9E076",
          300: "#F4D03F",
          400: "#E5BE2D",
          500: "#D4AF37",
          600: "#B38F27",
          700: "#8C6E1A",
          800: "#664E10",
          900: "#3D2E07",
        },
      },
    },
  },
  plugins: [],
};
