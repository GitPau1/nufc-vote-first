import { createClient } from '@/lib/supabase/server'
import type { PollType, PlayerRow, PollOptionRow } from '@/types/database'
import { IS_MOCK } from '@/lib/config'
import { getRatingGrade, sortPlayersForRating } from '@/lib/polls/rating'
import { mockGetRatingResults } from '@/lib/mock/queries'
import type { PollDetail } from './polls'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = any

export type PollPlayerSeasonStats = {
  appearances: number
  goals: number
  assists: number
}

export type RatingCommentItem = {
  id: string
  player_id: string
  score: number
  grade: string
  comment: string
  created_at: string
  like_count: number
  is_liked: boolean
  user: { display_name: string | null; avatar_url: string | null }
}

export type RatingResultItem = {
  player: PlayerRow
  average_score: number
  grade: string
  vote_count: number
  top_comments: RatingCommentItem[]
}

export async function getRatingParticipantCounts(
  supabase: AnyRow,
  pollIds: string[]
): Promise<Map<string, number>> {
  if (pollIds.length === 0) return new Map()

  // 행 전량을 받아 JS로 세면 PostgREST db-max-rows=1000에 잘린다(참여자 1명이 선수 수만큼 행을 남김).
  // view가 DB에서 count(distinct user_id)까지 끝내므로 응답은 poll당 1행이다.
  const { data, error } = await supabase
    .from('rating_poll_participants')
    .select('poll_id, participant_count')
    .in('poll_id', pollIds) as { data: Array<{ poll_id: string; participant_count: number }> | null; error: AnyRow }

  if (error || !data) return new Map()

  return new Map(data.map(row => [row.poll_id, row.participant_count]))
}

export async function getMyRatingVoteCount(pollId: string, userId: string): Promise<number> {
  if (IS_MOCK) {
    const { cookies } = await import('next/headers')
    const jar = await cookies()
    return jar.get(`mock-rating-vote-${pollId}`)?.value === 'true' ? Number.MAX_SAFE_INTEGER : 0
  }
  const supabase = await createClient()

  const { count } = await supabase
    .from('rating_votes')
    .select('id', { count: 'exact', head: true })
    .eq('poll_id', pollId)
    .eq('user_id', userId) as { count: number | null }

  return count ?? 0
}

export async function getRatingResults(poll: PollDetail, userId: string | null): Promise<RatingResultItem[]> {
  if (IS_MOCK) return mockGetRatingResults(poll.id)
  const supabase = await createClient()
  const targetPlayerIds = poll.poll_options
    .map(option => option.player_id)
    .filter((id): id is string => !!id)

  if (targetPlayerIds.length === 0) return []

  const { data: voteRows } = await supabase
    .from('rating_votes')
    .select(`
      id, target_player_id, user_id, score, comment, created_at,
      user:public_profiles!rating_votes_public_profiles_user_id_fkey(display_name, avatar_url),
      like_count:rating_vote_likes(count)
    `)
    .eq('poll_id', poll.id) as { data: AnyRow[] | null; error: AnyRow }

  const { data: myLikes } = userId
    ? await supabase
      .from('rating_vote_likes')
      .select('rating_vote_id')
      .eq('user_id', userId) as { data: { rating_vote_id: string }[] | null; error: AnyRow }
    : { data: [] }

  const likedIds = new Set((myLikes ?? []).map(row => row.rating_vote_id))
  const votes = voteRows ?? []

  const players = targetPlayerIds
    .map(playerId => poll.option_players?.[playerId] ?? null)
    .filter((player): player is PlayerRow => !!player)

  return sortPlayersForRating(players).map(player => {
    const playerVotes = votes.filter(row => row.target_player_id === player.id)
    const voteCount = playerVotes.length
    const average = voteCount === 0
      ? 0
      : playerVotes.reduce((sum, row) => sum + Number(row.score ?? 0), 0) / voteCount
    const topComments = playerVotes
      .filter(row => String(row.comment ?? '').trim().length > 0)
      .map(row => ({
        id: row.id as string,
        player_id: row.target_player_id as string,
        score: Number(row.score ?? 0),
        grade: getRatingGrade(Number(row.score ?? 0)),
        comment: String(row.comment ?? ''),
        created_at: row.created_at as string,
        like_count: (row.like_count as { count: number }[])?.[0]?.count ?? 0,
        is_liked: likedIds.has(row.id as string),
        user: {
          display_name: row.user?.display_name ?? null,
          avatar_url: row.user?.avatar_url ?? null,
        },
      }))
      .sort((a, b) => b.like_count - a.like_count || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return {
      player,
      average_score: Math.round(average * 10) / 10,
      grade: getRatingGrade(average),
      vote_count: voteCount,
      top_comments: topComments,
    }
  })
}

export async function getCurrentSeasonStatsForOptions(
  supabase: AnyRow,
  pollType: PollType,
  options: PollOptionRow[]
): Promise<Record<string, PollPlayerSeasonStats>> {
  if (pollType !== 'overall_rating') return {}
  const playerIds = options.map(option => option.player_id).filter((id): id is string => !!id)
  if (playerIds.length === 0) return {}

  const { data, error } = await supabase
    .from('player_season_stats')
    .select('player_id, season, appearances, goals, assists')
    .in('player_id', playerIds)
    .order('season', { ascending: false }) as { data: AnyRow[] | null; error: AnyRow }

  if (error || !data) return {}
  return data.reduce<Record<string, PollPlayerSeasonStats>>((acc, row) => {
    if (acc[row.player_id as string]) return acc
    acc[row.player_id as string] = {
      appearances: Number(row.appearances ?? 0),
      goals: Number(row.goals ?? 0),
      assists: Number(row.assists ?? 0),
    }
    return acc
  }, {})
}
