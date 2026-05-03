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
        "shimmer":      "shimmer 2s infinite",
        "pulse-slow":   "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float":        "float 6s ease-in-out infinite",
        "float-sm":     "float-sm 4s ease-in-out infinite",
        "spin-slow":    "spin 8s linear infinite",
        "glow-gold":    "glow-pulse 2.5s ease-in-out infinite",
        "glow-blue":    "glow-pulse-blue 2.5s ease-in-out infinite",
        "gradient":     "gradient-shift 4s ease infinite",
        "slide-up":     "slide-up-fade 0.5s ease-out both",
        "scale-in":     "scale-in 0.4s ease-out both",
        "wave":         "wave 1.2s ease-in-out",
        "ping-soft":    "ping-soft 1.5s cubic-bezier(0,0,0.2,1) infinite",
        "bottom-nav":   "bottom-nav-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        "card-reveal":  "card-reveal 0.5s cubic-bezier(0.34,1.56,0.64,1) both",
        "orb":          "orb-move 8s ease-in-out infinite",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-20px)" },
        },
        "float-sm": {
          "0%, 100%": { transform: "translateY(0px) scale(1)" },
          "50%":      { transform: "translateY(-8px) scale(1.02)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(245,158,11,0.2)" },
          "50%":      { boxShadow: "0 0 40px rgba(245,158,11,0.45)" },
        },
        "glow-pulse-blue": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(0,102,255,0.2)" },
          "50%":      { boxShadow: "0 0 40px rgba(0,102,255,0.45)" },
        },
        "gradient-shift": {
          "0%":   { backgroundPosition: "0% 50%" },
          "50%":  { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "slide-up-fade": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.92)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        wave: {
          "0%, 100%": { transform: "rotate(0deg)" },
          "20%":  { transform: "rotate(-15deg)" },
          "40%":  { transform: "rotate(14deg)" },
          "60%":  { transform: "rotate(-8deg)" },
          "80%":  { transform: "rotate(5deg)" },
        },
        "ping-soft": {
          "75%, 100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "bottom-nav-in": {
          from: { transform: "translateY(100%)", opacity: "0" },
          to:   { transform: "translateY(0)", opacity: "1" },
        },
        "card-reveal": {
          from: { opacity: "0", transform: "translateY(16px) scale(0.97)" },
          to:   { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "orb-move": {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%":  { transform: "translate(30px,-20px) scale(1.05)" },
          "66%":  { transform: "translate(-20px,10px) scale(0.95)" },
        },
      },
      boxShadow: {
        "glow-blue":   "0 0 20px rgba(0,102,255,0.3)",
        "glow-gold":   "0 0 20px rgba(200,155,60,0.3)",
        "glow-green":  "0 0 20px rgba(34,197,94,0.3)",
        "glow-amber":  "0 0 24px rgba(245,158,11,0.3)",
        "card":        "0 4px 24px rgba(0,0,0,0.4)",
        "card-lg":     "0 16px 60px rgba(0,0,0,0.5)",
        "bottom-nav":  "0 -8px 32px rgba(0,0,0,0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
