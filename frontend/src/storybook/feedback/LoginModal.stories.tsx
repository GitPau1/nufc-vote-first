import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { Modal } from '@/components/primitives/modal/Modal'
import { LoginContent, type LoginTrigger } from '@/components/primitives/modal/contents/Login'
import { RequireAuthModal } from '@/components/auth/RequireAuthModal'
import { Button } from '@/components/ui/button'

// 로그인 내용(LoginContent)을 공용 껍데기(Modal)에 끼워 보여준다. 로그인은 form="default"라
// 모바일에서도 중앙 모달로 뜬다(다른 모달은 responsive라 모바일에서 바텀시트).
const meta = {
  title: 'Feedback/LoginModal',
  parameters: {
    // usePathname()을 쓰기 때문에 appDirectory: true가 없으면
    // "invariant expected app router to be mounted"로 죽는다.
    // pathname은 analytics의 source_page를 결정하는 값이기도 하다.
    nextjs: { appDirectory: true, navigation: { pathname: '/polls/1' } },
    viewport: { options: INITIAL_VIEWPORTS },
  },
  args: { triggerAction: 'login' as LoginTrigger },
  render: (args: { triggerAction: LoginTrigger }) => (
    <Modal open form="default" onOpenChange={() => {}}>
      <LoginContent triggerAction={args.triggerAction} onClose={() => {}} />
    </Modal>
  ),
} satisfies Meta<{ triggerAction: LoginTrigger }>

export default meta
type Story = StoryObj<typeof meta>

/** 기본 스토리는 일반 로그인(`triggerAction="login"`) 상태다 — 문구 비교는 아래 trigger 스토리에서. */
export const Default: Story = {}

/** 모바일 폭 — 로그인은 form="default"라 바텀시트가 아니라 **중앙 모달**로 뜬다. */
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
 */
export const TriggerVote: Story = {
  args: { triggerAction: 'vote' },
}

/**
 * **케이스 2 — 행동 유도(승부예측).** `triggerAction="predict"`.
 * `predict/PredictionFlowClient.tsx`가 제출 시 `unauthenticated`를 받았을 때 띄운다.
 */
export const TriggerPredict: Story = {
  args: { triggerAction: 'predict' },
  parameters: { nextjs: { navigation: { pathname: '/predictions/2026-35' } } },
}

/**
 * 실제로 열리고 닫히는 형태 — 헤더 로그인 버튼(`layout/LoginButton.tsx`)과 같은 구조다.
 * "닫기" 버튼, 배경 클릭, ESC 모두 Modal의 onOpenChange를 통해 닫힘으로 들어온다.
 */
export const Interactive: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          로그인
        </Button>
        <Modal open={open} form="default" onOpenChange={o => { if (!o) setOpen(false) }}>
          <LoginContent triggerAction="login" onClose={() => setOpen(false)} />
        </Modal>
      </>
    )
  },
}

/**
 * `auth/RequireAuthModal.tsx` 사용 형태 — 로그인 없이는 볼 게 없는 화면에서 `open`을 항상
 * true로 두고 닫기를 홈 이동(`router.push('/')`)에 묶은 래퍼다. 닫기 = 화면 이탈이라 취소 경로가 없다.
 */
export const RequireAuthGate: Story = {
  parameters: { nextjs: { navigation: { pathname: '/my' } } },
  render: () => <RequireAuthModal />,
}
