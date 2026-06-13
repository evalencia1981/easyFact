/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Superficies — pino/esmeralda nocturno profundo (tokens heredados: plum.*)
        plum: {
          950: "#07120d",
          900: "#0a1810",
          850: "#0c1c13",
          800: "#102417",
          700: "#163420",
          600: "#21492f",
        },
        // Texto y neutros — bruma salvia (tokens heredados: haze.*)
        haze: {
          50: "#f1faf5",
          100: "#ddf3e8",
          200: "#cdecdd",
          300: "#b6e3cd",
          400: "#8cc4a8",
          500: "#62a07f",
        },
        // Acento — esmeralda / jade (tokens heredados: iris.*)
        iris: {
          DEFAULT: "#3ddc97",
          bright: "#74f0bd",
          deep: "#16a36b",
        },
        matched: "#34e0c0",
        pending: "#f2719b",
        orchid: "#1fb8a6",
      },
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        sans: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(61,220,151,0.28), 0 18px 50px -12px rgba(61,220,151,0.28)",
        panel: "0 24px 60px -24px rgba(0,0,0,0.85)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fade: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        glowpulse: {
          "0%,100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        rise: "rise 0.55s cubic-bezier(0.22,1,0.36,1) both",
        fade: "fade 0.6s ease both",
        glowpulse: "glowpulse 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
