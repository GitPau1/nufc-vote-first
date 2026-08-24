import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { userEvent, within } from 'storybook/test'

import { UserMenu } from '@/components/composition/common/UserMenu'

const meta = {
  title: 'Composition/Common/UserMenu',
  component: UserMenu,
  parameters: {
    // 드롭다운 항목이 next/link라서 appDirectory: true가 없으면
    // "invariant expected app router to be mounted"로 죽는다.
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
  },
  // 드롭다운은 트리거 기준 absolute right-0 top-10(좌측으로 144px 이상, 아래로 ~180px)이다.
  // 여백을 주지 않으면 열린 상태 스토리에서 메뉴가 프리뷰 밖으로 잘려 안 보인다.
  decorators: [
    (Story) => (
      <div style={{ minHeight: 220, paddingLeft: 160 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    avatarUrl: 'https://placehold.co/32x32',
    displayName: '뉴카슬팬',
  },
}

/**
 * 아바타 이미지가 없을 때(구글 프로필 사진이 없거나 로딩 실패) — `displayName`의 첫 글자
 * 하나만 brand-weak 배경 위에 남는다. 이름 길이는 화면에 영향을 주지 않는다(한 글자로 잘림).
 */
export const FallbackInitial: Story = {
  args: { displayName: '뉴카슬유나이티드를사랑하는사람' },
}

/**
 * 이름도 없는 경우 — 하드코딩된 `'U'`로 떨어진다. 아바타 자리가 비어 헤더 우측이
 * 무너지는 일은 없어야 하므로 이 상태를 회귀 대상으로 남긴다.
 */
export const NoIdentity: Story = {
  args: {},
}

/** 드롭다운 열린 상태 — 일반 사용자는 마이페이지 / 피드백 남기기 / 로그아웃 3개. */
export const Open: Story = {
  args: {
    avatarUrl: 'https://placehold.co/32x32',
    displayName: '뉴카슬팬',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'user menu' }))
    await canvas.findByRole('link', { name: '마이페이지' })
  },
}

/**
 * `isAdmin`이 켜지면 '관리자 페이지'(`/admin`) 항목이 한 줄 늘어난다 —
 * 아바타 자체는 일반 사용자와 완전히 같고, 차이는 열어봐야만 보인다.
 */
export const AdminOpen: Story = {
  args: {
    avatarUrl: 'https://placehold.co/32x32',
    displayName: '관리자',
    isAdmin: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'user menu' }))
    await canvas.findByRole('link', { name: '관리자 페이지' })
  },
}
