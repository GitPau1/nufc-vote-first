import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { Modal } from '@/components/primitives/modal/Modal'
import { PlayerPickContent, type PlayerPickCandidate } from '@/components/primitives/modal/contents/PlayerPick'

// 실제 photoUrl은 lib/predictions/candidates.ts의 playerPhotoUrl(fotmobPlayerId)로 조립되는데,
// 진짜 FotMob 선수 ID가 아니면 403이라 실루엣으로 떨어진다 — 다른 mock과 같은 placehold.co를 쓴다.
const PLACEHOLDER_PHOTO = 'https://placehold.co/88x88/2a2f36/8a929c?text=%20'

// 목록 스크롤 높이는 껍데기가 정하지 않으므로 호출부에서 Modal className으로 준다(실사용과 동일).
const PICK_MODAL_CLASS = 'max-h-[78vh] overflow-y-auto hide-scrollbar sm:max-h-[80vh]'

function mockCandidate(overrides: Partial<PlayerPickCandidate>): PlayerPickCandidate {
  return {
    id: 1001,
    name: '기마랑이스',
    squadNumber: 39,
    photoUrl: PLACEHOLDER_PHOTO,
    nationality: '브라질',
    age: 28,
    multiplier: 1.7,
    ...overrides,
  }
}

const MID_CANDIDATES: PlayerPickCandidate[] = [
  mockCandidate({}),
  mockCandidate({ id: 1002, name: '브루노', squadNumber: 7, nationality: '포르투갈', age: 24, multiplier: 1.3 }),
  mockCandidate({ id: 1003, name: '윌록', squadNumber: 28, nationality: '잉글랜드', age: 26, multiplier: 1.5 }),
  mockCandidate({ id: 1004, name: '토날리', squadNumber: 8, nationality: '이탈리아', age: 25, multiplier: 1.4 }),
  mockCandidate({ id: 1005, name: '조엘린톤', squadNumber: 24, nationality: '브라질', age: 29, multiplier: 1.9 }),
]

type PickArgs = {
  positionLabel: string
  players: PlayerPickCandidate[]
  selectedPlayerId: number | null
}

// 선수 선택 내용(PlayerPickContent)을 공용 껍데기(Modal, form=responsive)에 끼워 보여준다 —
// 모바일=하단 바텀시트 / 데스크탑=중앙 모달.
const meta = {
  title: 'Selection and Input/PlayerPickModal',
  parameters: {
    viewport: { options: INITIAL_VIEWPORTS },
  },
  args: {
    positionLabel: '미드필더',
    players: MID_CANDIDATES,
    selectedPlayerId: null,
  },
  render: (args: PickArgs) => (
    <Modal open onOpenChange={() => {}} className={PICK_MODAL_CLASS}>
      <PlayerPickContent
        positionLabel={args.positionLabel}
        players={args.players}
        selectedPlayerId={args.selectedPlayerId}
        onSelect={() => {}}
      />
    </Modal>
  ),
} satisfies Meta<PickArgs>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 열린 상태의 후보 목록. 행을 누르면 선택 하이라이트가 옮겨간다.
 * 실제 호출부는 선택과 동시에 닫지만, 여기서는 선택만 반영하고 열어둔다(닫히는 흐름은 `SelectAndClose`).
 */
export const Default: Story = {
  render: function Render(args) {
    const [selectedId, setSelectedId] = useState<number | null>(null)
    return (
      <Modal open onOpenChange={() => {}} className={PICK_MODAL_CLASS}>
        <PlayerPickContent
          positionLabel={args.positionLabel}
          players={args.players}
          selectedPlayerId={selectedId}
          onSelect={player => setSelectedId(player.id)}
        />
      </Modal>
    )
  },
}

/** 모바일 폭 — 중앙 모달이 아니라 드래그 핸들이 있는 하단 바텀시트로 떠야 한다. */
export const Mobile: Story = {
  ...Default,
  globals: { viewport: { value: 'iphone12' } },
}

/** 이미 이 포지션에 픽한 선수가 있는 재오픈 케이스 — `selectedPlayerId` 행이 처음부터 하이라이트. */
export const PreSelected: Story = {
  args: { selectedPlayerId: 1002 },
}

/** 후보가 없을 때 — "선택할 수 있는 선수가 없어요" 한 줄만 남는다. */
export const NoCandidates: Story = {
  args: { players: [] },
}

/** 후보가 많을 때 — 시트 높이가 잘리고 내부가 스크롤된다(max-h는 Modal className으로 주입). */
export const ManyCandidates: Story = {
  args: {
    players: Array.from({ length: 14 }, (_, i) =>
      mockCandidate({
        id: 2000 + i,
        name: `후보 선수 ${i + 1}`,
        squadNumber: i + 2,
        multiplier: 1 + (i % 9) / 10,
      })
    ),
  },
}

/** 이름이 긴 선수 — 이름은 truncate, 오른쪽 배당 배지는 shrink-0이라 밀려나지 않아야 한다. */
export const LongPlayerName: Story = {
  args: {
    players: [
      mockCandidate({ id: 3001, name: '알렉산더 이사크 세바스티안', nationality: '스웨덴', age: 26 }),
      ...MID_CANDIDATES.slice(1, 3),
    ],
  },
  globals: { viewport: { value: 'iphone12' } },
}

/**
 * 실제 사용처(`PredictionFlowClient`)의 흐름 재현 — 버튼으로 열고, 선수를 고르면 상태 반영 +
 * 호출부가 직접 닫는다(내용은 선택만 알린다). 배경 클릭·ESC로도 닫히는지 확인한다.
 */
export const SelectAndClose: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    const [picked, setPicked] = useState<PlayerPickCandidate | null>(null)

    return (
      <div className="mx-auto flex max-w-[358px] flex-col gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-sm bg-brand-solid px-4 py-3 text-body-2-normal font-bold text-on-solid"
        >
          미드필더 선택 모달 열기
        </button>
        <p className="text-caption-1 text-neutral-muted">
          {picked ? `선택: ${picked.name} (×${picked.multiplier.toFixed(1)})` : '아직 선택 없음'}
        </p>
        <Modal open={open} onOpenChange={setOpen} className={PICK_MODAL_CLASS}>
          <PlayerPickContent
            positionLabel="미드필더"
            players={MID_CANDIDATES}
            selectedPlayerId={picked?.id ?? null}
            onSelect={player => {
              setPicked(player)
              setOpen(false)
            }}
          />
        </Modal>
      </div>
    )
  },
}

/**
 * 스쿼드 데이터가 덜 채워진 후보 — `squadNumber`·`photoUrl`·`nationality`·`age`가 전부 nullable.
 * 등번호 없으면 `–`, 사진 없으면 실루엣, 국적·나이는 있는 값만 ` · `로 이어 붙는다.
 */
export const MissingSquadData: Story = {
  args: {
    players: [
      mockCandidate({ id: 4001, name: '신입 선수', squadNumber: null, photoUrl: null }),
      mockCandidate({ id: 4002, name: '국적 미정', nationality: null, age: 22 }),
      mockCandidate({ id: 4003, name: '나이 미정', nationality: '잉글랜드', age: null }),
      mockCandidate({ id: 4004, name: '정보 없음', squadNumber: null, photoUrl: null, nationality: null, age: null }),
    ],
  },
}
