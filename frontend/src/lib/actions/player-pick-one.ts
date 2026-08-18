'use server'

import { revalidatePath } from 'next/cache'
import { IS_MOCK } from '@/lib/config'
import { getKstWeekStart } from '@/lib/players/pick-one-rating'

type PickOneChoiceResult =
  | { success: true; remaining: number }
  | { duplicate: true; remaining: number }
  | { error: 'unauthenticated' | 'invalid' | 'not_found' | 'daily_limit' | 'failed'; remaining?: number }

const PICK_ONE_DAILY_CHOICE_LIMIT = 5

function sortPair(leftId: string, rightId: string): [string, string] {
  return leftId < rightId ? [leftId, rightId] : [rightId, leftId]
}

function getKstDayRange(date = new Date()): [Date, Date] {
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstDate = new Date(date.getTime() + kstOffsetMs)
  kstDate.setUTCHours(0, 0, 0, 0)

  const dayStart = new Date(kstDate.getTime() - kstOffsetMs)
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

  return [dayStart, dayEnd]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getDailyChoiceCount(serviceSupabase: any, userId: string) {
  const [dayStart, dayEnd] = getKstDayRange()
  const { count } = await serviceSupabase
    .from('player_pick_one_choices')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', dayStart.toISOString())
    .lt('created_at', dayEnd.toISOString())

  return count ?? 0
}

export async function getPickOneDailyChoiceStatus(): Promise<{ limit: number; remaining: number | null }> {
  if (IS_MOCK) return { limit: PICK_ONE_DAILY_CHOICE_LIMIT, remaining: PICK_ONE_DAILY_CHOICE_LIMIT }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { limit: PICK_ONE_DAILY_CHOICE_LIMIT, remaining: null }

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const count = await getDailyChoiceCount(serviceSupabase, user.id)

  return {
    limit: PICK_ONE_DAILY_CHOICE_LIMIT,
    remaining: Math.max(0, PICK_ONE_DAILY_CHOICE_LIMIT - (count ?? 0)),
  }
}

export async function submitPickOneChoice(
  winnerPlayerId: string,
  loserPlayerId: string,
): Promise<PickOneChoiceResult> {
  if (winnerPlayerId === loserPlayerId) return { error: 'invalid' }

  if (IS_MOCK) {
    return { success: true, remaining: PICK_ONE_DAILY_CHOICE_LIMIT }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: players } = await serviceSupabase
    .from('players')
    .select('id, is_active')
    .in('id', [winnerPlayerId, loserPlayerId])

  if (!players || players.length !== 2 || players.some(player => !player.is_active)) {
    return { error: 'not_found' }
  }

  const count = await getDailyChoiceCount(serviceSupabase, user.id)

  if ((count ?? 0) >= PICK_ONE_DAILY_CHOICE_LIMIT) {
    return { error: 'daily_limit', remaining: 0 }
  }

  const [playerAId, playerBId] = sortPair(winnerPlayerId, loserPlayerId)
  const { error } = await serviceSupabase
    .from('player_pick_one_choices')
    .insert({
      user_id: user.id,
      winner_player_id: winnerPlayerId,
      loser_player_id: loserPlayerId,
      player_a_id: playerAId,
      player_b_id: playerBId,
      week_start_at: getKstWeekStart().toISOString(),
    })

  if (error) {
    if (error.code === '23505') {
      return { duplicate: true, remaining: Math.max(0, PICK_ONE_DAILY_CHOICE_LIMIT - (count ?? 0)) }
    }
    return { error: 'failed' }
  }

  revalidatePath('/players')
  return { success: true, remaining: Math.max(0, PICK_ONE_DAILY_CHOICE_LIMIT - ((count ?? 0) + 1)) }
}
