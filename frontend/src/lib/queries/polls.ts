import { unstable_cache } from 'next/cache'
import { createClient, createPublicClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-client'
import type { PollType, PollStatus, PlayerRow, PollOptionRow } from '@/types/database'
import { PAGE_SIZE } from '@/lib/constants'
import { IS_MOCK } from '@/lib/config'
import { getEffectivePollStatus } from '@/lib/polls/status'
import {
  mockGetPollList,
  mockGetPollHomeSections,
  mockGetPollById,
  mockGetVoteCounts,
  mockGetMyVote,
} from '@/lib/mock/queries'
import { getRatingParticipantCounts, getCurrentSeasonStatsForOptions } from './ratings'
import type { PollPlayerSeasonStats } from './ratings'

export { PAGE_SIZE }

export type PollListItem = {
  id: string
  type: PollType
  title: string
  description?: string | null
  status: PollStatus
  thumbnail_url?: string | null
  closes_at: string
  created_at: string
  player_id: string | null
  created_by?: string | null
  creator_name?: string | null
  player: PlayerRow | null
  poll_options: PollOptionRow[]
  vote_count: number
}

export type PollDetail = {
  id: string
  type: PollType
  title: string
  description: string | null
  status: PollStatus
  thumbnail_url?: string | null
  created_at?: string | null
  closes_at: string
  player_id: string | null
  created_by?: string | null
  creator_name?: string | null
  player: PlayerRow | null
  poll_options: PollOptionRow[]
  option_players?: Record<string, PlayerRow>
  current_season_stats?: Record<string, PollPlayerSeasonStats>
}

export type VoteCountMap = Record<string, number>
export type PollFormPlayer = Pick<PlayerRow, 'id' | 'name' | 'position' | 'squad_number' | 'photo_url' | 'is_active' | 'squad_status'>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any

/**
 * 일반 투표(overall_rating 제외)의 poll별 총 투표 수를 센다.
 *
 * votes는 본인 행만 RLS로 열려 있어(votes: select own) 목록에 쓰는 anon 세션(createPublicClient)으로
 * 임베드 집계(votes(count))를 하면 방문자 본인 표만 세어 대부분 0이 나온다. 선택지별 전체 집계
 * (getVoteCounts)와 같은 이유로 service_role로 서버에서만 읽는다 — 교차조회를 anon에 노출하지 않는다.
 */
async function getPollVoteCounts(pollIds: string[]): Promise<Map<string, number>> {
  if (pollIds.length === 0) return new Map()

  const supabase = await getServiceRoleClient()

  const { data, error } = await supabase
    .from('polls')
    .select('id, vote_count:votes(count)')
    .in('id', pollIds) as { data: { id: string; vote_count: { count: number }[] }[] | null; error: AnyRow }

  if (error || !data) return new Map()

  return new Map(data.map(row => [row.id, row.vote_count?.[0]?.count ?? 0]))
}

function normalizePlayer(player: PlayerRow | null): PlayerRow | null {
  if (!player) return null
  return {
    ...player,
    squad_status: player.squad_status ?? 'first_team',
  }
}

async function getCreatorNamesById(ids: string[]): Promise<Map<string, string>> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (uniqueIds.length === 0) return new Map()

  const supabase = await getServiceRoleClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, display_name')
    .in('id', uniqueIds) as { data: Array<{ id: string; display_name: string | null }> | null; error: AnyRow }

  if (error || !data) return new Map()

  return new Map(
    data.map(user => [user.id, user.display_name ?? '이름 없는 사용자'])
  )
}

