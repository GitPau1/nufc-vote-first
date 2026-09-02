import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { userEvent, within } from 'storybook/test'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { WeekRankCard } from '@/components/composition/predict/WeekRankCard'
import type { RankingRow } from '@/lib/queries/predictions'

// 실제로는 프로필 이미지 URL이 들어온다(없으면 컴포넌트가 User 아이콘으로 대체) —
// 다른 예측 mock과 같은 placehold.co를 쓴다.
const PLACEHOLDER_AVATAR = 'https://placehold.co/56x56/2a2f36/8a929c?text=%20'

// 16명까지 그리는 스토리가 있어서, 같은 이름이 반복되면 목록을 읽을 때 행 구분이 어려워진다.
const NAME_POOL = [
  '김민준', '이서연', '정하윤', '박지훈', '최유진', '강태양', '윤소율', '임도현',
  '한지우', '오세훈', '신아린', '배준호', '문가온', '서예린', '노태민', '조은우',
]

function mockEntry(overrides: Partial<RankingRow>): RankingRow {
  return {
    userId: 'mock-1',
    rank: 1,
    name: '김민준',
    avatarUrl: null,
    matchPoints: 3,
    pickPoints: 12,
    totalPoints: 15,
    isMe: false,
    ...overrides,
  }
}

/**
 * 주차 랭킹 한 판. 점수 폭은 목 모드(`lib/mock/data.ts`의 `MOCK_RANKING`)와 같은 감각 —
 * 예측은 스코어 적중 여부라 0 아니면 3이고, 선수픽은 배당 때문에 두 자리까지 벌어진다.
 * 총점은 순위와 어긋나지 않게 단조 감소로 만들고, 동점은 별도 스토리에서 다룬다.
 * myRank에 목록 밖 값(0 등)을 주면 `isMe`가 아무 행에도 안 붙어 "미로그인 상태의 랭킹"이 된다.
 */
function mockRanking(count: number, myRank: number): RankingRow[] {
  return Array.from({ length: count }, (_, i) => {
    const rank = i + 1
    const isMe = rank === myRank
    const totalPoints = Math.max(1, 18 - rank)
    const matchPoints = totalPoints >= 3 && rank % 3 !== 0 ? 3 : 0
    return mockEntry({
      userId: `mock-${rank}`,
      rank,
      name: isMe ? '나' : NAME_POOL[i % NAME_POOL.length],
      matchPoints,
      pickPoints: totalPoints - matchPoints,
      totalPoints,
      isMe,
    })
  })
}

// 실사용처(`PredictionResult`의 피날레)는 2026-09-01 개편으로 흰 Card 셸이 없어졌다 — 이 카드는
// 이제 자체 배경 없이 다크 카드(`spotlight-glow-brand-strong`, 피날레 컴포넌트) 안에 투명하게
// 얹힌다. 페이지 컨테이너(`max-w-[560px] px-4` / `sm:max-w-[709px] sm:px-6`)와 피날레 카드
// 자체 패딩(`px-4`, 브레이크포인트 무관 고정)을 빼면 폰(390px)에서 390−32−32 = 326,
// 데스크탑(709px)에서 709−48−32 = 629가 실제 렌더 폭이다 — 아래 데코레이터가 다크 카드까지
// 함께 감싸서 라이트 Storybook 캔버스에서도 온솔리드 토큰이 실제 밝기로 보이게 한다.
function darkCardDecorators(maxWidth: number) {
  return [
    (Story: () => React.JSX.Element) => (
      <div style={{ maxWidth }}>
        <div className="spotlight-glow-brand-strong rounded-lg p-4">
          <Story />
        </div>
      </div>
    ),
  ]
}

const mobileWidth = { decorators: darkCardDecorators(326) }
const desktopWidth = { decorators: darkCardDecorators(629) }

// 자르는 방식이 모바일/데스크탑 공용(`DESKTOP_CAP=10` + "더보기" 버튼)으로 통일된 뒤로는
// 폰 뷰포트가 크롭 로직에 영향을 주지 않는다 — 다만 실제 폰 프레임에서 카드 밀도가 어떻게
// 보이는지 확인하는 용도로는 여전히 유효해 유지한다.
const phoneViewport = { globals: { viewport: { value: 'iphone12' } } }

const meta = {
  title: 'Composition/Predict/WeekRankCard',
  component: WeekRankCard,
  parameters: {
    viewport: { options: INITIAL_VIEWPORTS },
  },
  args: {
    weekNo: 12,
    entries: mockRanking(16, 4),
  },
} satisfies Meta<typeof WeekRankCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * 폰 폭 — 16명 중 10명까지만 그리고 "더보기 ▾"로 나머지를 편다. 예전에는 모바일만
 * `max-h-[46vh]` 페이드로 잘랐는데, 이제 폭과 무관하게 데스크탑과 같은 캡+버튼 방식 하나다.
 */
export const Mobile: Story = {
  ...mobileWidth,
  ...phoneViewport,
}

/** 위 카드에서 "더보기"를 누른 뒤 — 캡이 풀리고 16명이 다 보인다. 접기는 없다(재마운트 전까지). */
export const MobileExpanded: Story = {
  ...mobileWidth,
  ...phoneViewport,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /더보기/ }))
  },
}

/** 데스크탑 폭 — 모바일과 완전히 같은 로직(10명 캡 + 더보기)이 폭만 넓어진 모습이다. */
export const Desktop: Story = {
  ...desktopWidth,
}

