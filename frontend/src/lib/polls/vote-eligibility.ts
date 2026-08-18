import type { PollStatus } from '@/types/database'

export type VoteEligibilityPoll = {
  status: PollStatus
  scheduled_at: string | null
  closes_at: string
}

export function canSubmitVote(poll: VoteEligibilityPoll, now = new Date()): boolean {
  if (poll.status !== 'active') return false
  if (poll.scheduled_at && new Date(poll.scheduled_at).getTime() > now.getTime()) return false
  return new Date(poll.closes_at).getTime() > now.getTime()
}

