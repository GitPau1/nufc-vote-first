import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { RankingCard, type RankingEntry } from '@/components/predict/RankingCard'

// 아바타 자리엔 실제로 프로필 이미지 URL이 들어오는데(없으면 컴포넌트가 User 아이콘으로 대체),
// 다른 예측 mock과 같은 placehold.co를 쓴다.
const PLACEHOLDER_AVATAR = 'https://placehold.co/56x56/2a2f36/8a929c?text=%20'

const NAME_POOL = ['김민준', '이서연', '정하윤', '박지훈', '최유진', '강태양', '윤소율', '임도현']

function mockEntry(overrides: Partial<RankingEntry>): RankingEntry {
  return { rank: 1, name: '김민준', totalPoints: 56, ...overrides }
}

/**
 * `/dev/predict-preview`의 `buildLeaderboard()`와 같은 모양(10명, 6점 간격, 홀/짝으로 ▲▼ 교대).
 * 내 순위만 인자로 바꿀 수 있게 해서 "TOP N 안/밖" 두 경우를 같은 데이터로 비교한다.
 * myRank에 없는 값(0 등)을 주면 isMe가 아무 항목에도 안 붙어 "미참여" 상태가 된다.
 */
function mockLeaderboard(myRank: number): RankingEntry[] {
  return Array.from({ length: 10 }, (_, i) => {
    const rank = i + 1
    const isMe = rank === myRank
    return mockEntry({
      rank,
      name: isMe ? '나' : NAME_POOL[i % NAME_POOL.length],
      totalPoints: Math.max(0, 62 - rank * 6),
      isMe,
      // 내 행은 프리뷰 페이지와 마찬가지로 변동을 안 붙인다(delta: null).
      delta: isMe ? null : rank % 2 === 0 ? rank : -rank,
    })
  })
}

// 실사용처(`/dev/predict-preview`)에서 본문 옆 사이드 카드로 놓이는 폭 — 데스크탑 캔버스 그대로
// 두면 이름 컬럼(flex-1)만 늘어나서 실제 밀도와 달라진다.
const cardWidth = { decorators: [(Story: () => React.JSX.Element) => <div style={{ maxWidth: 358 }}><Story /></div>] }

const meta = {
  title: 'Contents/RankingCard',
  component: RankingCard,
  ...cardWidth,
  argTypes: {
    variant: {
      control: 'select',
      options: ['top3', 'mine'],
      description:
        'top3: entries 상위 limit명 + 컬럼 헤더. mine: entries에서 isMe 항목 하나만 뽑아 단독 표시(헤더 없음).',
    },
    limit: {
      control: { type: 'number', min: 1 },
      description: 'variant="top3"에서만 쓰인다(제목 "전체 랭킹 TOP N"도 이 값으로 만든다). mine은 무시.',
    },
  },
  args: {
    variant: 'top3',
    entries: mockLeaderboard(8),
  },
} satisfies Meta<typeof RankingCard>

export default meta
type Story = StoryObj<typeof meta>

export const Top3: Story = {
  args: { variant: 'top3' },
}

/**
 * 내 순위가 TOP 3 밖(8위)일 때 — `variant="mine"`은 limit과 무관하게 `isMe` 항목을 찾아서
 * 보여준다. 그래서 위 Top3 카드와 **같은 배열을 그대로** 넘기면 되고, 부모가 "내 순위만 따로
 * 조회"할 필요가 없다.
 */
export const Mine: Story = {
  args: { variant: 'mine' },
}

/**
 * 실제 배치 — TOP 3 카드 아래에 내 순위 카드를 붙인다. 두 카드의 컬럼 폭(순위 w-8 / 아바타 w-7 /
 * 이름 flex-1 / 총점 w-12)이 같아서 헤더가 하나뿐이어도 세로로 줄이 맞는다. 이 정렬이 두 카드를
 * 붙여 쓸 수 있는 근거라, 컬럼 폭을 건드리면 여기서 먼저 깨진다.
 */
