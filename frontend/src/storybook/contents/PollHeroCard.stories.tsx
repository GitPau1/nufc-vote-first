import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { PollHeroCard } from '@/components/composition/polls/PollHeroCard'
import type { PollListItem } from '@/lib/queries/polls'

const HERO_IMAGE = 'https://placehold.co/716x504/0c2340/41b6e6?text=St+James+Park'

function mockPoll(overrides: Partial<PollListItem>): PollListItem {
  return {
    id: 'poll-1',
    type: 'poll',
    title: '이번 시즌 최고의 활약을 펼친 선수는?',
    description: null,
    status: 'active',
    thumbnail_url: HERO_IMAGE,
    closes_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    created_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    player_id: null,
    created_by: null,
    creator_name: null,
    player: null,
    poll_options: [
      { id: 'o1', poll_id: 'poll-1', label: '알렉산더 이삭', description: null, player_id: null, image_url: null, display_order: 0, created_at: '' },
      { id: 'o2', poll_id: 'poll-1', label: '브루노 기마랑이스', description: null, player_id: null, image_url: null, display_order: 1, created_at: '' },
    ],
    vote_count: 1234,
    ...overrides,
  }
}

// 홈/투표 목록 최상단 히어로 자리에 폭 전체로 한 장만 놓이는 카드라,
// 데스크탑 와이드 캔버스에 그냥 두면 252px 고정 높이 대비 가로가 너무 길어져 실제와 다르게 보인다.
const mobileWidth = { decorators: [(Story: () => React.JSX.Element) => <div style={{ maxWidth: 358 }}><Story /></div>] }

const meta = {
  title: 'Composition/Polls/PollHeroCard',
  component: PollHeroCard,
  parameters: {
    // appDirectory: true가 없으면 내부의 usePathname()이
    // "invariant expected app router to be mounted"로 죽는다.
    nextjs: { appDirectory: true, navigation: { pathname: '/' } },
  },
} satisfies Meta<typeof PollHeroCard>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  ...mobileWidth,
  args: { poll: mockPoll({}) },
}

/**
 * 마감이 지났는데 아직 status가 active인 경우 — 뱃지 문구만 "마감 임박"으로 바뀐다.
 * PollCard와 달리 여기엔 긴급 톤(destructive)이 없고 뱃지 색은 항상 `bg-brand-solid/55`다.
 * D-1처럼 하루 남은 상태도 문구만 다르고 색은 같으므로 따로 스토리를 두지 않았다.
 */
export const ClosingSoon: Story = {
  ...mobileWidth,
  args: {
    poll: mockPoll({
      closes_at: new Date(Date.now() - 60_000).toISOString(),
      vote_count: 5210,
    }),
  },
}

/** 종료된 투표가 히어로에 올라오는 경우(진행중이 하나도 없을 때) — 뱃지가 "종료됨". 흐림/흑백 처리는 없다. */
export const Closed: Story = {
  ...mobileWidth,
  args: { poll: mockPoll({ status: 'closed', vote_count: 8421 }) },
}

/** 설명이 있으면 제목 아래 한 줄이 더 붙는다 — 오버레이 그라데이션 안에 3줄이 들어가도 안 눌리는지 본다. */
export const WithDescription: Story = {
  ...mobileWidth,
  args: {
    poll: mockPoll({
      description: '9월 A매치 이전까지의 활약만 기준으로 합니다',
    }),
  },
}

/**
 * 썸네일이 없는 투표 — `getThumbnailUrl`이 선수 사진 → 선택지 이미지 → 96x96 플레이스홀더 순으로 대체한다.
 * 즉 히어로(252px 높이)에도 목록 썸네일용 96px 이미지가 그대로 확대돼 들어간다.
 */
export const NoThumbnail: Story = {
  ...mobileWidth,
  args: { poll: mockPoll({ thumbnail_url: null }) },
}

/** 제목이 길면 2줄로 넘어가지 않고 `truncate`로 한 줄에서 잘린다 — 히어로에서 제목이 통째로 안 보일 수 있는 지점. */
export const LongTitle: Story = {
  ...mobileWidth,
  args: {
    poll: mockPoll({
      title: '2025-26 시즌 프리미어리그 전반기 뉴캐슬 유나이티드 최우수 선수는 누구라고 생각하시나요?',
      description: '설명도 마찬가지로 한 줄에서 잘린다 — 긴 설명을 히어로에 기대하지 말 것',
    }),
  },
}
