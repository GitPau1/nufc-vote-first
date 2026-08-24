import { addons } from 'storybook/manager-api'
import { create } from 'storybook/theming/create'

// 사이드바·툴바(매니저 UI)도 같은 폰트를 쓴다.
// Nunito Sans는 한글 글리프가 없어서 사이드바의 한국어 항목명이
// 시스템 폴백 폰트로 떨어진다 — 서비스 폰트로 통일한다.
addons.setConfig({
  theme: create({
    base: 'light',
    fontBase:
      "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    brandTitle: 'NUFC Vote 디자인시스템',
    colorPrimary: '#41b6e6',
    colorSecondary: '#1a9fd4',
  }),
})