/**
 * 내 순위가 캡(10위) 밖일 때만 나오는 분기 — 10행 뒤에 `⋯` 구분선을 넣고 내 행(14위)을 따로
 * 붙인다. 순위 숫자는 14 그대로다(붙였다고 11위처럼 보이면 안 된다).
 */
export const MyRankBelowCap: Story = {
  ...desktopWidth,
  args: { entries: mockRanking(16, 14) },
}

/**
 * 위 상태에서 펼친 뒤 — `⋯`와 따로 붙인 내 행이 사라지고 14위가 제자리에 한 번만 나온다.
 * 펼침 분기가 `myRowBelow` 계산과 같은 조건을 공유하지 않으면 내 행이 두 번 나오는 회귀가 난다.
 */
export const Expanded: Story = {
  ...desktopWidth,
  args: { entries: mockRanking(16, 14) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /더보기/ }))
  },
}

/**
 * 참여자가 캡보다 적을 때(6명) — "더보기" 버튼이 뜨지 않는다. 주차 초반에 실제로 이 상태를 본다.
 */
export const FewParticipants: Story = {
  ...desktopWidth,
  args: { entries: mockRanking(6, 3) },
}

/**
 * 동점 — 공동 2위 두 명 뒤 순위가 4로 건너뛴다. 컴포넌트는 순위를 계산하지 않고 받은 값을
 * 그대로 그리므로 공동 순위 부여는 쿼리(`week_leaderboard` view) 책임이다. 행의 React key가
 * `userId`라서 순위가 겹쳐도 안전하다([RankingCard](?path=/docs/contents-rankingcard--docs)는
 * key가 `rank`라 동점에서 중복된다 — 같은 데이터로 두 카드를 쓸 때 주의).
 */
export const TiedRanks: Story = {
  ...desktopWidth,
  args: {
    entries: [
      mockEntry({ userId: 'u1', rank: 1, name: '김민준', matchPoints: 3, pickPoints: 12, totalPoints: 15 }),
      mockEntry({ userId: 'u2', rank: 2, name: '이서연', matchPoints: 3, pickPoints: 9, totalPoints: 12 }),
      mockEntry({ userId: 'u3', rank: 2, name: '나', matchPoints: 0, pickPoints: 12, totalPoints: 12, isMe: true }),
      mockEntry({ userId: 'u4', rank: 4, name: '정하윤', matchPoints: 3, pickPoints: 5, totalPoints: 8 }),
    ],
  },
}

/**
 * 로그인하지 않았거나 이 주차에 참여하지 않은 사람이 보는 목록 — `isMe`가 붙은 행이 없으니
 * 강조도, 캡 밖 내 행 보강(`⋯`)도 전부 사라진다. 목록 자체는 정상적으로 다 뜬다.
 */
export const NoMyRow: Story = {
  ...desktopWidth,
  args: { entries: mockRanking(16, 0) },
}

/** 채점 전(빈 배열) — 컬럼 헤더조차 그리지 않고 안내 문구 한 줄만 남는다. */
export const Empty: Story = {
  ...desktopWidth,
  args: { entries: [] },
}

/**
 * `matchPoints`/`pickPoints`가 없는 행 — `RankingRow`에서 이 둘은 주차 랭킹 전용 옵셔널이라
 * 시즌 누적 행(`getSeasonRanking()`)에는 없다. 그런 행을 이 카드에 넘기면 빈칸이 아니라 **0**으로
 * 채워져서(`?? 0`) "0점을 받았다"처럼 읽힌다. 이 카드에는 주차 랭킹 행만 넘겨야 한다는 근거다.
 */
export const MissingColumnPoints: Story = {
  ...desktopWidth,
  args: {
    entries: [
      mockEntry({ userId: 'u1', rank: 1, name: '김민준', matchPoints: undefined, pickPoints: undefined, totalPoints: 56 }),
      mockEntry({ userId: 'u2', rank: 2, name: '이서연', matchPoints: undefined, pickPoints: undefined, totalPoints: 50 }),
    ],
  },
}

/**
 * 아바타 유무 + 긴 닉네임 + 세 자리 점수를 한 번에 — 이름만 `truncate`로 줄고, 순위(`w-8`)와
 * 점수 3컬럼(`w-[42px]`/`w-[42px]`/`w-12`)은 고정폭이라 밀리지 않아야 한다.
 * 세 자리 점수는 주차 단위에선 안 나오지만, 고정폭 컬럼의 여유를 확인하려고 넣었다.
 */
export const LongNamesAndAvatars: Story = {
  ...mobileWidth,
  args: {
    entries: [
      mockEntry({ userId: 'u1', rank: 1, name: '뉴캐슬사랑한다내평생을바쳐서', matchPoints: 3, pickPoints: 128, totalPoints: 131, avatarUrl: PLACEHOLDER_AVATAR }),
      mockEntry({ userId: 'u2', rank: 2, name: '이서연', matchPoints: 3, pickPoints: 12, totalPoints: 15 }),
      mockEntry({ userId: 'u3', rank: 3, name: '나는뉴캐슬의열두번째선수입니다', matchPoints: 0, pickPoints: 9, totalPoints: 9, isMe: true, avatarUrl: PLACEHOLDER_AVATAR }),
    ],
  },
}
