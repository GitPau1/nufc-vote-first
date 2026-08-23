import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import { groupFixturesByWeek, type FixtureRow, type WeekGroup } from '@/lib/predictions/week'

export type { WeekGroup }

const FIXTURE_COLUMNS =
  'fixture_id, competition_name, kickoff_at, home_id, home_name, home_score, away_id, away_name, away_score, started, finished, cancelled'

async function getFixtureWeeksUncached(): Promise<WeekGroup[]> {
  const now = Date.now()

  if (IS_MOCK) {
    const { MOCK_FIXTURES } = await import('@/lib/mock/data')
    return groupFixturesByWeek(MOCK_FIXTURES, now)
  }

  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('fixtures')
    .select(FIXTURE_COLUMNS)
    .order('kickoff_at', { ascending: true })

  if (error) {
    console.error('getFixtureWeeks error:', error)
    return []
  }

  return groupFixturesByWeek((data ?? []) as unknown as FixtureRow[], now)
}

export const getFixtureWeeks = unstable_cache(getFixtureWeeksUncached, ['fixture-weeks'], {
  revalidate: 300,
})
