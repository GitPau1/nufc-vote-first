import { unstable_cache } from 'next/cache'
import { createClient, createPublicClient, getCurrentUser } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import type { Position } from '@/lib/predictions/candidates'
import { MOCK_RANKING, MOCK_RATINGS_PENDING_FIXTURE_IDS, MOCK_RESULTS } from '@/lib/mock/data'
import { getProfileIconThresholdsSafe, resolveProfileIconUrl } from '@/lib/images/profile-icons'

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

  const user = await getCurrentUser()
  if (!user) return {}

  const supabase = await createClient()

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

const SEASON_RANKING_COLUMNS = 'user_id, display_name, avatar_url, total_points, rank'

/**
 * 주차·시즌 랭킹이 같은 태그를 쓴다 — 둘 다 prediction_results에서 나오므로 한쪽이 바뀌면
 * 다른 쪽도 바뀐다. 평점이 저장될 때 lib/actions/fixture-ratings.ts가 이 태그를 비운다.
 */
const RANKING_TAG = 'prediction-rankings'

/**
 * 주차 랭킹 전체 — 결과 화면 "전체 결과" 탭은 "전체보기"로 참여자를 다 펼칠 수 있어야 하므로
 * 자르지 않고 그 주차 참여자를 전부 내려준다. 랭킹은 참여 여부와 무관하게 공개된다(미참여자도 조회 가능).
 * 로그인 상태면 내 행에 isMe가 붙어 하이라이트된다.
 */
// view 조회 자체는 전원 공용 데이터라 캐시한다. 개인화(isMe)는 캐시 밖에서 붙인다 —
// 캐시된 값에 사용자별 필드가 섞이면 남의 isMe가 보인다.
// createClient(쿠키 기반)가 아니라 createPublicClient를 쓰는 이유: unstable_cache 안에서는
// 요청 쿠키를 읽을 수 없다. 뷰는 security_invoker지만 밑단에 `predictions: public read`
// 정책이 있어 익명 클라이언트로도 같은 행이 나온다.
const getWeekRankingRows = unstable_cache(
  async (weekKey: string): Promise<WeekRankingQueryRow[]> => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('week_leaderboard')
      .select('user_id, display_name, avatar_url, match_points, pick_points, total_points, rank')
      .eq('week_key', weekKey)
      .order('rank')

    if (error) {
      console.error('getWeekRanking error:', error)
      return []
    }
    return (data ?? []) as unknown as WeekRankingQueryRow[]
  },
  ['week-ranking'],
  { revalidate: 60, tags: [RANKING_TAG] },
)

