import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { AppHeader } from '@/components/composition/common/AppHeader'

const meta = {
  title: 'Navigations/AppHeader',
  component: AppHeader,
  parameters: {
    // appDirectory: true가 없으면 next/navigation 훅(useRouter 등)이
    // "invariant expected app router to be mounted"로 죽는다.
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
    // 모바일 스토리에서 sm:hidden / sm:flex 갈림을 실제로 보여주려면 뷰포트를 좁혀야 한다.
    viewport: { options: INITIAL_VIEWPORTS },
  },
} satisfies Meta<typeof AppHeader>

export default meta
type Story = StoryObj<typeof meta>

export const LoggedOut: Story = {
  args: { auth: null },
}

export const LoggedIn: Story = {
  args: {
    auth: { userId: 'u1', displayName: '뉴카슬팬', isAdmin: false },
  },
}

// 모바일(sm 미만) 전용 레이어 — 로고 중앙 정렬 + 우측 아바타.
export const Mobile: Story = {
  args: { auth: { userId: 'u1', displayName: '뉴카슬팬', isAdmin: false } },
  globals: { viewport: { value: 'iphone12' } },
}

// 모바일 서브 화면 — 로고 대신 '돌아가기' 버튼.
export const MobileBack: Story = {
  args: { auth: null, mobileBack: true },
  globals: { viewport: { value: 'iphone12' } },
}
