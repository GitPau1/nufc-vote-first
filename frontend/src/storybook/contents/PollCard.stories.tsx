import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { PollCard } from '@/components/composition/polls/PollCard'
import type { PollListItem } from '@/lib/queries/polls'

function mockPoll(overrides: Partial<PollListItem>): PollListItem {
  return {
    id: 'poll-1',
    type: 'poll',
    title: '이번 시즌 최고의 활약을 펼친 선수는?',
    description: null,
    status: 'active',
    thumbnail_url: null,
    closes_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
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

const meta = {
  title: 'Composition/Polls/PollCard',
  component: PollCard,
  parameters: {
    // appDirectory: true가 없으면 내부의 usePathname()이
    // "invariant expected app router to be mounted"로 죽는다.
    nextjs: { appDirectory: true, navigation: { pathname: '/polls' } },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'horizontal: 모바일 리스트 행(썸네일 좌측). vertical: 데스크탑 2~3단 그리드 카드(썸네일 상단).',
    },
  },
  args: {
    variant: 'horizontal',
  },
} satisfies Meta<typeof PollCard>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  args: { poll: mockPoll({ status: 'active' }) },
}

export const ClosingSoon: Story = {
  args: {
    poll: mockPoll({ closes_at: new Date(Date.now() + 5 * 3_600_000).toISOString(), vote_count: 5210 }),
  },
}

export const Closed: Story = {
  args: { poll: mockPoll({ status: 'closed', vote_count: 8421 }) },
}

/** 데스크탑(≥1024px) 3단 그리드에 실제로 배치됐을 때의 모습 — 개별 상태 조합은 위 스토리에서, 여기선 배치 자체를 본다. */
export const VerticalGrid: Story = {
  args: { variant: 'vertical', poll: mockPoll({}) },
  parameters: { controls: { include: [] } },
  render: () => (
    <div className="grid grid-cols-3 gap-4" style={{ maxWidth: 760 }}>
      <PollCard variant="vertical" poll={mockPoll({ status: 'active' })} />
      <PollCard variant="vertical" poll={mockPoll({ closes_at: new Date(Date.now() + 5 * 3_600_000).toISOString() })} />
      <PollCard variant="vertical" poll={mockPoll({ status: 'closed', vote_count: 8421 })} />
    </div>
  ),
}
