import type { Config } from "tailwindcss";

const v = (name: string) => `var(--${name})`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: v("paper"),
        surface: v("surface"),
        sunk: v("sunk"),
        ink: v("ink"),
        graphite: v("graphite"),
        faint: v("faint"),
        rule: v("rule"),
        teal: { DEFAULT: v("teal"), ink: v("teal-ink"), wash: v("teal-wash") },
        marker: v("marker"),
        danger: { DEFAULT: v("danger"), wash: v("danger-wash") },
        caution: { DEFAULT: v("caution"), wash: v("caution-wash") },
        ok: v("ok"),
      },
      fontFamily: {
        sans: ['"Instrument Sans Variable"', '"Instrument Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ['"Newsreader Variable"', '"Newsreader"', "ui-serif", "Georgia", "serif"],
      },
      fontSize: {
        xs: ["12px", "16px"],
        sm: ["13.5px", "20px"],
        base: ["15px", "23px"],
        lg: ["17px", "27px"],
        xl: ["20px", "28px"],
        "2xl": ["26px", "32px"],
        "3xl": ["34px", "40px"],
      },
      borderRadius: { sm: "4px", DEFAULT: "6px", md: "8px", lg: "12px" },
      boxShadow: {
        lift: "0 1px 0 var(--rule), 0 8px 24px -12px rgba(20, 35, 30, 0.18)",
        drawer: "-24px 0 48px -24px rgba(20, 35, 30, 0.25)",
      },
    },
  },
  plugins: [],
};

export default config;