export async function getPollFormPlayers(): Promise<PollFormPlayer[]> {
  if (IS_MOCK) {
    const { MOCK_PLAYERS } = await import('@/lib/mock/data')
    return MOCK_PLAYERS
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('players')
    .select('id, name, position, squad_number, photo_url, is_active, squad_status')
    .eq('is_active', true)
    .order('squad_number', { ascending: true }) as { data: AnyRow[] | null; error: AnyRow }

  if (error) {
    console.error('getPollFormPlayers error:', error)
    return []
  }

  return (data ?? []).map((player: AnyRow) => ({
    id: player.id as string,
    name: player.name as string,
    position: player.position as PlayerRow['position'],
    squad_number: player.squad_number as number | null,
    photo_url: player.photo_url as string | null,
    is_active: player.is_active as boolean,
    squad_status: (player.squad_status ?? 'first_team') as PlayerRow['squad_status'],
  }))
}

// vote_count는 여기 임베드하지 않는다 — votes RLS(본인 행 전용)로 anon 목록 세션에선 0이 되기 때문.
// poll별 총계는 mapPollRows에서 service_role로 getPollVoteCounts가 따로 센다.
const POLL_LIST_SELECT = `
  id, type, title, description, status, thumbnail_url, closes_at, created_at, player_id, created_by,
  player:players(id, name, position, squad_number, photo_url, is_active, squad_status),
  poll_options(id, poll_id, label, description, player_id, image_url, display_order, created_at)
`

/** poll row → PollListItem 매핑. creator_name·overall_rating 참여자 수 조회까지 여기서 같이 한다. */
async function mapPollRows(
  rows: AnyRow[],
  supabase: ReturnType<typeof createPublicClient>,
  now: Date,
): Promise<PollListItem[]> {
  const overallRatingPollIds = rows
    .filter((row: AnyRow) => row.type === 'overall_rating')
    .map((row: AnyRow) => row.id as string)
  const regularPollIds = rows
    .filter((row: AnyRow) => row.type !== 'overall_rating')
    .map((row: AnyRow) => row.id as string)
  const [creatorNames, ratingParticipantCounts, regularVoteCounts] = await Promise.all([
    getCreatorNamesById(rows.map((row: AnyRow) => row.created_by as string)),
    getRatingParticipantCounts(supabase, overallRatingPollIds),
    getPollVoteCounts(regularPollIds),
  ])

  return rows.map((row: AnyRow) => ({
    id: row.id as string,
    type: row.type as PollType,
    title: row.title as string,
    description: row.description as string | null,
    status: getEffectivePollStatus({
      status: row.status as PollStatus,
      closes_at: row.closes_at as string,
    }, now),
    thumbnail_url: row.thumbnail_url as string | null,
    closes_at: row.closes_at as string,
    created_at: row.created_at as string,
    player_id: row.player_id as string | null,
    created_by: row.created_by as string | null,
    creator_name: creatorNames.get(row.created_by as string) ?? null,
    player: normalizePlayer(row.player as PlayerRow | null),
    poll_options: (row.poll_options as PollOptionRow[]) ?? [],
    vote_count: row.type === 'overall_rating'
      ? ratingParticipantCounts.get(row.id as string) ?? 0
      : regularVoteCounts.get(row.id as string) ?? 0,
  }))
}

async function getPollListUncached(page = 0): Promise<PollListItem[]> {
  if (IS_MOCK) return mockGetPollList(page)
  const supabase = createPublicClient()
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data, error } = await supabase
    .from('polls')
    .select(POLL_LIST_SELECT)
    .order('created_at', { ascending: false })
    .range(from, to) as { data: AnyRow[] | null; error: AnyRow }

  if (error) {
    console.error('getPollList error:', error)
    return []
  }

  return mapPollRows(data ?? [], supabase, new Date())
}

export const getPollList = unstable_cache(getPollListUncached, ['public-poll-list'], {
  revalidate: 30,
})

export type PollHomeSections = {
  active: PollListItem[]
  closed: PollListItem[]
}

// 홈 화면 캐러셀 2종(진행중/종료) 당 최대로 보여줄 개수. 캐러셀은 "미리보기"라 전량을
// 다 보여줄 필요가 없다 — 전체는 /polls의 전체보기로 간다.
const HOME_SECTION_ITEM_LIMIT = 8
// 위 3개 버킷을 나누기 위해 최근 생성된 투표를 얼마나 훑을지. 너무 오래된 종료 투표까지
// 캐러셀에 실을 필요는 없어서 무제한 조회 대신 최근 N개로 제한한다.
const HOME_SECTION_FETCH_LIMIT = 60

async function getPollHomeSectionsUncached(): Promise<PollHomeSections> {
  if (IS_MOCK) return mockGetPollHomeSections()
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('polls')
    .select(POLL_LIST_SELECT)
    .order('created_at', { ascending: false })
    .limit(HOME_SECTION_FETCH_LIMIT) as { data: AnyRow[] | null; error: AnyRow }

  if (error) {
    console.error('getPollHomeSections error:', error)
    return { active: [], closed: [] }
  }

  const polls = await mapPollRows(data ?? [], supabase, new Date())
  return bucketPollsByStatus(polls)
}

