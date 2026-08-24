import { create } from 'storybook/theming/create'

import type { Preview } from '@storybook/nextjs-vite'

// 앱과 같은 토큰·폰트를 쓰기 위해 globals.css를 그대로 불러온다.
// 여기에는 Pretendard Variable CDN import, Tailwind 지시자, foundation 토큰이 모두 들어있다.
import '../src/app/globals.css'

// Docs 페이지에서 `sm:hidden` 모바일 전용 컴포넌트(BottomNav 등)의 story iframe이 데스크탑
// 폭을 받아 안 보이는 문제 보정. Storybook 전용이라 여기서만 불러오고 앱에는 안 섞는다.
import '../src/storybook/_internal/mobile-only-docs-fix.css'

// Storybook 기본 테마의 fontBase는 Nunito Sans다. 그대로 두면 docs(MDX) 본문이
// 우리 서비스 폰트가 아닌 Nunito로 렌더된다 — 디자인시스템 문서로서는 잘못된 표시다.
// globals.css의 --font 계열이 아니라 Storybook 테마를 직접 덮어써야 한다.
const PRETENDARD =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"

const docsTheme = create({
  base: 'light',
  fontBase: PRETENDARD,
  brandTitle: 'NUFC Vote 디자인시스템',
  colorPrimary: '#41b6e6',
  colorSecondary: '#1a9fd4',
})

const preview: Preview = {
  parameters: {
    docs: {
      theme: docsTheme,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // 라이트 테마 전용 서비스다 (다크모드는 MVP 이후).
    // 앱 배경(--c-bg #fafafa)과 같은 값을 기본 캔버스로 둔다.
    backgrounds: {
      options: {
        bg: { name: 'App background (#fafafa)', value: '#fafafa' },
        surface: { name: 'Surface (#ffffff)', value: '#ffffff' },
      },
    },
    a11y: {
      // 'todo' — 위반을 패널에 표시만 한다 (CI 실패로 만들지 않음)
      test: 'todo',
    },
  },
  initialGlobals: {
    backgrounds: { value: 'bg' },
  },
}

export default preview
