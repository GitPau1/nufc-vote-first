import type { PollStatus } from '@/types/database'

export type PollStatusInput = {
  status: PollStatus
  scheduled_at?: string | null
  closes_at: string
}

export function getEffectivePollStatus(poll: PollStatusInput, now = new Date()): PollStatus {
  if (new Date(poll.closes_at).getTime() <= now.getTime()) return 'closed'
  if (
    poll.status === 'scheduled' &&
    poll.scheduled_at &&
    new Date(poll.scheduled_at).getTime() <= now.getTime()
  ) {
    return 'active'
  }
  return poll.status
}
