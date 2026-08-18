import type { Config } from "tailwindcss"
import { fontFamily } from "tailwindcss/defaultTheme"

const config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        black:      "var(--c-black)",
        "gray-1":   "var(--c-gray-1)",
        "gray-2":   "var(--c-gray-2)",
        "gray-3":   "var(--c-gray-3)",
        "gray-4":   "var(--c-gray-4)",
        disabled:   "var(--c-disabled)",
        surface:    "var(--c-surface)",
        "primary-dim":  "var(--c-primary-dim)",
        "primary-dark": "var(--c-primary-dark)",
        positive:       "var(--c-positive)",
        "positive-dim": "var(--c-positive-dim)",
        negative:       "var(--c-negative)",
        "negative-dim": "var(--c-negative-dim)",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        xs:   "var(--r-xs)",
        sm:   "var(--r-sm)",
        md:   "var(--r-md)",
        lg:   "var(--r-lg)",
        pill: "var(--r-pill)",
      },
      boxShadow: {
        w100: "var(--sh-w100)",
        w200: "var(--sh-w200)",
        w300: "var(--sh-w300)",
        g100: "var(--sh-g100)",
        g200: "var(--sh-g200)",
        g300: "var(--sh-g300)",
      },
      fontFamily: {
        sans: ["Pretendard Variable", "Pretendard", ...fontFamily.sans],
      },
      fontSize: {
        "display-1": ["56px", { lineHeight: "72px", letterSpacing: "-0.0319em" }],
        "display-2": ["40px", { lineHeight: "52px", letterSpacing: "-0.0282em" }],
        "title-1": ["36px", { lineHeight: "48px", letterSpacing: "-0.027em" }],
        "title-2": ["28px", { lineHeight: "38px", letterSpacing: "-0.0236em" }],
        "title-3": ["24px", { lineHeight: "32px", letterSpacing: "-0.023em" }],
        "heading-1": ["22px", { lineHeight: "30px", letterSpacing: "-0.0194em" }],
        "heading-2": ["20px", { lineHeight: "28px", letterSpacing: "-0.012em" }],
        "headline-1": ["18px", { lineHeight: "26px", letterSpacing: "-0.002em" }],
        "headline-2": ["17px", { lineHeight: "24px", letterSpacing: "0em" }],
        "body-1-normal": ["16px", { lineHeight: "24px", letterSpacing: "0.0057em" }],
        "body-1-reading": ["16px", { lineHeight: "26px", letterSpacing: "0.0057em" }],
        "body-2-normal": ["15px", { lineHeight: "22px", letterSpacing: "0.0096em" }],
        "body-2-reading": ["15px", { lineHeight: "24px", letterSpacing: "0.0096em" }],
        "label-1-normal": ["14px", { lineHeight: "20px", letterSpacing: "0.0145em" }],
        "label-1-reading": ["14px", { lineHeight: "22px", letterSpacing: "0.0145em" }],
        "label-2": ["13px", { lineHeight: "18px", letterSpacing: "0.0194em" }],
        "caption-1": ["12px", { lineHeight: "16px", letterSpacing: "0.0252em" }],
        "caption-2": ["11px", { lineHeight: "14px", letterSpacing: "0.0311em" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
