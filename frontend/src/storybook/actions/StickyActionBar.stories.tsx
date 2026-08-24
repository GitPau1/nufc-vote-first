import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { StickyActionBar } from '@/components/layout/StickyActionBar'
import { Button } from '@/components/ui/button'

/**
 * 투표 상세(`/polls/[id]`) 레이아웃 축약판.
 *
 * 이 컴포넌트의 본질은 "스크롤되는 화면의 하단에 붙어 있다"는 것이라 빈 캔버스에 두면
 * 아무 의미가 없다. 그래서 사용처(TypeAPollClient 등)와 같은 골격 —
 * `min-h-screen` 세로 컬럼 + `overflow-y-auto` 스크롤 영역 + `pb-[88px]` — 을 그대로 깐다.
 * 하단 패딩은 컴포넌트가 만들어주지 않고 호출부가 직접 주는 값이라 여기서도 호출부 쪽에 둔다.
 *
 * 데스크탑(≥640px)에서 `min-h-0`으로 푸는 것만 사용처와 다르다 — Docs 페이지에서
 * 100vh 빈 컬럼이 늘어지는 걸 막기 위한 문서용 조정이다.
 */
function PollDetailFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col sm:min-h-0">
      <div className="mx-auto w-full max-w-detail flex-1 overflow-y-auto hide-scrollbar pb-[88px] sm:flex-none sm:overflow-visible sm:pb-0">
        <div className="relative h-[140px] overflow-hidden bg-brand-solid">
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <p className="text-caption-2 font-semibold text-white/80">평가 · D-3 마감</p>
            <p className="text-heading-2 font-bold text-white">스크롤되는 투표 상세 본문</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="rounded-lg border border-neutral-weak bg-surface p-4">
              <p className="text-label-1-normal font-semibold text-neutral">보기 {i + 1}</p>
              <p className="text-caption-1 text-neutral-muted">
                액션바가 이 목록 위에 떠 있는지 확인하기 위한 더미 콘텐츠
              </p>
            </div>
          ))}
        </div>
      </div>

      {children}
    </div>
  )
}

const meta = {
  title: 'Actions/StickyActionBar',
  component: StickyActionBar,
  parameters: {
    // 화면 하단 고정 컴포넌트라 캔버스 패딩이 있으면 위치가 실제와 달라진다.
    layout: 'fullscreen',
    // 모바일(<640px)의 fixed 분기가 이 컴포넌트의 주 형태인데, Docs 페이지는 스토리를
    // 문서와 같은 DOM에 인라인으로 그려서 (1) fixed가 문서 전체 뷰포트 기준으로 빠지고
    // (2) 문서 폭(≥640px)이라 sm:static 분기가 켜진다. BottomNav와 같은 방식으로
    // 스토리를 진짜 iframe에 담아, 375px 폭 iframe 안에서 모바일 분기를 보여준다.
    // (iframe 폭 강제는 src/storybook/_internal/mobile-only-docs-fix.css)
    docs: { story: { inline: false, height: '460px' } },
  },
  decorators: [
    Story => (
      <PollDetailFrame>
        <Story />
      </PollDetailFrame>
    ),
  ],
} satisfies Meta<typeof StickyActionBar>

export default meta
type Story = StoryObj<typeof meta>

/**
 * TypeAPollClient·TypeBPollClient의 제출 바 — 버튼 1개, `w-full h-12`.
 * 두 화면의 children이 완전히 같아서 하나의 스토리로 대표한다.
 */
export const VoteSubmit: Story = {
  args: {
    children: (
      <Button className="h-12 w-full text-body-2-normal font-bold">투표하기</Button>
    ),
  },
}

/**
 * OverallRatingPollClient의 중간 스텝 — 마지막 포지션이 아니면 제출이 아니라
 * 다음 스텝으로 넘기는 버튼이 들어간다. 같은 바가 화면 상태에 따라 다른 동작을 갖는 사례.
 */
export const RatingStepNext: Story = {
  args: {
    children: (
      <Button className="h-12 w-full rounded-lg text-body-2-normal font-bold">
        다음 포지션 평가
      </Button>
    ),
  },
}

/**
 * OverallRatingPollClient의 마지막 스텝 — 필수 평가가 다 안 찼으면 disabled다.
 * 비활성 상태에서도 바 자체(배경·상단 보더)는 그대로 보인다는 점 확인용.
 */
export const RatingSubmitDisabled: Story = {
  args: {
    children: (
      <Button disabled className="h-12 w-full rounded-lg text-body-2-normal font-bold">
        전체 평가 제출
      </Button>
    ),
  },
}

/**
 * 데스크탑(≥640px) 분기 — `sm:static`으로 fixed를 풀고 배경·상단 보더·blur를 모두 없앤 뒤
 * 컨텐츠 흐름 맨 아래에 그냥 놓인다(`sm:pb-10`). 위 3개와 달리 iframe에 담지 않고
 * Docs 문서 폭(데스크탑)에서 인라인으로 그려야 이 분기가 보인다.
 */
export const DesktopInFlow: Story = {
  parameters: { docs: { story: { inline: true, height: 'auto' } } },
  args: {
    children: (
      <Button className="h-12 w-full text-body-2-normal font-bold">투표하기</Button>
    ),
  },
}
