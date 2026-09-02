/**
 * Supabase 없이 동작하는 목 쿼리 구현.
 * IS_MOCK === true 일 때 queries/polls.ts / queries/comments.ts에서 이 함수들을 사용한다.
 */
import { PAGE_SIZE } from '@/lib/constants'
import { getEffectivePollStatus } from '@/lib/polls/status'
import { resolvePollEditUpdate, type PollEditPoll } from '@/lib/polls/poll-edit-eligibility'
import type { PollDetail, PollHomeSections, PollListItem, VoteCountMap, RatingResultItem } from '@/lib/queries/polls'
import type { CommentItem } from '@/lib/queries/comments'
import type { FixturePositionTop3, MatchdayFixture } from '@/lib/queries/fixtures'
import { toKst, weekKey } from '@/lib/predictions/week'
import { isPickPosition, playerPhotoUrl, type Position } from '@/lib/predictions/candidates'
import {
  MOCK_POLL_LIST,
  MOCK_POLL_DETAIL,
  MOCK_VOTE_COUNTS,
  MOCK_COMMENTS,
  MOCK_RATING_RESULTS,
  MOCK_FIXTURE_RATINGS,
  MOCK_SQUAD,
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

/** 목 모드: 실제 DB에 쓰지 않지만(mock은 원래 상태가 없다, createUserPoll도 mock이면
 *  고정 pollId만 반환) 권한 검사만은 실제로 통과/실패가 갈리게 한다. */
export async function mockUpdatePoll(pollId: string, formData: FormData): Promise<{ success?: true; error?: string }> {
  const poll = MOCK_POLL_DETAIL[pollId]
  if (!poll) return { error: '투표를 찾을 수 없습니다.' }

  const { getHeaderAuth } = await import('@/lib/actions/auth')
  const auth = await getHeaderAuth()

  const editPoll: PollEditPoll = {
    status: poll.status,
    scheduled_at: poll.scheduled_at ?? null,
    closes_at: poll.closes_at,
    created_by: poll.created_by ?? null,
  }

  // updateUserPoll(lib/actions/polls.ts)과 같은 공통 검증 함수 — 권한 확인 → payload 구성 →
  // 상태별 허용 필드 검사 → 제목 필수 검사. mock은 실제로 저장하지 않으므로 payload는 안 쓴다.
  const resolved = resolvePollEditUpdate(
    editPoll,
    { userId: auth?.userId ?? null, isAdmin: auth?.isAdmin ?? false },
    {
      title: formData.has('title') ? String(formData.get('title') ?? '') : undefined,
      description: formData.has('description') ? String(formData.get('description') ?? '') : undefined,
      thumbnail_url: formData.has('thumbnail_url') ? String(formData.get('thumbnail_url') ?? '') : undefined,
    }
  )
  if (!resolved.ok) return { error: resolved.error }

  return { success: true }
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

/**
 * 목 모드: 포지션별 평점 상위 3명. `MOCK_FIXTURE_RATINGS`(fixture_player_ratings와 같은 모양)를
 * `MOCK_SQUAD`(season_squads와 같은 모양)와 조인해 실제 조회(getFixturePositionTop3)와 같은
 * 순서(평점 내림차순 → 포지션별 상위 3명)로 만든다.
 */
export async function mockGetFixturePositionTop3(fixtureId: number): Promise<FixturePositionTop3> {
  const ratings = MOCK_FIXTURE_RATINGS[String(fixtureId)] ?? []
  if (ratings.length === 0) return { DEF: [], MID: [], FWD: [] }

  const squadById = new Map(MOCK_SQUAD.map(squad => [squad.fotmob_player_id, squad]))

  const rated = ratings
    .slice()
    .sort((a, b) => b.rating - a.rating)
    .flatMap(r => {
      const squad = squadById.get(r.playerId)
      if (!squad || !isPickPosition(squad.position)) return []
      return [
        {
          playerId: r.playerId,
          name: squad.name_ko?.trim() || squad.name,
          rating: r.rating,
          photoUrl: playerPhotoUrl(r.playerId),
          position: squad.position,
        },
      ]
    })

  const topNOf = (position: Position) => rated.filter(p => p.position === position).slice(0, 3)

  return {
    DEF: topNOf('DEF'),
    MID: topNOf('MID'),
    FWD: topNOf('FWD'),
  }
}
