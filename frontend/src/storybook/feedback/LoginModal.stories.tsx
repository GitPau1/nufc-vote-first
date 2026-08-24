import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { LoginModal } from '@/components/polls/LoginModal'
import { RequireAuthModal } from '@/components/auth/RequireAuthModal'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Feedback/LoginModal',
  component: LoginModal,
  parameters: {
    // usePathname()을 쓰기 때문에 appDirectory: true가 없으면
    // "invariant expected app router to be mounted"로 죽는다.
    // pathname은 analytics의 source_page를 결정하는 값이기도 하다.
    nextjs: { appDirectory: true, navigation: { pathname: '/polls/1' } },
    // BottomSheet가 768px을 기준으로 바텀시트/중앙 모달을 갈라서 좁은 폭 확인이 필요하다.
    viewport: { options: INITIAL_VIEWPORTS },
  },
  args: {
    open: true,
    onClose: () => {},
  },
} satisfies Meta<typeof LoginModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** 모바일 폭 — 중앙 모달이 아니라 바텀시트(드래그 핸들 포함)로 뜨는지 확인. */
export const Mobile: Story = {
  globals: { viewport: { value: 'iphone12' } },
}

/**
 * `triggerAction="vote"` (기본값) — 투표 참여를 시도한 비로그인 사용자.
 * `TypeAPollClient`·`TypeBPollClient`·`OverallRatingPollClient`가 이 값을 넘긴다.
 *
 * 아래 네 개의 trigger 스토리는 **화면이 서로 같다.** `triggerAction`은 화면 문구가 아니라
 * `auth_prompt_viewed` 이벤트의 `trigger_action` 속성만 바꾼다(소스 확인). 값마다 스토리를
 * 둔 건 "문구가 갈린다"가 아니라 "갈리지 않는다"를 기록해두기 위한 것이다.
 */
export const TriggerVote: Story = {
  args: { triggerAction: 'vote' },
}

/**
 * `triggerAction="comment"` — 타입에는 있지만 **코드 어디서도 이 값을 넘기지 않는다.**
 * 댓글 작성은 투표 참여자만 가능해서, 비로그인 사용자가 댓글 입력에 도달하는 경로가 아직 없다.
 */
export const TriggerComment: Story = {
  args: { triggerAction: 'comment' },
  parameters: { nextjs: { navigation: { pathname: '/polls/1' } } },
}

/**
 * `triggerAction="create_poll"` — 타입에만 있고 실제 호출부는 없다.
 * 투표 생성 페이지는 이 값 대신 `RequireAuthModal`(= `triggerAction="login"`)을 쓴다.
 */
export const TriggerCreatePoll: Story = {
  args: { triggerAction: 'create_poll' },
  parameters: { nextjs: { navigation: { pathname: '/polls/create' } } },
}

/**
 * `triggerAction="login"` — 특정 행동이 아니라 "로그인" 자체가 시작점인 경우.
 * `layout/LoginButton.tsx`, `app/menu/MenuActions.tsx`, `auth/RequireAuthModal.tsx`가 쓴다.
 */
export const TriggerLogin: Story = {
  args: { triggerAction: 'login' },
  parameters: { nextjs: { navigation: { pathname: '/menu' } } },
}

/**
 * 실제로 열리고 닫히는 형태 — 헤더 로그인 버튼(`layout/LoginButton.tsx`)과 같은 구조다.
 * "닫기" 버튼, 배경 클릭, ESC 모두 `onClose`로 들어온다.
 */
export const Interactive: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          로그인
        </Button>
        <LoginModal open={open} onClose={() => setOpen(false)} triggerAction="login" />
      </>
    )
  },
}

/**
 * `auth/RequireAuthModal.tsx` 사용 형태 — 로그인 없이는 볼 게 없는 화면(`/admin`,
 * `/polls/create`, `/my`, `/my/feedback`, `/onboarding`)에서 `open`을 항상 true로 두고
 * `onClose`를 홈 이동(`router.push('/')`)에 묶은 래퍼다. 닫기 = 화면 이탈이라 취소 경로가 없다.
 * Storybook에서는 라우터가 목이라 홈으로 실제 이동은 하지 않는다(Actions 패널에 push만 기록).
 */
export const RequireAuthGate: Story = {
  parameters: { nextjs: { navigation: { pathname: '/my' } } },
  render: () => <RequireAuthModal />,
}
