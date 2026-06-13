/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Superficies — ciruela nocturna profunda
        plum: {
          950: "#0c0814",
          900: "#130d20",
          850: "#181023",
          800: "#1f1530",
          700: "#2c1f44",
          600: "#3d2c5c",
        },
        // Texto y neutros — bruma lavanda
        haze: {
          50: "#f6f2fc",
          100: "#e9e1f7",
          200: "#dcd0f0",
          300: "#cabbe6",
          400: "#a394c4",
          500: "#7c6aa0",
        },
        // Acento — amatista / iris
        iris: {
          DEFAULT: "#a974f5",
          bright: "#c9a3ff",
          deep: "#8348d6",
        },
        matched: "#4fd6a0",
        pending: "#f2719b",
        orchid: "#c4419a",
      },
      fontFamily: {
        display: ['"Fraunces"', "serif"],
        sans: ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(169,116,245,0.28), 0 18px 50px -12px rgba(169,116,245,0.28)",
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
