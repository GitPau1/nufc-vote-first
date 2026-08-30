import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { Modal } from '@/components/primitives/modal/Modal'
import { FeedbackContent } from '@/components/primitives/modal/contents/Feedback'
import { Button } from '@/components/primitives/button'

// FAB가 여는 피드백 모달의 본문. 만족도(선택)+카테고리+내용. 카테고리 초깃값은
// 현재 경로(pathname)에서 pathToCategory로 정해진다.
const meta = {
  title: 'Feedback/FeedbackModal',
  parameters: {
    // usePathname()을 쓰므로 appDirectory 없으면 "app router mounted" invariant로 죽는다.
    nextjs: { appDirectory: true, navigation: { pathname: '/predictions/2026-35' } },
    viewport: { options: INITIAL_VIEWPORTS },
  },
  render: () => (
    <Modal open onOpenChange={() => {}}>
      <FeedbackContent onClose={() => {}} />
    </Modal>
  ),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** 승부예측 페이지 맥락 — 카테고리 초깃값이 "승부예측"으로 선택돼 있다. */
export const Default: Story = {}

/** 투표 홈 맥락 — 카테고리 초깃값 "투표". */
export const FromVotePage: Story = {
  parameters: { nextjs: { navigation: { pathname: '/' } } },
}

/** 매핑 안 되는 경로 — 카테고리 초깃값 "기타". */
export const FromEtcPage: Story = {
  parameters: { nextjs: { navigation: { pathname: '/menu' } } },
}

/** 모바일 폭 — responsive라 바텀시트로 뜬다. */
export const Mobile: Story = {
  globals: { viewport: { value: 'iphone12' } },
}

/** 실제로 열리고 닫히는 형태 — FAB(FeedbackFab)와 같은 구조. */
export const Interactive: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          피드백 남기기
        </Button>
        <Modal open={open} onOpenChange={o => { if (!o) setOpen(false) }}>
          <FeedbackContent onClose={() => setOpen(false)} />
        </Modal>
      </>
    )
  },
}
