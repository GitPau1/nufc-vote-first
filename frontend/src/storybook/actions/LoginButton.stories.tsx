import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { LoginButton } from '@/components/composition/common/LoginButton'

const meta = {
  title: 'Composition/Common/LoginButton',
  component: LoginButton,
  parameters: {
    // LoginModal이 usePathname()으로 트래킹 경로를 읽기 때문에,
    // 버튼만 보여주는 스토리에도 라우터 mock이 필요하다.
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
  },
} satisfies Meta<typeof LoginButton>

export default meta
type Story = StoryObj<typeof meta>

// props도 상태 variant도 없다 — 유일한 상태 변화는 클릭 시 열리는 LoginModal이고,
// 그건 LoginModal 문서가 담당한다. 여기서 스토리를 더 늘릴 여지가 없다.
export const Default: Story = {}
