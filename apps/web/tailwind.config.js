/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: "#0B0C0E",
          900: "#111316",
          850: "#16181C",
          800: "#1C1F24",
          700: "#262A31",
          600: "#343A44",
          500: "#4A5260",
          400: "#6B7382",
          300: "#9AA2B0",
          200: "#C5CAD3",
          100: "#E8EAEE",
          50: "#F4F5F7",
        },
        accent: {
          DEFAULT: "#5BA4A0",
          soft: "#3D7874",
          bright: "#7BC4BF",
          mute: "rgba(91, 164, 160, 0.14)",
        },
        danger: {
          DEFAULT: "#C97171",
          mute: "rgba(201, 113, 113, 0.12)",
        },
        warn: {
          DEFAULT: "#C9A86E",
          mute: "rgba(201, 168, 110, 0.12)",
        },
      },
      fontFamily: {
        display: ['"Instrument Sans"', "Segoe UI", "sans-serif"],
        body: ['"Sora"', "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
