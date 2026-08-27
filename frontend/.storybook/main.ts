import remarkGfm from 'remark-gfm'
import tsconfigPaths from 'vite-tsconfig-paths'
import type { StorybookConfig } from '@storybook/nextjs-vite'

// 스토리와 규칙 MDX는 모두 src/storybook/ 아래에만 둔다.
// 카테고리 폴더는 Montage 분류를 따른다 —
// foundations / actions / contents / feedback / loading / navigations / presentation / selection-and-input
const config: StorybookConfig = {
  stories: [
    '../src/storybook/**/*.mdx',
    '../src/storybook/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: [
    {
      name: '@storybook/addon-docs',
      // 기본 MDX(CommonMark)는 GFM 표 문법(`| a | b |`)을 지원하지 않아 그냥 텍스트로
      // 남는다 — Foundations 문서 여러 곳(Motion/Color/Layout/State/Radius/Elevation
      // /Typography)이 마크다운 표를 쓰고 있어서 remark-gfm을 명시적으로 얹는다.
      options: {
        mdxPluginOptions: {
          mdxCompileOptions: {
            remarkPlugins: [remarkGfm],
          },
        },
      },
    },
    // 접근성 패널 — 6단계 QA 체크리스트 5번(접근성)에서 쓴다
    '@storybook/addon-a11y',
  ],
  framework: '@storybook/nextjs-vite',
  // nextjs-vite 프리셋의 viteFinal은 styled-jsx alias만 얹고 tsconfig의 `@/*` 경로는
  // vite에 연결하지 않는다 — 그래서 스토리의 `@/components/...` import가 전부 해석에
  // 실패한다. tsconfig(paths의 source of truth)를 그대로 읽는 플러그인을 붙여 맞춘다.
  viteFinal: async (config) => {
    config.plugins = [...(config.plugins ?? []), tsconfigPaths()]
    return config
  },
}

export default config
