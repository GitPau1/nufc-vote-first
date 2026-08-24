import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { TypeBPollClient } from '@/components/composition/polls/TypeBPollClient'
import type { PollDetail } from '@/lib/queries/polls'

const poll: PollDetail = {
  id: 'poll-b1',
  type: 'selection',
  title: '이번 주 최고의 활약을 펼친 선수는?',
  description: null,
  status: 'active',
  thumbnail_url: null,
  closes_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  scheduled_at: null,
  created_at: new Date().toISOString(),
  player_id: null,
  created_by: null,
  creator_name: null,
  player: null,
  poll_options: [
    { id: 'o1', poll_id: 'poll-b1', label: '손흥민', description: null, player_id: 'p1', image_url: null, display_order: 0, created_at: '' },
    { id: 'o2', poll_id: 'poll-b1', label: '케빈 데 브라위너', description: null, player_id: 'p2', image_url: null, display_order: 1, created_at: '' },
    { id: 'o3', poll_id: 'poll-b1', label: '엘링 홀란드', description: null, player_id: 'p3', image_url: null, display_order: 2, created_at: '' },
  ],
  option_players: {
    p1: { id: 'p1', name: '손흥민', position: 'FWD', squad_number: 7, photo_url: null, is_active: true, squad_status: 'active' } as never,
    p2: { id: 'p2', name: '케빈 데 브라위너', position: 'MID', squad_number: 17, photo_url: null, is_active: true, squad_status: 'active' } as never,
    p3: { id: 'p3', name: '엘링 홀란드', position: 'FWD', squad_number: 9, photo_url: null, is_active: true, squad_status: 'active' } as never,
  },
}

const meta = {
  title: 'Contents/PollCarouselCard',
  component: TypeBPollClient,
  parameters: {
    // appDirectory: true가 없으면 내부의 useRouter()가
    // "invariant expected app router to be mounted"로 죽는다.
    nextjs: { appDirectory: true, navigation: { pathname: `/polls/${poll.id}` } },
  },
} satisfies Meta<typeof TypeBPollClient>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { poll, isAuthenticated: true },
}
