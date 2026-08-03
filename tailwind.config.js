/**
 * Semantic token -> CSS variable. Values live in src/index.css (:root / .dark),
 * so a component uses `bg-surface` once instead of `bg-white dark:bg-slate-800`.
 * The `<alpha-value>` placeholder keeps opacity modifiers working (`bg-surface/60`).
 */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: token("canvas"),
        surface: {
          DEFAULT: token("surface"),
          muted: token("surface-muted"),
          inset: token("surface-inset"),
        },
        edge: {
          DEFAULT: token("border"),
          subtle: token("border-subtle"),
          strong: token("border-strong"),
        },
        content: {
          DEFAULT: token("content"),
          secondary: token("content-secondary"),
          muted: token("content-muted"),
        },
        // `DEFAULT` is decorative (fills/bars/borders/icons); `ink` is the
        // text-safe variant — the decorative hues fail AA on light surfaces.
        accent: {
          DEFAULT: token("accent"),
          strong: token("accent-strong"),
          ink: token("accent-ink"),
        },
        danger: {
          DEFAULT: token("danger"),
          ink: token("danger-ink"),
        },
        success: {
          DEFAULT: token("success"),
          ink: token("success-ink"),
        },
      },
      fontSize: {
        // Smallest permitted on-screen size. Replaces the ad-hoc
        // text-[8px]/[9px]/[10px] set, which is unreadable at a glance.
        "2xs": ["0.6875rem", { lineHeight: "1rem" }], // 11px
      },
    },
  },
  plugins: [],
};
