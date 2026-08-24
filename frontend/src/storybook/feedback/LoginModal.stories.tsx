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
    // triggerAction은 기본값이 없다 — 문구를 가르는 값이라 호출부가 늘 명시한다.
    triggerAction: 'login',
  },
} satisfies Meta<typeof LoginModal>

export default meta
type Story = StoryObj<typeof meta>

/** 기본 스토리는 일반 로그인(`triggerAction="login"`) 상태다 — 문구 비교는 아래 trigger 스토리에서. */
export const Default: Story = {}

/** 모바일 폭 — 중앙 모달이 아니라 바텀시트(드래그 핸들 포함)로 뜨는지 확인. */
export const Mobile: Story = {
  globals: { viewport: { value: 'iphone12' } },
}

/**
 * **케이스 1 — 일반 로그인.** `triggerAction="login"`. 특정 행동이 아니라 "로그인" 자체가
 * 시작점인 경우: 헤더 로그인 버튼(`layout/LoginButton.tsx`), 메뉴 화면(`app/menu/MenuActions.tsx`),
 * 보호된 화면 게이트(`auth/RequireAuthModal.tsx`). 문구는 "필요"를 말하지 않고 로그인해서
 * 얻는 것(참여·내 기록)을 말한다.
 */
export const TriggerLogin: Story = {
  args: { triggerAction: 'login' },
  parameters: { nextjs: { navigation: { pathname: '/menu' } } },
}

/**
 * **케이스 2 — 행동 유도(투표).** `triggerAction="vote"`. 투표하려다 막힌 비로그인 사용자.
 * `TypeAPollClient`·`TypeBPollClient`·`OverallRatingPollClient`가 이 값을 넘긴다.
 * 아래 `TriggerLogin`과 나란히 두고 보면 설명문이 실제로 갈리는 게 보인다.
 */
export const TriggerVote: Story = {
  args: { triggerAction: 'vote' },
}

/**
 * **케이스 2 — 행동 유도(승부예측).** `triggerAction="predict"`.
 * `predict/PredictionFlowClient.tsx`가 제출 시 `unauthenticated`를 받았을 때 띄운다 —
 * 3스텝을 다 채운 뒤 만나는 로그인 벽이라 "투표"가 아니라 "승부예측"이라고 말해야 한다.
 */
export const TriggerPredict: Story = {
  args: { triggerAction: 'predict' },
  parameters: { nextjs: { navigation: { pathname: '/predictions/2026-35' } } },
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
