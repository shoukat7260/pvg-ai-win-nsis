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
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
        panel: "0 12px 40px rgba(0, 0, 0, 0.45)",
      },
      backdropBlur: {
        glass: "18px",
      },
      borderRadius: {
        surface: "18px",
        pill: "999px",
      },
      keyframes: {
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "soft-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "brand-sheen": {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.55s ease-out both",
        "soft-pulse": "soft-pulse 2.4s ease-in-out infinite",
        "brand-sheen": "brand-sheen 8s linear infinite",
      },
    },
  },
  plugins: [],
};
