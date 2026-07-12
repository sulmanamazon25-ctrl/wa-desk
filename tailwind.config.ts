import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#0b0f14",
          raised: "#0f1520",
          overlay: "#151d2a",
        },
        accent: {
          DEFAULT: "#34d399",
          muted: "#10b981",
        },
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(52, 211, 153, 0.35)",
      },
      fontFamily: {
        sans: [
          "var(--font-geist-sans)",
          "var(--font-arabic)",
          "var(--font-devanagari)",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
