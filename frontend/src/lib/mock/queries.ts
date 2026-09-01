/**
 * Supabase 없이 동작하는 목 쿼리 구현.
 * IS_MOCK === true 일 때 queries/polls.ts / queries/comments.ts에서 이 함수들을 사용한다.
 */
import { PAGE_SIZE } from '@/lib/constants'
import { getEffectivePollStatus } from '@/lib/polls/status'
import type { PollDetail, PollHomeSections, PollListItem, VoteCountMap, RatingResultItem } from '@/lib/queries/polls'
import type { CommentItem } from '@/lib/queries/comments'
import type { MatchdayFixture } from '@/lib/queries/fixtures'
import { toKst, weekKey } from '@/lib/predictions/week'
import {
  MOCK_POLL_LIST,
  MOCK_POLL_DETAIL,
  MOCK_VOTE_COUNTS,
  MOCK_COMMENTS,
  MOCK_RATING_RESULTS,
} from './data'

export async function mockGetPollList(page: number): Promise<PollListItem[]> {
  const from = page * PAGE_SIZE
  const now = new Date()
  return MOCK_POLL_LIST.slice(from, from + PAGE_SIZE).map(poll => ({
    ...poll,
    status: getEffectivePollStatus(poll, now),
  }))
}

// queries/polls.ts의 HOME_SECTION_ITEM_LIMIT/bucketPollsByStatus와 같은 규칙 —
// 순환 참조(mock/queries.ts ↔ queries/polls.ts)를 피하려고 여기서 따로 구현한다.
const HOME_SECTION_ITEM_LIMIT = 8

export async function mockGetPollHomeSections(): Promise<PollHomeSections> {
  const now = new Date()
  const polls = MOCK_POLL_LIST.map(poll => ({ ...poll, status: getEffectivePollStatus(poll, now) }))

  const active = polls.filter(p => p.status === 'active')
    .sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime())
  const scheduled = polls.filter(p => p.status === 'scheduled')
    .sort((a, b) => {
      const aAt = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity
      const bAt = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity
      return aAt - bAt
    })
  const closed = polls.filter(p => p.status === 'closed')
    .sort((a, b) => new Date(b.closes_at).getTime() - new Date(a.closes_at).getTime())

  return {
    active: active.slice(0, HOME_SECTION_ITEM_LIMIT),
    scheduled: scheduled.slice(0, HOME_SECTION_ITEM_LIMIT),
    closed: closed.slice(0, HOME_SECTION_ITEM_LIMIT),
  }
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

/** 목 모드 전체평점 결과 조회. 실제 제출 점수는 저장하지 않으므로(mock-rating-vote-{pollId}
 *  쿠키만 남긴다) 항상 고정된 값을 돌려준다 — evaluation/selection의 결과 화면과 같은 방식. */
export async function mockGetRatingResults(pollId: string): Promise<RatingResultItem[]> {
  return MOCK_RATING_RESULTS[pollId] ?? []
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

/** 목 모드: 항상 "2시간 40분 뒤 킥오프"인 예정 경기를 하나 만들어 보여준다 — 날짜를 고정하면
 *  시간이 지날수록 "이미 지난 경기"처럼 보이므로 매 호출마다 지금 시각 기준으로 계산한다. */
export async function mockGetHomeMatchdayFixture(): Promise<MatchdayFixture> {
  const kickoffAt = new Date(Date.now() + 2 * 3_600_000 + 40 * 60_000).toISOString()
  return {
    fixtureId: 0,
    competitionName: '프리미어리그',
    kickoffAt,
    homeId: 10261,
    homeName: '뉴캐슬',
    awayId: 8650,
    awayName: '리버풀',
    homeScore: null,
    awayScore: null,
    weekKey: weekKey(toKst(kickoffAt)),
    topDefender: null,
    topMidfielder: null,
    topForward: null,
    scoreStr: null,
    shootoutScore: null,
    started: false,
    finished: false,
  }
}
