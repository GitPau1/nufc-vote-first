import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { Modal } from '@/components/primitives/modal/Modal'
import { PollPickerContent, type PlayerPickMode } from '@/components/primitives/modal/contents/PollPicker'
import type { PollFormPlayer } from '@/lib/queries/polls'

// PlayerPickModal 스토리와 같은 이유의 placeholder — 진짜 선수 사진 URL이 아니면 어차피 실패한다.
const PLACEHOLDER_PHOTO = 'https://placehold.co/88x88/2a2f36/8a929c?text=%20'

// 전체높이 시트 클래스 — 껍데기(Modal)는 높이를 정하지 않으므로 호출부가 준다.
// 실사용(UserPollCreateForm)의 Modal className을 그대로 옮겼다.
const PICKER_MODAL_CLASS = 'flex h-[82vh] max-h-[82vh] flex-col overflow-hidden p-0'

function mockPlayer(overrides: Partial<PollFormPlayer>): PollFormPlayer {
  return {
    id: 'mid-1',
    name: '기마랑이스',
    position: 'MID',
    squad_number: 39,
    photo_url: PLACEHOLDER_PHOTO,
    is_active: true,
    squad_status: 'first_team',
    ...overrides,
  }
}

const SQUAD: PollFormPlayer[] = [
  mockPlayer({ id: 'gk-1', name: '포프', position: 'GK', squad_number: 22 }),
  mockPlayer({ id: 'df-1', name: '트리피어', position: 'DEF', squad_number: 2 }),
  mockPlayer({ id: 'df-2', name: '보트만', position: 'DEF', squad_number: 4, photo_url: null }),
  mockPlayer({}),
  mockPlayer({ id: 'mid-2', name: '토날리', squad_number: 8 }),
  mockPlayer({ id: 'mid-3', name: 'U21 유망주', squad_number: null, squad_status: 'u21', photo_url: null }),
  mockPlayer({ id: 'fw-1', name: '고든', position: 'FWD', squad_number: 10 }),
  mockPlayer({ id: 'fw-2', name: '임대 공격수', position: 'FWD', squad_number: null, squad_status: 'loan', photo_url: null }),
  mockPlayer({ id: 'mgr-1', name: '하우 감독', position: 'MGR', squad_number: null, photo_url: null }),
]

type PickerArgs = {
  mode: PlayerPickMode
  players: PollFormPlayer[]
  initialSelected: string[]
}

// 선수 선택 내용(PollPickerContent)을 공용 껍데기(Modal, form=responsive)에 끼워 보여준다.
// 토글 동작은 실사용(UserPollCreateForm.togglePlayer)과 같다 —
// single이면 교체(+실사용은 즉시 닫힘), multiple이면 배열 토글.
function PickerHarness({ mode, players, initialSelected }: PickerArgs) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelected)
  return (
    <Modal open onOpenChange={() => {}} className={PICKER_MODAL_CLASS}>
      <PollPickerContent
        mode={mode}
        players={players}
        selectedIds={selectedIds}
        onToggle={playerId =>
          setSelectedIds(prev =>
            mode === 'single'
              ? [playerId]
              : prev.includes(playerId)
                ? prev.filter(id => id !== playerId)
                : [...prev, playerId]
          )
        }
        onDone={() => {}}
      />
    </Modal>
  )
}

const meta = {
  title: 'Primitives/Modal/PollPicker',
  parameters: {
    viewport: { options: INITIAL_VIEWPORTS },
  },
  args: {
    mode: 'multiple' as PlayerPickMode,
    players: SQUAD,
    initialSelected: [] as string[],
  },
  render: (args: PickerArgs) => <PickerHarness {...args} />,
} satisfies Meta<PickerArgs>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 다중 선택 모드(투표 후보 고르기). 검색바 + 소속 필터 칩(전체/1군/임대/U21) +
 * 포지션 그룹 목록 + 하단 "N명 선택 완료" 버튼. 행을 누르면 선택이 토글된다.
 * 검색·필터는 컴포넌트 내부 상태라 스토리에서도 직접 조작해 볼 수 있다.
 */
export const Default: Story = {}

/** 모바일 폭 — 중앙 모달이 아니라 드래그 핸들이 있는 하단 바텀시트로 떠야 한다. */
export const Mobile: Story = {
  globals: { viewport: { value: 'iphone12' } },
}

/**
 * 단일 선택 모드(평가 대상 선수 1명). 하단 "선택 완료" 버튼이 없다 —
 * 실사용에서는 행을 누르는 즉시 호출부(`togglePlayer`)가 선택을 반영하고 모달을 닫는다.
 */
export const SingleMode: Story = {
  args: { mode: 'single' },
}

/** 재오픈 케이스 — 이미 고른 선수들이 하이라이트 + 체크 원으로 표시되고, 완료 버튼 카운트에 반영된다. */
export const PreSelected: Story = {
  args: { initialSelected: ['mid-1', 'fw-1'] },
}

/** 선택 가능한 선수가 하나도 없을 때 — "검색 결과가 없습니다." 한 줄만 남는다. */
export const NoPlayers: Story = {
  args: { players: [] },
}

/**
 * `is_active: false`(구단 외) 선수는 목록에서 항상 제외된다 — 필터를 "전체"로 두어도 안 나온다.
 * 아래 목록은 10명을 넘겼지만 이사크(구단 외)가 빠져 9명만 렌더된다.
 */
export const InactiveExcluded: Story = {
  args: {
    players: [...SQUAD, mockPlayer({ id: 'fw-3', name: '이사크', position: 'FWD', squad_number: 14, is_active: false })],
  },
}
