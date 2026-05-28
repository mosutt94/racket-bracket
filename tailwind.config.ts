import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        court: {
          50: "#f4fbf3",
          100: "#e5f5e3",
          300: "#a6d99f",
          500: "#4c9a45",
          700: "#266d30",
          900: "#143a1c"
        },
        clay: {
          100: "#fee9dc",
          300: "#f7b184",
          500: "#db6f3d",
          700: "#9b3e23"
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
