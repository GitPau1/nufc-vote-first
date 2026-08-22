import { createClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import type { Position } from '@/lib/predictions/candidates'

/**
 * 내가 제출한 예측 1건. 배당은 제출 시점 스냅샷(`predictions.{def,mid,fwd}_multiplier`)이라
 * 지금 `season_squads`에 있는 값이 아니라 이 값을 보여줘야 채점 결과와 어긋나지 않는다.
 * 선수 이름/사진은 여기 담지 않는다 — 화면이 이미 갖고 있는 픽 후보 목록에서 id로 찾는다.
 */
export type MyPrediction = {
  /** [홈, 원정] — fixtures와 같은 기준 */
  score: [number, number]
  picks: Record<Position, { playerId: number; multiplier: number }>
}

/** fixture_id → 내 제출 내역. 로그인 안 했으면 빈 맵. */
export type MyPredictionMap = Record<string, MyPrediction>

const PREDICTION_COLUMNS =
  'fixture_id, home_score, away_score, def_player_id, mid_player_id, fwd_player_id, def_multiplier, mid_multiplier, fwd_multiplier'

type PredictionQueryRow = {
  fixture_id: number
  home_score: number
  away_score: number
  def_player_id: number
  mid_player_id: number
  fwd_player_id: number
  def_multiplier: number
  mid_multiplier: number
  fwd_multiplier: number
}

function toMyPrediction(row: PredictionQueryRow): MyPrediction {
  return {
    score: [row.home_score, row.away_score],
    picks: {
      DEF: { playerId: row.def_player_id, multiplier: Number(row.def_multiplier) },
      MID: { playerId: row.mid_player_id, multiplier: Number(row.mid_multiplier) },
      FWD: { playerId: row.fwd_player_id, multiplier: Number(row.fwd_multiplier) },
    },
  }
}

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
    .select(PREDICTION_COLUMNS)
    .eq('user_id', user.id)

  if (error) {
    console.error('getMyPredictions error:', error)
    return {}
  }

  const map: MyPredictionMap = {}
  for (const row of (data ?? []) as unknown as PredictionQueryRow[]) {
    map[String(row.fixture_id)] = toMyPrediction(row)
  }
  return map
}

/** 목 모드는 제출을 쿠키에 저장한다(lib/actions/predictions.ts와 같은 키·형식). */
async function getMockPredictions(): Promise<MyPredictionMap> {
  const { cookies } = await import('next/headers')
  const jar = await cookies()
  if (jar.get('mock-auth')?.value !== 'true') return {}

  const map: MyPredictionMap = {}
  for (const cookie of jar.getAll()) {
    if (!cookie.name.startsWith('mock-prediction-')) continue
    try {
      const stored = JSON.parse(cookie.value) as PredictionQueryRow
      map[String(stored.fixture_id)] = toMyPrediction(stored)
    } catch {
      // 형식이 깨진 쿠키는 제출 안 한 것으로 본다
    }
  }
  return map
}
