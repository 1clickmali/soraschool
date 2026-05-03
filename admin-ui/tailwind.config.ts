import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        soraBlue: "#0066FF",
        soraDark: "#0A0F1E",
        soraCard: "#111827",
        soraGold: "#C89B3C",
        soraSidebar: "#080D1A",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        heading: ["Poppins", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      animation: {
        "shimmer": "shimmer 2s infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 6s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
      boxShadow: {
        "glow-blue": "0 0 20px rgba(0, 102, 255, 0.3)",
        "glow-gold": "0 0 20px rgba(200, 155, 60, 0.3)",
        "glow-green": "0 0 20px rgba(34, 197, 94, 0.3)",
        "card": "0 4px 24px rgba(0, 0, 0, 0.4)",
      },
    },
  },
  plugins: [],
};

export default config;
