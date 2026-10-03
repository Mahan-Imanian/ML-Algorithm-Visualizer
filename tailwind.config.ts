import type { Config } from "tailwindcss";

const c = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: { relative: true, files: ["./index.html", "./src/**/*.{ts,tsx}"] },
  theme: {
    screens: {
      sm: "480px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1600px",
    },
    extend: {
      colors: {
        bg: c("bg"),
        surface: c("surface"),
        field: c("field"),
        sunken: c("sunken"),
        rule: { DEFAULT: c("rule"), strong: c("rule-strong") },
        ink: { DEFAULT: c("ink"), 2: c("ink-2"), 3: c("ink-3") },
        signal: { DEFAULT: c("signal"), ink: c("signal-ink"), soft: c("signal-soft") },
        focus: c("focus"),
        st: {
          open: c("st-open"),
          closed: c("st-closed"),
          path: c("st-path"),
          wall: c("st-wall"),
          weight: c("st-weight"),
          a: c("st-a"),
          b: c("st-b"),
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Consolas", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "14px", letterSpacing: "0.02em" }],
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["14px", { lineHeight: "20px" }],
        md: ["15px", { lineHeight: "22px" }],
        lg: ["18px", { lineHeight: "24px" }],
        xl: ["22px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        "2xl": ["30px", { lineHeight: "36px", letterSpacing: "-0.015em" }],
        "3xl": ["40px", { lineHeight: "44px", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "3px",
        md: "4px",
        lg: "6px",
        full: "9999px",
      },
      boxShadow: {
        pop: "0 1px 0 rgb(var(--rule) / 1), 0 12px 32px -8px rgb(0 0 0 / 0.22)",
        inset: "inset 0 0 0 1px rgb(var(--rule) / 1)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.2, 0, 0, 1)",
        inout: "cubic-bezier(0.6, 0, 0.2, 1)",
      },
      transitionDuration: {
        fast: "120ms",
        med: "200ms",
        slow: "320ms",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "none" },
        },
        "sheet-in": {
          from: { transform: "translateY(16px)", opacity: "0" },
          to: { transform: "none", opacity: "1" },
        },
        "slide-in-left": {
          from: { transform: "translateX(-12px)", opacity: "0" },
          to: { transform: "none", opacity: "1" },
        },
        "entry-in": {
          from: { opacity: "0", transform: "translateX(8px)" },
          to: { opacity: "1", transform: "none" },
        },
        pulse: {
          "0%": { boxShadow: "0 0 0 0 rgb(var(--signal) / 0.5)" },
          "100%": { boxShadow: "0 0 0 6px rgb(var(--signal) / 0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 160ms cubic-bezier(0.2,0,0,1)",
        "rise-in": "rise-in 200ms cubic-bezier(0.2,0,0,1)",
        "sheet-in": "sheet-in 220ms cubic-bezier(0.2,0,0,1)",
        "slide-in-left": "slide-in-left 220ms cubic-bezier(0.2,0,0,1)",
        "entry-in": "entry-in 180ms cubic-bezier(0.2,0,0,1)",
        pulse: "pulse 900ms cubic-bezier(0.2,0,0,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
