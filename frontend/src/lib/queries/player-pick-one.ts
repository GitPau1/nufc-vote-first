import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'

export type PickOneRatingChangeItem = {
  playerId: string
  playerName: string
  position: string
  photoUrl: string | null
  previousOverall: number
  newOverall: number
  delta: number
  wins: number
  losses: number
}

export type PickOneRatingChangeWeek = {
  weekStartAt: string
  weekEndAt: string
  appliedAt: string | null
  changes: PickOneRatingChangeItem[]
}

async function getLatestPickOneRatingChangesUncached(): Promise<PickOneRatingChangeWeek | null> {
  if (IS_MOCK) return null

  const supabase = createPublicClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: run } = await db
    .from('player_pick_one_weekly_runs')
    .select('id, week_start_at, week_end_at, applied_at')
    .eq('status', 'applied')
    .order('week_end_at', { ascending: false })
    .limit(1)
    .single()

  if (!run) return null

  const { data: changes } = await db
    .from('player_pick_one_rating_changes')
    .select(`
      player_id,
      previous_overall,
      new_overall,
      delta,
      wins,
      losses,
      player:players(name, position, photo_url)
    `)
    .eq('run_id', run.id)
    .order('delta', { ascending: false })

  return {
    weekStartAt: run.week_start_at,
    weekEndAt: run.week_end_at,
    appliedAt: run.applied_at,
    changes: ((changes ?? []) as Array<{
      player_id: string
      previous_overall: number
      new_overall: number
      delta: number
      wins: number
      losses: number
      player: { name: string; position: string; photo_url: string | null } | null
    }>).map(change => ({
      playerId: change.player_id,
      playerName: change.player?.name ?? '알 수 없는 선수',
      position: change.player?.position ?? 'MGR',
      photoUrl: change.player?.photo_url ?? null,
      previousOverall: change.previous_overall,
      newOverall: change.new_overall,
      delta: change.delta,
      wins: change.wins,
      losses: change.losses,
    })),
  }
}

export const getLatestPickOneRatingChanges = unstable_cache(
  getLatestPickOneRatingChangesUncached,
  ['public-player-pick-one-rating-changes'],
  {
    revalidate: 300,
    tags: ['player-pick-one-rating-changes'],
  },
)
