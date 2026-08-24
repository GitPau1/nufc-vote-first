import { createClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import type { Position } from '@/lib/predictions/candidates'
import { MOCK_RANKING, MOCK_RESULTS } from '@/lib/mock/data'

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

/**
 * 랭킹 한 줄. 주차 랭킹은 경기예측/선수픽 점수를 따로 보여주고(3컬럼), 시즌 누적은 총점만 있다
 * — view가 그렇게 나뉘어 있어서(week_leaderboard vs season_leaderboard) 선택 컬럼도 갈린다.
 * 순위 변동(▲/▼)은 지난 주차 순위를 보관하지 않아 내려주지 않는다.
 */
export type RankingRow = {
  userId: string
  rank: number
  name: string
  avatarUrl: string | null
  totalPoints: number
  /** 주차 랭킹 전용 */
  matchPoints?: number
  /** 주차 랭킹 전용 */
  pickPoints?: number
  isMe: boolean
}

const ANONYMOUS_NAME = '익명'

type WeekRankingQueryRow = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  match_points: number
  pick_points: number
  total_points: number
  rank: number
}

type SeasonRankingQueryRow = {
  user_id: string
  display_name: string | null
  avatar_url: string | null
  total_points: number
  rank: number
}

/**
 * 주차 랭킹 전체 — 결과 화면 "전체 결과" 탭은 "전체보기"로 참여자를 다 펼칠 수 있어야 하므로
 * 자르지 않고 그 주차 참여자를 전부 내려준다. 랭킹은 참여 여부와 무관하게 공개된다(미참여자도 조회 가능).
 * 로그인 상태면 내 행에 isMe가 붙어 하이라이트된다.
 */
export async function getWeekRanking(weekKey: string): Promise<RankingRow[]> {
  if (IS_MOCK) return mockRanking(true)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('week_leaderboard')
    .select('user_id, display_name, avatar_url, match_points, pick_points, total_points, rank')
    .eq('week_key', weekKey)
    .order('rank')

  if (error) {
    console.error('getWeekRanking error:', error)
    return []
  }

  return (data ?? []).map((row: WeekRankingQueryRow) => ({
    userId: row.user_id,
    rank: row.rank,
    name: row.display_name ?? ANONYMOUS_NAME,
    avatarUrl: row.avatar_url,
    matchPoints: row.match_points,
    pickPoints: row.pick_points,
    totalPoints: row.total_points,
    isMe: row.user_id === user?.id,
  }))
}

/**
 * 시즌 누적 랭킹 — 목록 화면 우측 카드 두 개(TOP N / 내 순위)가 같은 배열을 쓴다.
 * 내 순위가 TOP N 밖이면 상위권 조회에 안 걸리므로 내 행만 따로 한 번 더 읽어 뒤에 붙인다.
 */
