import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 0 1px rgba(255, 255, 255, 0.08), 0 24px 80px rgba(7, 10, 18, 0.45)",
      },
      colors: {
        ink: {
          950: "#07111f",
          900: "#0d1627",
          800: "#15213a",
        },
        sand: {
          50: "#fbf7ef",
          100: "#f5ecd9",
          200: "#ecd8b3",
        },
      },
    },
  },
  plugins: [],
};

export default config;
