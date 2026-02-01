import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        background: "rgb(var(--background) / <alpha-value>)",
        surface: "#FFFFFF",
        primary: "#3B82F6",
        secondary: "#6B7280",
        border: "rgb(var(--border) / <alpha-value>)",
        input: "rgb(var(--input) / <alpha-value>)",
        ring: "rgb(var(--ring) / <alpha-value>)",
        foreground: "rgb(var(--foreground) / <alpha-value>)",
        success: "#10B981",
        "candy-purple": "#3B82F6", // Замінено на синій для кращої читабельності
        "candy-blue": "#3B82F6",
        "candy-mint": "#10B981",
        "candy-pink": "#EC4899",
        "candy-orange": "#F59E0B",
        "system-blue": "#007AFF",
        "system-green": "#34C759",
        "system-orange": "#FF9500",
        "system-pink": "#FF2D55",
        "system-purple": "#AF52DE",
        "system-cyan": "#5AC8FA",
        "neon-orange": "#FF9500",
        "neon-pink": "#FF2D55",
        "neon-green": "#34C759",
        "neon-purple": "#AF52DE",
        "neon-cyan": "#5AC8FA",
        gray: {
          50: "#F9F9F9",
          100: "#F2F2F7",
          200: "#E5E5EA",
          300: "#D1D1D6",
          400: "#C7C7CC",
          500: "#AEAEB2",
          600: "#8E8E93",
          700: "#636366",
          800: "#48484A",
          900: "#1C1C1E",
        },
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      letterSpacing: {
        'title': '0.15em',
        'wide': '0.05em',
      },
      borderRadius: {
        'candy': '16px',
        'candy-lg': '20px',
        'candy-xl': '24px',
        'candy-sm': '12px',
        'candy-xs': '8px',
        'ios': '20px',
        'ios-lg': '28px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.08)',
        'soft-lg': '0 4px 16px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.12)',
        'soft-xl': '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0, 0, 0, 0.16)',
        'inner': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
        'neon-orange': '0 0 20px rgba(255, 149, 0, 0.3), 0 4px 16px rgba(255, 149, 0, 0.2)',
        'neon-pink': '0 0 20px rgba(255, 45, 85, 0.3), 0 4px 16px rgba(255, 45, 85, 0.2)',
        'neon-green': '0 0 20px rgba(52, 199, 89, 0.3), 0 4px 16px rgba(52, 199, 89, 0.2)',
        'neon-purple': '0 0 20px rgba(175, 82, 222, 0.3), 0 4px 16px rgba(175, 82, 222, 0.2)',
        'neon-cyan': '0 0 20px rgba(90, 200, 250, 0.3), 0 4px 16px rgba(90, 200, 250, 0.2)',
        'neon-blue': '0 0 20px rgba(0, 122, 255, 0.3), 0 4px 16px rgba(0, 122, 255, 0.2)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
        "glow": {
          "0%, 100%": { boxShadow: "0 0 20px rgba(197, 160, 89, 0.3)" },
          "50%": { boxShadow: "0 0 30px rgba(197, 160, 89, 0.5)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
        "glow": "glow 2s ease-in-out infinite",
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config