export async function getSeasonRanking(limit = 3): Promise<RankingRow[]> {
  if (IS_MOCK) return mockRanking(false).slice(0, limit + 1)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const columns = 'user_id, display_name, avatar_url, total_points, rank'

  const [top, mine] = await Promise.all([
    supabase.from('season_leaderboard').select(columns).order('rank').limit(limit),
    user
      ? supabase.from('season_leaderboard').select(columns).eq('user_id', user.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (top.error) {
    console.error('getSeasonRanking error:', top.error)
    return []
  }

  const rows = [...((top.data ?? []) as unknown as SeasonRankingQueryRow[])]
  const myRow = mine.data as unknown as SeasonRankingQueryRow | null
  if (myRow && !rows.some(row => row.user_id === myRow.user_id)) rows.push(myRow)

  return rows.map(row => ({
    userId: row.user_id,
    rank: row.rank,
    name: row.display_name ?? ANONYMOUS_NAME,
    avatarUrl: row.avatar_url,
    totalPoints: row.total_points,
    isMe: row.user_id === user?.id,
  }))
}

/** 목 모드 랭킹 — 화면 확인용 고정 데이터. 실제 view 결과와 컬럼 구성만 같다. */
function mockRanking(weekly: boolean): RankingRow[] {
  return MOCK_RANKING.map(entry => ({
    ...entry,
    matchPoints: weekly ? entry.matchPoints : undefined,
    pickPoints: weekly ? entry.pickPoints : undefined,
  }))
}

/**
 * 채점된 내 예측 1건(경기 하나). `prediction_results` view는 종료된 경기만 담으므로
 * 이 맵에 있는 경기는 곧 "결과가 나온 경기"다. 픽 점수는 포지션별로 나눠서 내려준다 —
 * 결과 화면이 포지션 카드마다 평점 배지와 획득 점수를 따로 보여줘야 하기 때문.
 */
export type MyResult = {
  /** [우리, 상대]가 아니라 [홈, 원정] — MatchView와 맞추는 건 화면 쪽에서 한다 */
  predicted: [number, number]
  matchPoints: number
  pickPoints: number
  totalPoints: number
  /** 배당은 view에 없다 — 화면은 `getMyPredictions()`의 스냅샷 배당과 함께 읽는다 */
  picks: Record<Position, { playerId: number; rating: number | null; points: number }>
}

/** fixture_id → 채점 결과. 로그인 안 했으면 빈 맵. */
export type MyResultMap = Record<string, MyResult>

const RESULT_COLUMNS =
  'fixture_id, pred_home, pred_away, match_points, pick_points, total_points, ' +
  'def_player_id, mid_player_id, fwd_player_id, def_rating, mid_rating, fwd_rating, def_points, mid_points, fwd_points'

type ResultQueryRow = {
  fixture_id: number
  pred_home: number
  pred_away: number
  match_points: number
  pick_points: number
  total_points: number
  def_player_id: number
  mid_player_id: number
  fwd_player_id: number
  def_rating: number | null
  mid_rating: number | null
  fwd_rating: number | null
  def_points: number
  mid_points: number
  fwd_points: number
}

/**
 * 내 채점 결과 전체. 배당은 여기 없다 — 결과 화면은 `getMyPredictions()`의 스냅샷 배당을 같이 읽어
 * 쓴다(view가 배당 컬럼을 내려주지 않고, 예측 내역은 어차피 같은 화면에서 필요하다).
 * 사용자별 데이터라 캐시하지 않는다.
 */
export async function getMyResults(): Promise<MyResultMap> {
  if (IS_MOCK) return MOCK_RESULTS

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('prediction_results')
    .select(RESULT_COLUMNS)
    .eq('user_id', user.id)

  if (error) {
    console.error('getMyResults error:', error)
    return {}
  }

  const map: MyResultMap = {}
  for (const row of (data ?? []) as unknown as ResultQueryRow[]) {
    map[String(row.fixture_id)] = {
      predicted: [row.pred_home, row.pred_away],
      matchPoints: row.match_points,
      pickPoints: row.pick_points,
      totalPoints: row.total_points,
      picks: {
        DEF: { playerId: row.def_player_id, rating: num(row.def_rating), points: row.def_points },
        MID: { playerId: row.mid_player_id, rating: num(row.mid_rating), points: row.mid_points },
        FWD: { playerId: row.fwd_player_id, rating: num(row.fwd_rating), points: row.fwd_points },
      },
    }
  }
  return map
}

/** numeric 컬럼은 supabase-js가 문자열로 줄 수 있다. */
function num(value: number | string | null): number | null {
  return value === null ? null : Number(value)
}

/**
 * 한 경기의 선수 평점 — 관리자 입력 화면이 기존 값을 채워 보여줄 때 쓴다.
 * 행이 없는 선수는 "미집계"이고 픽 점수가 0으로 계산된다.
 * 관리자용이라 캐시하지 않는다(입력 직후 값이 그대로 보여야 한다).
 */
export async function getFixtureRatings(fixtureId: string): Promise<Record<string, number>> {
  if (IS_MOCK) return {}

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('fixture_player_ratings')
    .select('player_id, rating')
    .eq('fixture_id', fixtureId)

  if (error) {
    console.error('getFixtureRatings error:', error)
    return {}
  }

  const map: Record<string, number> = {}
  for (const row of (data ?? []) as unknown as { player_id: number; rating: number | string }[]) {
    map[String(row.player_id)] = Number(row.rating)
  }
  return map
}