export const StackedPair: Story = {
  args: { variant: 'top3' },
  parameters: { controls: { include: [] } },
  render: () => {
    const leaderboard = mockLeaderboard(8)
    return (
      <div className="flex flex-col gap-4">
        <RankingCard variant="top3" entries={leaderboard} />
        <RankingCard variant="mine" entries={leaderboard} />
      </div>
    )
  },
}

/**
 * `limit`을 늘리면 제목까지 "전체 랭킹 TOP 10"으로 같이 바뀐다(제목이 limit에서 파생된다).
 * 그리고 내가 그 범위 안(8위)에 들어오면 top3 variant에서도 내 행이 브랜드 색으로 강조된다 —
 * 강조는 variant가 아니라 `entry.isMe`가 결정한다.
 */
export const Top10: Story = {
  args: { variant: 'top3', limit: 10 },
}

/**
 * 참여자가 limit보다 적을 때 — 제목은 여전히 "TOP 3"인데 줄은 2개다(제목이 실제 행 수가 아니라
 * limit에서 나오기 때문). 시즌 초반에 실제로 보게 되는 상태이므로, 제목을 행 수로 바꾸고 싶다면
 * 컴포넌트를 고쳐야 한다.
 */
export const FewerThanLimit: Story = {
  args: {
    variant: 'top3',
    entries: [mockEntry({ rank: 1, name: '이서연', totalPoints: 12, delta: 1 }), mockEntry({ rank: 2, name: '박지훈', totalPoints: 5, delta: -1 })],
  },
}

/** 시즌 초반(참여자 0명) — 헤더 행조차 렌더하지 않고 안내 문구만 남는다. */
export const EmptyTop3: Story = {
  args: { variant: 'top3', entries: [] },
}

/**
 * 미참여 — 배열이 비어 있을 때가 아니라 **`isMe`가 붙은 항목이 없을 때** 뜬다.
 * 즉 랭킹 데이터가 10명 다 있어도 로그인 사용자가 아직 예측을 안 했으면 이 상태다.
 * (문구도 top3의 "랭킹 데이터가 없어요"와 다르다.)
 */
export const EmptyMine: Story = {
  args: { variant: 'mine', entries: mockLeaderboard(0) },
}

/**
 * 순위 변동 표기 4가지. `delta`가 `null`/`undefined`면 아무것도 안 붙고, 양수는 ▲(critical, 적색),
 * 음수는 ▼(회색)이다. **`0`은 `delta >= 0` 분기에 걸려 "▲0"으로 나온다** — "변동 없음"을 따로
 * 표현하고 싶으면 부모가 `0` 대신 `null`을 넘겨야 한다.
 */
export const RankDeltaCases: Story = {
  args: {
    variant: 'top3',
    limit: 4,
    entries: [
      mockEntry({ rank: 1, name: '상승(▲2)', totalPoints: 56, delta: 2 }),
      mockEntry({ rank: 2, name: '하락(▼3)', totalPoints: 50, delta: -3 }),
      mockEntry({ rank: 3, name: '변동 0 → ▲0', totalPoints: 44, delta: 0 }),
      mockEntry({ rank: 4, name: '표시 없음(null)', totalPoints: 38, delta: null }),
    ],
  },
}

/**
 * 아바타가 있는 행과 없는 행이 섞였을 때 — `avatarUrl`이 없으면 회색 원 + `User` 아이콘으로
 * 대체된다(빈 자리로 무너지지 않는다). 마지막 행은 긴 닉네임 truncate 확인용으로, 이름만
 * 줄어들고 순위/총점 컬럼은 고정폭이라 밀리지 않아야 한다.
 */
export const AvatarsAndLongName: Story = {
  args: {
    variant: 'top3',
    limit: 3,
    entries: [
      mockEntry({ rank: 1, name: '김민준', totalPoints: 56, delta: 2, avatarUrl: PLACEHOLDER_AVATAR }),
      mockEntry({ rank: 2, name: '이서연', totalPoints: 50, delta: -1 }),
      mockEntry({ rank: 3, name: '뉴캐슬사랑한다내평생을바쳐서', totalPoints: 44, delta: 1, avatarUrl: PLACEHOLDER_AVATAR }),
    ],
  },
}