export async function getWeekRanking(weekKey: string): Promise<RankingRow[]> {
  if (IS_MOCK) return mockRanking(true)

  const [rows, user, thresholds] = await Promise.all([
    getWeekRankingRows(weekKey),
    getCurrentUser(),
    getProfileIconThresholdsSafe(),
  ])

  return rows.map(row => ({
    userId: row.user_id,
    rank: row.rank,
    name: row.display_name ?? ANONYMOUS_NAME,
    avatarUrl: resolveProfileIconUrl(row.total_points, thresholds),
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
// 상위권은 공개 데이터라 캐시하고, 내 순위 행은 사용자별이라 캐시 밖에 남긴다.
const getSeasonTopRows = unstable_cache(
  async (limit: number): Promise<SeasonRankingQueryRow[]> => {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('season_leaderboard')
      .select(SEASON_RANKING_COLUMNS)
      .order('rank')
      .limit(limit)

    if (error) {
      console.error('getSeasonRanking error:', error)
      return []
    }
    return (data ?? []) as unknown as SeasonRankingQueryRow[]
  },
  ['season-ranking'],
  { revalidate: 60, tags: [RANKING_TAG] },
)

/** 내 시즌 순위 한 줄. TOP N 밖이면 상위권 조회에 안 걸려서 따로 읽는다. */
export async function getMySeasonRow(userId: string): Promise<SeasonRankingQueryRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('season_leaderboard')
    .select(SEASON_RANKING_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()

  return (data ?? null) as unknown as SeasonRankingQueryRow | null
}

export async function getSeasonRanking(limit = 3): Promise<RankingRow[]> {
  if (IS_MOCK) return mockRanking(false).slice(0, limit + 1)

  const user = await getCurrentUser()
  const [top, myRow, thresholds] = await Promise.all([
    getSeasonTopRows(limit),
    user ? getMySeasonRow(user.id) : Promise.resolve(null),
    getProfileIconThresholdsSafe(),
  ])

  const rows = [...top]
  if (myRow && !rows.some(row => row.user_id === myRow.user_id)) rows.push(myRow)

  return rows.map(row => ({
    userId: row.user_id,
    rank: row.rank,
    name: row.display_name ?? ANONYMOUS_NAME,
    avatarUrl: resolveProfileIconUrl(row.total_points, thresholds),
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

/**
 * 평점 집계 "완료" 판정 임계값. supabase/functions/sync-fixture-ratings/index.ts의
 * MIN_RATED_PLAYERS, supabase/migrations/20260905120000_prediction_fixture_results.sql와
 * 20260905130000_prediction_results_rated_players_count.sql의 rated_players_count 컬럼
 * comment와 반드시 같은 값이어야 한다 — 네 곳이 서로를 가리키는 주석으로 매직넘버 중복을
 * 감수한다(SQL/TS 경계 때문에 상수 자체는 공유할 수 없음).
 */
const RATED_PLAYERS_SETTLED_THRESHOLD = 11

/**
 * fixture_id → 채점 결과 + 평점 집계 완료 여부. 로그인 안 했으면 빈 맵.
 * `ratingsSettled`는 이 view(`prediction_results`, 20260905130000부터 rated_players_count 보유)가
 * 주차 정산 게이트만 볼 뿐 평점 부분 적재는 못 보는 갭을 메운다 — 정산 화면(`MatchResultBlock`의
 * `pickPointsReady`)이 이 값으로 "집계 중" 분기를 판단한다.
 */
export type MyResultMap = Record<string, MyResult & { ratingsSettled: boolean }>

const RESULT_COLUMNS =
  'fixture_id, pred_home, pred_away, match_points, pick_points, total_points, ' +
  'def_player_id, mid_player_id, fwd_player_id, def_rating, mid_rating, fwd_rating, def_points, mid_points, fwd_points, ' +
  'rated_players_count'

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
  rated_players_count: number
}

/**
 * 내 채점 결과 전체. 배당은 여기 없다 — 결과 화면은 `getMyPredictions()`의 스냅샷 배당을 같이 읽어
 * 쓴다(view가 배당 컬럼을 내려주지 않고, 예측 내역은 어차피 같은 화면에서 필요하다).
 * 사용자별 데이터라 캐시하지 않는다.
 */
export async function getMyResults(): Promise<MyResultMap> {
  if (IS_MOCK) return MOCK_FIXTURE_RESULTS

  const user = await getCurrentUser()
  if (!user) return {}

  const supabase = await createClient()

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
    map[String(row.fixture_id)] = mapResultRow(row)
  }
  return map
}

/** numeric 컬럼은 supabase-js가 문자열로 줄 수 있다. */
function num(value: number | string | null): number | null {
  return value === null ? null : Number(value)
}

/**
 * `ResultQueryRow` → `MyResult & { ratingsSettled }`. `prediction_results`·
 * `prediction_fixture_results` 두 view가 같은 컬럼 구성(`RESULT_COLUMNS`)이라
 * `getMyResults()`/`getMyFixtureResults()`가 이 매핑을 그대로 공유한다.
 */
function mapResultRow(row: ResultQueryRow): MyResult & { ratingsSettled: boolean } {
  return {
    predicted: [row.pred_home, row.pred_away],
    matchPoints: row.match_points,
    pickPoints: row.pick_points,
    totalPoints: row.total_points,
    picks: {
      DEF: { playerId: row.def_player_id, rating: num(row.def_rating), points: row.def_points },
      MID: { playerId: row.mid_player_id, rating: num(row.mid_rating), points: row.mid_points },
      FWD: { playerId: row.fwd_player_id, rating: num(row.fwd_rating), points: row.fwd_points },
    },
    ratingsSettled: row.rated_players_count >= RATED_PLAYERS_SETTLED_THRESHOLD,
  }
}

/**
 * `MyResultMap`과 같은 모양(4.5단계에서 `prediction_results`에도 rated_players_count가 붙어
 * 두 맵의 값 타입이 같아졌다) — `getMyFixtureResults()` 전용 이름만 별도로 남긴다.
 */
export type MyFixtureResultMap = MyResultMap

/**
 * 정산 게이트 없는 경기 단위 예측 결과 — `prediction_fixture_results` view
 * (`20260905120000_prediction_fixture_results.sql`). `getMyResults()`와 달리 주차 진행 상태와
 * 무관하게 종료된 경기면 나온다. 사용자별 데이터라 캐시하지 않는다.
 */
export async function getMyFixtureResults(): Promise<MyFixtureResultMap> {
  if (IS_MOCK) return MOCK_FIXTURE_RESULTS

  const user = await getCurrentUser()
  if (!user) return {}

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('prediction_fixture_results')
    .select(RESULT_COLUMNS)
    .eq('user_id', user.id)

  if (error) {
    console.error('getMyFixtureResults error:', error)
    return {}
  }

  const map: MyFixtureResultMap = {}
  for (const row of (data ?? []) as unknown as ResultQueryRow[]) {
    map[String(row.fixture_id)] = mapResultRow(row)
  }
  return map
}

/**
 * mock 모드 stub. `getMyResults()`·`getMyFixtureResults()` 둘 다 이 데이터를 쓴다 — mock 모드는
 * 주차 게이트를 재현하지 않아 두 쿼리가 같은 값을 봐도 무방하다. `ratingsSettled`는
 * `MOCK_RATINGS_PENDING_FIXTURE_IDS`에 있는 fixture만 false — 나머지는 평점이 다 걷힌 것으로 본다.
 */
const MOCK_FIXTURE_RESULTS: MyFixtureResultMap = Object.fromEntries(
  Object.entries(MOCK_RESULTS).map(([fixtureId, result]) => [
    fixtureId,
    { ...result, ratingsSettled: !MOCK_RATINGS_PENDING_FIXTURE_IDS.includes(fixtureId) },
  ])
)

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
