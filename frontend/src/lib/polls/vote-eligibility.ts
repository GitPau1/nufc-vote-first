import type { PollStatus } from '@/types/database'

export type VoteEligibilityPoll = {
  status: PollStatus
  closes_at: string
}

export function canSubmitVote(poll: VoteEligibilityPoll, now = new Date()): boolean {
  if (poll.status !== 'active') return false
  return new Date(poll.closes_at).getTime() > now.getTime()
}
