import { createClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'

/** fixture_id → 제출한 스코어([홈, 원정]). 로그인 안 했으면 빈 맵. */
export type MyPredictionMap = Record<string, [number, number]>

/**
 * 내 제출 내역. 사용자별 데이터라 unstable_cache를 쓰지 않는다(캐시가 남의 예측을 보여주면 안 된다).
 * ponytail: 점수/랭킹은 prediction_results·season_leaderboard view가 붙을 때 별도 쿼리로 추가한다.
 */
export async function getMyPredictions(): Promise<MyPredictionMap> {
  if (IS_MOCK) return getMockPredictions()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('predictions')
    .select('fixture_id, home_score, away_score')
    .eq('user_id', user.id)

  if (error) {
    console.error('getMyPredictions error:', error)
    return {}
  }

  const map: MyPredictionMap = {}
  for (const row of (data ?? []) as Array<{ fixture_id: number; home_score: number; away_score: number }>) {
    map[String(row.fixture_id)] = [row.home_score, row.away_score]
  }
  return map
}

/** 목 모드는 제출을 쿠키에 저장한다(lib/actions/predictions.ts와 같은 키). */
async function getMockPredictions(): Promise<MyPredictionMap> {
  const { cookies } = await import('next/headers')
  const jar = await cookies()
  if (jar.get('mock-auth')?.value !== 'true') return {}

  const map: MyPredictionMap = {}
  for (const cookie of jar.getAll()) {
    if (!cookie.name.startsWith('mock-prediction-')) continue
    try {
      const stored = JSON.parse(cookie.value) as MyPredictionMap
      Object.assign(map, stored)
    } catch {
      // 형식이 깨진 쿠키는 제출 안 한 것으로 본다
    }
  }
  return map
}
