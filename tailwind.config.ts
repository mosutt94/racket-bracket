import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // The primary accent is driven by CSS variables so it can be re-themed
        // per Grand Slam (see the [data-slam] blocks in globals.css). The :root
        // defaults are the original green, so anything without a slam theme is
        // visually unchanged. Channel-triple form keeps Tailwind opacity
        // modifiers (e.g. bg-court-700/50) working.
        court: {
          50: "rgb(var(--court-50) / <alpha-value>)",
          100: "rgb(var(--court-100) / <alpha-value>)",
          200: "rgb(var(--court-200) / <alpha-value>)",
          300: "rgb(var(--court-300) / <alpha-value>)",
          400: "rgb(var(--court-400) / <alpha-value>)",
          500: "rgb(var(--court-500) / <alpha-value>)",
          700: "rgb(var(--court-700) / <alpha-value>)",
          900: "rgb(var(--court-900) / <alpha-value>)"
        },
        clay: {
          100: "#fee9dc",
          300: "#f7b184",
          500: "#db6f3d",
          700: "#9b3e23"
        },
        // Tennis-ball optic yellow-green — slam-neutral accent for highlights.
        ball: {
          DEFAULT: "#d2ed51",
          500: "#c2e034"
        },
        ink: "#17211a"
      },
      boxShadow: {
        soft: "0 18px 55px rgba(23, 33, 26, 0.11)"
      }
    }
  },
  plugins: []
};

export default config;
