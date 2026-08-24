import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { PollHomeSection } from '@/components/polls/PollHomeSection'
import type { PollListItem } from '@/lib/queries/polls'

function mockPoll(overrides: Partial<PollListItem>): PollListItem {
  return {
    id: 'poll-1',
    type: 'selection',
    title: '이번 시즌 최고의 활약을 펼친 선수는?',
    description: null,
    status: 'active',
    thumbnail_url: null,
    closes_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    scheduled_at: null,
    created_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    player_id: null,
    created_by: null,
    creator_name: null,
    player: null,
    poll_options: [
      { id: 'o1', poll_id: 'poll-1', label: '손흥민', description: null, player_id: null, image_url: null, display_order: 0, created_at: '' },
      { id: 'o2', poll_id: 'poll-1', label: '케빈 데 브라위너', description: null, player_id: null, image_url: null, display_order: 1, created_at: '' },
    ],
    vote_count: 1234,
    ...overrides,
  }
}

// 5개 = 모바일 첫 페이지(3개) 밖으로 넘치고, 데스크탑 3단에서도 2페이지가 되는 최소 개수 —
// "더보기" 버튼과 좌우 페이지 버튼이 둘 다 나타나는 상태를 한 번에 본다.
const FIVE_POLLS: PollListItem[] = [
  mockPoll({ id: 'p1', title: '이번 시즌 최고의 활약을 펼친 선수는?' }),
  mockPoll({ id: 'p2', title: '리버풀전 최우수 선수를 뽑아주세요', vote_count: 842 }),
  mockPoll({ id: 'p3', title: '겨울 이적시장에서 가장 필요한 포지션은?', vote_count: 2310 }),
  mockPoll({ id: 'p4', title: '다음 경기 예상 스코어', vote_count: 129 }),
  mockPoll({ id: 'p5', title: '올 시즌 목표 순위는 어디까지일까', vote_count: 77 }),
]

const meta = {
  title: 'Contents/PollHomeSection',
  component: PollHomeSection,
  parameters: {
    // 내부 PollCard가 usePathname()/next/link를 쓴다 — appDirectory: true가 없으면
    // "invariant expected app router to be mounted"로 죽는다.
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
    // 이 컴포넌트의 핵심이 sm 브레이크포인트에서 리스트↔그리드로 갈리는 것이라,
    // 뷰포트를 실제로 좁혀봐야 두 레이아웃을 확인할 수 있다.
    viewport: { options: INITIAL_VIEWPORTS },
  },
  args: {
    title: '진행 중인 투표',
    polls: FIVE_POLLS,
  },
} satisfies Meta<typeof PollHomeSection>

export default meta
type Story = StoryObj<typeof meta>

/** 기본(넓은 캔버스) — 데스크탑 3단 그리드에 한 줄만, 우측에 페이지 넘김 버튼. */
export const Default: Story = {}

/** action을 주면 제목 우측에 이동 링크가 붙는다. 홈에서는 "종료된 투표" 섹션만 이걸 쓴다(→ `/polls`). */
export const WithAction: Story = {
  args: {
    title: '종료된 투표',
    polls: FIVE_POLLS.map(poll => ({ ...poll, status: 'closed' as const })),
    action: { label: '전체보기', href: '/polls' },
  },
}

/**
 * 페이지가 하나뿐인 경우(3단 기준 3개 이하) — 좌우 페이지 버튼 자체가 렌더되지 않는다.
 * 넘길 곳이 없는데 disabled 버튼만 남는 회귀를 막기 위한 스토리.
 */
export const SinglePage: Story = {
  args: { polls: FIVE_POLLS.slice(0, 3) },
}

/**
 * 빈 목록 — 컴포넌트가 `null`을 반환해 섹션(제목 포함)이 통째로 사라진다.
 * "예정된 투표가 없으면 그 섹션이 안 보여야 한다"는 요구사항이라 빈 상태 문구도 없다.
 * 위아래 회색 문구는 스토리에서만 붙인 표식이고, 그 사이가 비어 있는 것이 정답이다.
 */
export const Empty: Story = {
  args: { title: '예정된 투표', polls: [] },
  render: (args) => (
    <div className="flex flex-col gap-2">
      <p className="text-caption-1 text-neutral-muted">--- 위쪽 섹션 ---</p>
      <PollHomeSection {...args} />
      <p className="text-caption-1 text-neutral-muted">--- 아래쪽 섹션 ---</p>
    </div>
  ),
}

/**
 * 모바일(sm 미만) — 그리드가 아니라 하나의 surface 카드로 감싼 세로 리스트(horizontal 카드 + divide-y).
 * 처음 3개만 보이고 나머지는 "더보기"로 3개씩 늘어난다(스와이프·무한스크롤 아님).
 */
export const Mobile: Story = {
  globals: { viewport: { value: 'iphone12' } },
}

/**
 * 태블릿 폭(≥640px, <1024px) — 2단 그리드. 열 수가 줄면 한 줄에 2개만 들어가므로
 * 같은 5개 목록의 페이지 수가 2 → 3으로 늘어난다(열 수를 matchMedia로 직접 읽는 부분).
 */
export const TabletTwoColumn: Story = {
  globals: { viewport: { value: 'ipad' } },
}
