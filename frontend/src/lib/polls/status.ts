import type { PollStatus } from '@/types/database'

export type PollStatusInput = {
  status: PollStatus
  closes_at: string
}

export function getEffectivePollStatus(poll: PollStatusInput, now = new Date()): PollStatus {
  if (new Date(poll.closes_at).getTime() <= now.getTime()) return 'closed'
  return poll.status
}
