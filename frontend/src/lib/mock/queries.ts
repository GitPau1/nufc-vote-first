/**
 * Supabase 없이 동작하는 목 쿼리 구현.
 * IS_MOCK === true 일 때 queries/polls.ts / queries/comments.ts에서 이 함수들을 사용한다.
 */
import { PAGE_SIZE } from '@/lib/constants'
import { getEffectivePollStatus } from '@/lib/polls/status'
import type { PollDetail, PollListItem, VoteCountMap } from '@/lib/queries/polls'
import type { CommentItem } from '@/lib/queries/comments'
import {
  MOCK_POLL_LIST,
  MOCK_POLL_DETAIL,
  MOCK_VOTE_COUNTS,
  MOCK_COMMENTS,
} from './data'

export async function mockGetPollList(page: number): Promise<PollListItem[]> {
  const from = page * PAGE_SIZE
  const now = new Date()
  return MOCK_POLL_LIST.slice(from, from + PAGE_SIZE).map(poll => ({
    ...poll,
    status: getEffectivePollStatus(poll, now),
  }))
}

export async function mockGetPollById(id: string): Promise<PollDetail | null> {
  const poll = MOCK_POLL_DETAIL[id]
  if (!poll) return null
  return {
    ...poll,
    status: getEffectivePollStatus(poll),
  }
}

export async function mockGetVoteCounts(pollId: string): Promise<VoteCountMap> {
  return MOCK_VOTE_COUNTS[pollId] ?? {}
}

/** 목 모드: mock-vote-{pollId} 쿠키에서 투표 이력 조회 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function mockGetMyVote(pollId: string, _userId: string): Promise<string | null> {
  const { cookies } = await import('next/headers')
  const jar = await cookies()
  return jar.get(`mock-vote-${pollId}`)?.value ?? null
}

/** 목 모드 댓글 조회 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function mockGetComments(pollId: string, userId: string | null): Promise<CommentItem[]> {
  return (MOCK_COMMENTS[pollId] ?? []) as CommentItem[]
}
