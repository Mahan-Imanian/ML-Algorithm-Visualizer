import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        faint: "var(--faint)",
        surface: {
          1: "var(--s1)",
          2: "var(--s2)",
          3: "var(--s3)",
          4: "var(--s4)",
        },
        border: { DEFAULT: "var(--border)", strong: "var(--border-strong)" },
        input: "var(--input)",
        ring: "var(--ring)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          text: "var(--primary-text)",
        },
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        success: "var(--success)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        pop: "var(--shadow-pop)",
        primary: "var(--shadow-primary)",
        "primary-hover": "var(--shadow-primary-hover)",
        button: "var(--shadow-button)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "18px",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in": {
          from: { opacity: "0", transform: "translate(-50%, -6px) scale(0.98)" },
          to: { opacity: "1", transform: "translate(-50%, 0) scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.13s ease",
        "scale-in": "scale-in 0.13s ease",
      },
    },
  },
  plugins: [],
};

export default config;
