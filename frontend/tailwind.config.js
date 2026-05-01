/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "'Fira Code'", "monospace"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#f0ede8",
          100: "#e0d9cf",
          200: "#c4b8a5",
          300: "#a8977a",
          400: "#8c7555",
          500: "#6b5a3e",
          600: "#4a3f2e",
          700: "#2e2619",
          800: "#1a1610",
          900: "#0e0c09",
        },
        parchment: {
          50: "#fdfbf7",
          100: "#f9f4ec",
          200: "#f3e9d8",
          300: "#ead6b8",
          400: "#dfc09a",
          500: "#cfa87a",
        },
        accent: {
          400: "#e8925a",
          500: "#d4743c",
          600: "#b85c28",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        typing: "typing 1s steps(3) infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        typing: {
          "0%": { content: "''" },
          "33%": { content: "'.'" },
          "66%": { content: "'..'" },
          "100%": { content: "'...'" },
        },
      },
    },
  },
  plugins: [],
};
