import type { Config } from "tailwindcss"
import { fontFamily } from "tailwindcss/defaultTheme"

// 타이포 스케일. `theme.extend.fontSize`와 아래 `safelist`가 같은 객체를 참조한다 —
// Foundations 문서(`storybook/_internal/TokenList.tsx`의 `TypeSample`)가 이 스케일을
// `!text-{key}`(important) 형태로 동적 조합해서 쓰는데, Tailwind의 콘텐츠 스캐너는
// 런타임에 문자열을 이어붙여 만든 클래스명은 소스에서 리터럴로 찾지 못해 인식하지
// 못한다. safelist에 이 스케일에서 파생한 이름을 강제로 포함시켜 실제로 필요할 때
// `!text-display-1{font-size:56px!important;...}`가 생성되게 한다.
const FONT_SIZE_SCALE: Record<string, [string, { lineHeight: string; letterSpacing: string }]> = {
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
}

const config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Storybook 스토리·규칙 MDX. 빠뜨리면 에러 없이 조용히 스타일이 안 먹는다.
    "./src/storybook/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Foundations의 `TypeSample`이 런타임에 조합하는 `!text-{key}`용. 위 설명 참고.
  safelist: Object.keys(FONT_SIZE_SCALE).map((key) => `!text-${key}`),
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
        // disabled는 여기서 뺐다 — bg/text가 서로 다른 값을 써야 해서
        // (아래 backgroundColor/textColor extend 블록으로 분리, border-disabled는 미사용 확인됨)
        surface:    "var(--c-surface)",
        "primary-dim":  "var(--c-primary-dim)",
        "primary-dark": "var(--c-primary-dark)",
        // positive도 마찬가지로 여기서 뺐다 — text-positive만 새 값을 쓰고
        // bg-positive/border-positive는 미사용이라 아래 textColor로만 옮김
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
      // Semantic 색상.
      backgroundColor: {
        page: "var(--sem-bg-page)",
        overlay: "var(--sem-bg-overlay)",
        // bg-disabled 값 교체 확정(#ebebeb → neutral-200). 실사용 49건 전부 색이
        // 아주 살짝(거의 인지 불가) 바뀐다 — 사용자 승인됨.
        disabled: "var(--sem-bg-disabled)",
        "neutral-weak": "var(--sem-bg-neutral-weak)",
        "neutral-weak-pressed": "var(--sem-bg-neutral-weak-pressed)",
        // 신규(4번째 neutral 단계): bg-gray-1(#333333) 대체. Pick One 카드 어두운 배경 전용.
        "neutral-strong": "var(--sem-bg-neutral-strong)",
        "brand-solid": "var(--sem-bg-brand-solid)",
        "brand-solid-pressed": "var(--sem-bg-brand-solid-pressed)",
        "brand-weak": "var(--sem-bg-brand-weak)",
        "brand-weak-pressed": "var(--sem-bg-brand-weak-pressed)",
        "critical-solid": "var(--sem-bg-critical-solid)",
        "critical-solid-pressed": "var(--sem-bg-critical-solid-pressed)",
        "critical-weak": "var(--sem-bg-critical-weak)",
        "critical-weak-pressed": "var(--sem-bg-critical-weak-pressed)",
        "positive-weak": "var(--sem-bg-positive-weak)",
        "positive-weak-pressed": "var(--sem-bg-positive-weak-pressed)",
        "warning-weak": "var(--sem-bg-warning-weak)",
        "warning-weak-pressed": "var(--sem-bg-warning-weak-pressed)",
        "informative-weak": "var(--sem-bg-informative-weak)",
        "informative-weak-pressed": "var(--sem-bg-informative-weak-pressed)",
        "magic-weak": "var(--sem-bg-magic-weak)",
        "magic-weak-pressed": "var(--sem-bg-magic-weak-pressed)",
      },
      textColor: {
        neutral: "var(--sem-fg-neutral)",
        // 신규(4번째 neutral 단계): text-gray-1(#333333) 대체. neutral과 muted 사이,
        // 굵게 강조하는 라벨 전용.
        "neutral-strong": "var(--sem-fg-neutral-strong)",
        "neutral-muted": "var(--sem-fg-neutral-muted)",
        "neutral-subtle": "var(--sem-fg-neutral-subtle)",
        placeholder: "var(--sem-fg-placeholder)",
        // text-disabled 값 교체 확정(#a8a8a8 → neutral-400, subtle보다 한 단계 밝음). 실사용 1건.
        disabled: "var(--sem-fg-disabled)",
        "on-solid": "var(--sem-fg-on-solid)",
        brand: "var(--sem-fg-brand)",
        critical: "var(--sem-fg-critical)",
        // text-positive 값 교체 확정(#2e9e4f → green-700). 기존 값은 AA 미달(3.43:1)이었고
        // 새 값은 4.67:1로 통과 — 접근성 버그 수정을 겸한다. 실사용 9건.
        positive: "var(--sem-fg-positive)",
        warning: "var(--sem-fg-warning)",
        informative: "var(--sem-fg-informative)",
        magic: "var(--sem-fg-magic)",
      },
      borderColor: {
        "neutral-weak": "var(--sem-stroke-neutral-weak)",
        "neutral-subtle": "var(--sem-stroke-neutral-subtle)",
        // 신규(4번째 neutral 단계): border-gray-3(#a8a8a8) 대체. hover 강조 테두리 전용.
        "neutral-strong": "var(--sem-stroke-neutral-strong)",
        "brand-solid": "var(--sem-stroke-brand-solid)",
        "critical-weak": "var(--sem-stroke-critical-weak)",
        "focus-ring": "var(--sem-stroke-focus-ring)",
      },
      // ring-primary(선택 카드 강조 표시)가 실사용 중이라 ringColor도 노출한다.
      // Tailwind는 ring을 border와 별도 테마 키로 다룬다.
      ringColor: {
        "brand-solid": "var(--sem-stroke-brand-solid)",
      },
      borderRadius: {
        xs:   "var(--r-xs)",
        sm:   "var(--r-sm)",
        md:   "var(--r-md)",
        lg:   "var(--r-lg)",
        pill: "var(--r-pill)",
      },
      maxWidth: {
        shell:   "var(--shell-w)",
        content: "var(--content-w)",
        detail:  "var(--detail-w)",
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
      fontSize: FONT_SIZE_SCALE,
      // 모션 duration 토큰 4종. tailwindcss-animate의 animationDuration이
      // transitionDuration을 상속하므로, 이 토큰은 transition-*과 animate-in/out에
      // 모두 적용된다. 숫자 duration(duration-300 등)은 쓰지 않는다 —
      // design-foundation.test.mjs가 막는다.
      transitionDuration: {
        micro: "150ms", // hover·press·focus 피드백, 작은 인디케이터
        enter: "300ms", // 나타나거나 새 위치로 자리잡는 전환
        exit:  "200ms", // 사라지는 전환 (등장보다 빠르게)
        slow:  "700ms", // 화면을 크게 차지하는 카드·배너 전환
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