/** effective status 기준으로 진행중/종료로 나누고, 섹션별로 의미 있는 순서로 정렬·상한을 적용한다. */
function bucketPollsByStatus(polls: PollListItem[]): PollHomeSections {
  const active: PollListItem[] = []
  const closed: PollListItem[] = []

  for (const poll of polls) {
    if (poll.status === 'active') active.push(poll)
    else closed.push(poll)
  }

  // 진행중: 마감 임박한 것부터 — 지금 참여를 유도해야 하는 우선순위.
  active.sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime())
  // 종료: 최근에 끝난 것부터.
  closed.sort((a, b) => new Date(b.closes_at).getTime() - new Date(a.closes_at).getTime())

  return {
    active: active.slice(0, HOME_SECTION_ITEM_LIMIT),
    closed: closed.slice(0, HOME_SECTION_ITEM_LIMIT),
  }
}

export const getPollHomeSections = unstable_cache(getPollHomeSectionsUncached, ['public-poll-home-sections'], {
  revalidate: 30,
})

export async function getPollById(id: string): Promise<PollDetail | null> {
  if (IS_MOCK) return mockGetPollById(id)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('polls')
    .select(`
      id, type, title, description, status, thumbnail_url, created_at, closes_at, player_id, created_by,
      player:players(id, name, position, squad_number, photo_url, is_active, squad_status),
      poll_options(id, poll_id, label, description, player_id, image_url, display_order, created_at,
        option_player:players(id, name, position, squad_number, photo_url, is_active, squad_status))
    `)
    .eq('id', id)
    .single() as { data: AnyRow | null; error: AnyRow }

  if (error || !data) return null

  const options: PollOptionRow[] = ((data.poll_options as AnyRow[]) ?? [])
    .sort((a: AnyRow, b: AnyRow) => a.display_order - b.display_order)

  const option_players: Record<string, PlayerRow> = {}
  for (const opt of (data.poll_options as AnyRow[]) ?? []) {
    if (opt.player_id && opt.option_player) {
      option_players[opt.player_id] = normalizePlayer(opt.option_player as PlayerRow) as PlayerRow
    }
  }

  const creatorNames = await getCreatorNamesById(data.created_by ? [data.created_by as string] : [])
  const currentSeasonStats = await getCurrentSeasonStatsForOptions(
    supabase,
    data.type as PollType,
    options
  )

  return {
    id: data.id as string,
    type: data.type as PollType,
    title: data.title as string,
    description: data.description as string | null,
    status: getEffectivePollStatus({
      status: data.status as PollStatus,
      closes_at: data.closes_at as string,
    }),
    thumbnail_url: data.thumbnail_url as string | null,
    created_at: data.created_at as string | null,
    closes_at: data.closes_at as string,
    player_id: data.player_id as string | null,
    created_by: data.created_by as string | null,
    creator_name: creatorNames.get(data.created_by as string) ?? null,
    player: normalizePlayer(data.player as PlayerRow | null),
    poll_options: options,
    ...(Object.keys(option_players).length > 0 && { option_players }),
    ...(Object.keys(currentSeasonStats).length > 0 && { current_season_stats: currentSeasonStats }),
  }
}

export async function getVoteCounts(pollId: string): Promise<VoteCountMap> {
  if (IS_MOCK) return mockGetVoteCounts(pollId)

  // votes는 본인 행만 RLS로 열려 있어(votes: select own) 사용자 세션 클라이언트로는
  // 집계가 본인 표만 세게 된다. 선택지별 전체 집계는 service_role로 서버에서만 읽는다.
  const supabase = await getServiceRoleClient()

  // 행을 다 끌어와 JS로 세면 PostgREST db-max-rows(1,000)에 조용히 잘린다 — 에러 없이 틀린 숫자가 나온다.
  // DB가 세서 숫자만 받는다. votes↔poll_options FK가 두 개(option_id / option_matches_poll)라 힌트가 필요하다.
  const { data, error } = await supabase
    .from('poll_options')
    .select('id, vote_count:votes!votes_option_id_fkey(count)')
    .eq('poll_id', pollId) as { data: { id: string; vote_count: { count: number }[] }[] | null; error: AnyRow }

  if (error || !data) return {}

  return data.reduce<VoteCountMap>((acc, row) => {
    acc[row.id] = row.vote_count?.[0]?.count ?? 0
    return acc
  }, {})
}

export async function getMyVote(pollId: string, userId: string): Promise<string | null> {
  if (IS_MOCK) return mockGetMyVote(pollId, userId)
  const supabase = await createClient()

  const { data } = await supabase
    .from('votes')
    .select('option_id')
    .eq('poll_id', pollId)
    .eq('user_id', userId)
    .single() as { data: { option_id: string } | null; error: AnyRow }

  return data?.option_id ?? null
}

