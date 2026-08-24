import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { BottomNav } from '@/components/layout/BottomNav'

const meta = {
  title: 'Navigations/BottomNav',
  component: BottomNav,
  parameters: {
    // appDirectory: true가 없으면 next/navigation 훅이
    // "invariant expected app router to be mounted"로 죽는다.
    // navigation.pathname은 usePathname()이 읽어 활성 탭을 계산한다.
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
    // Docs 페이지는 스토리를 문서와 같은 DOM에 인라인으로 그리는데, 이 경로에서는
    // nextjs.navigation.pathname mock이 스토리별로 안 갈려서(전부 같은 기본값으로 붙어) usePathname()
    // 기반 조건부 렌더(BottomNav의 return null)가 깨진다 — 게다가 BottomNav는 fixed bottom-0라서
    // 인라인으로 그리면 "진짜 뷰포트" 맨 아래로도 빠진다. inline: false로 각 스토리를 진짜 iframe에
    // 담아서, 스토리 뷰(정상 동작 확인됨)와 동일한 조건으로 Docs에서도 그리게 한다.
    docs: { story: { inline: false, height: '260px' } },
  },
} satisfies Meta<typeof BottomNav>

export default meta
type Story = StoryObj<typeof meta>

export const VoteActive: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/' } } },
}

export const PlayersActive: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/players' } } },
}

export const MenuActive: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/menu' } } },
}
