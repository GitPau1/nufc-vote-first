import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { DesktopNavLinks } from '@/components/composition/common/DesktopNavLinks'

const meta = {
  title: 'Composition/Common/DesktopNavLinks',
  component: DesktopNavLinks,
  parameters: {
    // appDirectory: true가 없으면 next/navigation 훅이
    // "invariant expected app router to be mounted"로 죽는다.
    // navigation.pathname은 usePathname()이 읽어 활성 항목을 계산한다 — 이 컴포넌트의 핵심 입력.
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
    // BottomNav와 같은 이유: Docs 페이지에서 스토리를 인라인으로 그리면 pathname mock이
    // 스토리별로 갈리지 않아 전부 같은 활성 상태로 보인다. iframe에 담아 스토리 뷰와 동일 조건으로 만든다.
    // (iframe은 Docs 본문 폭 = 640px 이상을 받으므로 `sm:flex`도 그대로 켜진다.)
    docs: { story: { inline: false, height: '96px' } },
  },
} satisfies Meta<typeof DesktopNavLinks>

export default meta
type Story = StoryObj<typeof meta>

export const VoteActive: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/' } } },
}

/**
 * 투표 상세(`/polls/...`)에서도 '투표'가 활성으로 남는다 — `/`는 정확히 일치 또는
 * `/polls` 접두사일 때 활성이라는 예외 규칙이 있고, 이 스토리가 그 규칙을 지킨다.
 */
export const PollDetailKeepsVoteActive: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/polls/abc' } } },
}

export const PredictionsActive: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/predictions' } } },
}

export const PlayersActive: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/players' } } },
}

/**
 * GNB에 없는 경로(마이페이지·메뉴 등)에서는 활성 항목이 하나도 없다 —
 * 억지로 '투표'를 켜두지 않는다.
 */
export const NoneActive: Story = {
  parameters: { nextjs: { appDirectory: true, navigation: { pathname: '/my' } } },
}
