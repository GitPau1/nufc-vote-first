import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { ConfirmModal } from '@/components/polls/ConfirmModal'
import { Button } from '@/components/ui/button'
import { RadioOption } from '@/components/ui/radio'

const meta = {
  title: 'Feedback/ConfirmModal',
  component: ConfirmModal,
  parameters: {
    // BottomSheet가 화면 폭 768px을 기준으로 바텀시트/중앙 모달을 갈라서,
    // 좁은 폭 렌더를 확인할 수 있어야 한다.
    viewport: { options: INITIAL_VIEWPORTS },
  },
  args: {
    open: true,
    selectedLabel: '알렉산더 이삭',
    isPending: false,
    onCancel: () => {},
    onConfirm: () => {},
  },
} satisfies Meta<typeof ConfirmModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

/** 모바일 폭 — 중앙 모달이 아니라 바텀시트(드래그 핸들 포함)로 뜨는지 확인. */
export const Mobile: Story = {
  globals: { viewport: { value: 'iphone12' } },
}

/**
 * 전체 평가(`OverallRatingPollClient`)에서 쓰는 문구 조합 — 요약할 "선택" 하나가 없는
 * 제출이라 `title`·`summaryCaption`을 바꾸고 라벨에 채점한 인원 수를 넣는다.
 * 나머지 구조(설명 문구, 요약 박스, 버튼 2개)는 선택형과 같다.
 */
export const RatingSubmit: Story = {
  args: {
    title: '이 평가로 제출하시겠어요?',
    summaryCaption: '내 평가',
    selectedLabel: '선수 23명 평가',
  },
}

/**
 * 제출 중(`isPending`) — 취소/최종 제출 두 버튼이 함께 disabled가 되어야 한다.
 * 투표는 제출 후 수정이 불가능해서, 연타로 두 번 제출되는 일이 절대 없어야 한다.
 */
export const Pending: Story = {
  args: { isPending: true },
}

/**
 * 실제 투표 화면의 흐름 재현 — 선택지를 고르고 "투표하기"로 모달을 띄운 뒤
 * 취소/최종 제출로 닫는다. `onCancel`이 배경 클릭·ESC에도 호출되는지(BottomSheet의
 * `onOpenChange`가 취소로 연결돼 있다) 여기서 확인할 수 있다.
 */
export const Interactive: Story = {
  render: function Render() {
    const options = ['알렉산더 이삭', '브루노 기마랑이스', '스벤 보트만']
    const [selected, setSelected] = useState(0)
    const [open, setOpen] = useState(false)
    const [submitted, setSubmitted] = useState<string | null>(null)

    return (
      <div className="mx-auto flex max-w-[358px] flex-col gap-2">
        {options.map((label, i) => (
          <RadioOption key={label} selected={selected === i} onClick={() => setSelected(i)}>
            <span className="text-label-1-normal">{label}</span>
          </RadioOption>
        ))}
        <Button className="mt-2 h-12" onClick={() => setOpen(true)}>
          투표하기
        </Button>
        {submitted && (
          <p className="text-caption-1 text-muted-foreground">제출됨: {submitted}</p>
        )}
        <ConfirmModal
          open={open}
          selectedLabel={options[selected]}
          isPending={false}
          onCancel={() => setOpen(false)}
          onConfirm={() => {
            setSubmitted(options[selected])
            setOpen(false)
          }}
        />
      </div>
    )
  },
}

/**
 * 선택 항목 이름이 긴 경우 — `selectedLabel`은 사용자가 만든 투표 선택지 텍스트라 길이 제한이
 * 없다. "내 선택" 요약 박스가 줄바꿈되면서 아래 버튼 행을 밀어내지 않아야 한다.
 */
export const LongSelectedLabel: Story = {
  args: {
    selectedLabel: '이번 시즌 세인트제임스파크 홈경기 최우수 선수는 알렉산더 이삭이라고 생각합니다',
  },
}

/** 위와 같은 긴 라벨을 모바일 폭에서 — 바텀시트에서는 세로 공간이 더 빠듯하다. */
export const LongSelectedLabelMobile: Story = {
  args: {
    selectedLabel: '이번 시즌 세인트제임스파크 홈경기 최우수 선수는 알렉산더 이삭이라고 생각합니다',
  },
  globals: { viewport: { value: 'iphone12' } },
}
