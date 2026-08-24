import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import type { FixtureRow } from '@/types/database'
import { koreanTeamName } from '@/lib/predict/team-names'
import { toKst, weekKey } from '@/lib/predictions/week'
import { playerPhotoUrl } from '@/lib/predictions/candidates'
import { mockGetHomeMatchdayFixture } from '@/lib/mock/queries'

export type MatchdayPlayerOfMatch = {
  playerId: number
  name: string
  rating: number
  photoUrl: string
}

/** 홈 히어로(MatchdayHero)가 그대로 받는 형태 — fixtures row에서 표시용 필드만 추려 한글 팀명을 입힌다. */
export type MatchdayFixture = {
  fixtureId: number
  competitionName: string | null
  kickoffAt: string
  homeId: number
  homeName: string
  awayId: number
  awayName: string
  homeScore: number | null
  awayScore: number | null
  started: boolean
  finished: boolean
  /** "2026-35" — 승부예측 세션 URL 파라미터(/predictions/{weekKey}). lib/predictions/week.ts 참고. */
  weekKey: string
  /** finished일 때만 값이 있을 수 있다 — 평점이 아직 안 들어왔으면 null. */
  playerOfMatch: MatchdayPlayerOfMatch | null
  /** FotMob 표시용 스코어 문자열. 실제 경기 결과는 이걸 그대로 보여준다(homeScore/awayScore 조합 아님). */
  scoreStr: string | null
  /**
   * "5-4" 형태. 승부차기로 끝난 경기는 FotMob 동기화가 승부차기 스코어를 home_score/away_score에
   * 넣어버려서(score_str은 정규 시간 스코어를 유지) 그 둘이 어긋난다 — 그 어긋남을 승부차기가
   * 있었다는 신호로 써서 이 필드에 옮겨 담는다. 안 어긋나면(일반 경기) null.
   */
  shootoutScore: string | null
}

// 히어로는 킥오프 24시간 전부터 뜬다 — 그 전엔 fixture를 null로 돌려줘서 HomeClient가
// 예전 방식(투표 배너)으로 대체하게 한다.
const PRE_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000

// FotMob 동기화 배치가 늦거나 멈추면 이미 끝난 경기가 finished=false로 계속 남을 수 있다.
// kickoff로부터 이 시간이 지나도 안 끝난 걸로 남아있으면 "다음 경기" 후보에서 건너뛴다 —
// 이미 지난 경기를 카운트다운 0으로 계속 보여주는 사고를 막기 위한 안전장치.
const STALE_GRACE_MS = 3 * 60 * 60 * 1000

/**
 * score_str에서 "N-N"을 뽑아 home_score/away_score와 비교한다. 둘이 다르면(=score_str이
 * 파싱조차 안 되면 비교 불가 취급, 다른 걸로 안 본다) home_score/away_score를 승부차기
 * 스코어로 판단해서 "N-N" 문자열로 돌려준다. 일치하거나 비교 불가면 null.
 */
function detectShootoutScore(row: FixtureRow): string | null {
  if (!row.score_str || row.home_score === null || row.away_score === null) return null

  const match = row.score_str.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (!match) return null

  const [, strHome, strAway] = match
  if (Number(strHome) === row.home_score && Number(strAway) === row.away_score) return null

  return `${row.home_score}-${row.away_score}`
}

function toMatchdayFixture(row: FixtureRow, playerOfMatch: MatchdayPlayerOfMatch | null): MatchdayFixture {
  const kickoffAt = row.kickoff_at ?? new Date().toISOString()
  return {
    fixtureId: row.fixture_id,
    competitionName: row.competition_name,
    kickoffAt,
    homeId: row.home_id,
    homeName: koreanTeamName(row.home_id, row.home_name),
    awayId: row.away_id,
    awayName: koreanTeamName(row.away_id, row.away_name),
    homeScore: row.home_score,
    awayScore: row.away_score,
    started: row.started,
    finished: row.finished,
    weekKey: weekKey(toKst(kickoffAt)),
    playerOfMatch,
    scoreStr: row.score_str,
    shootoutScore: detectShootoutScore(row),
  }
}

/** 종료된 경기의 최우수 선수 — fixture_player_ratings에서 가장 높은 평점 1명(뉴캐슬 선수만 들어있는 테이블). */
async function getPlayerOfMatch(
  supabase: ReturnType<typeof createPublicClient>,
  fixtureId: number,
): Promise<MatchdayPlayerOfMatch | null> {
  const { data: ratings, error: ratingsError } = await supabase
    .from('fixture_player_ratings')
    .select('player_id, rating')
    .eq('fixture_id', fixtureId)
    .order('rating', { ascending: false })
    .limit(1)

  if (ratingsError) {
    console.error('getPlayerOfMatch (ratings) error:', ratingsError)
    return null
  }
  if (!ratings || ratings.length === 0) return null

  const top = ratings[0] as { player_id: number; rating: number }

  // season_squads가 (season_id, fotmob_player_id) 복합키라 시즌을 모르면 여러 행이 걸릴 수 있다.
  const { data: season } = (await supabase
    .from('seasons')
    .select('id')
    .eq('is_current', true)
    .maybeSingle()) as { data: { id: string } | null }

  if (!season) return null

  const { data: squad, error: squadError } = (await supabase
    .from('season_squads')
    .select('name, name_ko')
    .eq('season_id', season.id)
    .eq('fotmob_player_id', top.player_id)
    .maybeSingle()) as { data: { name: string; name_ko: string | null } | null; error: unknown }

  if (squadError) {
    console.error('getPlayerOfMatch (squad) error:', squadError)
    return null
  }
  if (!squad) return null

  return {
    playerId: top.player_id,
    name: squad.name_ko?.trim() || squad.name,
    rating: top.rating,
    photoUrl: playerPhotoUrl(top.player_id),
  }
}

/**
 * 홈 화면 히어로에 띄울 경기 하나를 고른다: 킥오프 24시간 전 ~ 진행중이면 그 경기,
 * 아니면(24시간 이상 남았거나 아직 다음 경기가 없으면) 가장 최근 종료된 경기(+최우수 선수).
 * 취소된 경기는 제외한다.
 */
async function getHomeMatchdayFixtureUncached(): Promise<MatchdayFixture | null> {
  if (IS_MOCK) return mockGetHomeMatchdayFixture()

  const supabase = createPublicClient()
  const now = Date.now()
  const staleCutoff = new Date(now - STALE_GRACE_MS).toISOString()
  const preMatchCutoff = new Date(now + PRE_MATCH_WINDOW_MS).toISOString()

  const { data: upcoming, error: upcomingError } = await supabase
    .from('fixtures')
    .select('*')
    .eq('finished', false)
    .eq('cancelled', false)
    .gte('kickoff_at', staleCutoff)
    .lte('kickoff_at', preMatchCutoff)
    .order('kickoff_at', { ascending: true })
    .limit(1)

  if (upcomingError) {
    console.error('getHomeMatchdayFixture (upcoming) error:', upcomingError)
  } else if (upcoming && upcoming.length > 0) {
    return toMatchdayFixture(upcoming[0] as FixtureRow, null)
  }

  const { data: recent, error: recentError } = await supabase
    .from('fixtures')
    .select('*')
    .eq('finished', true)
    .eq('cancelled', false)
    .order('kickoff_at', { ascending: false })
    .limit(1)

  if (recentError) {
    console.error('getHomeMatchdayFixture (recent) error:', recentError)
    return null
  }
  if (!recent || recent.length === 0) return null

  const row = recent[0] as FixtureRow
  const playerOfMatch = await getPlayerOfMatch(supabase, row.fixture_id)
  return toMatchdayFixture(row, playerOfMatch)
}

export const getHomeMatchdayFixture = unstable_cache(getHomeMatchdayFixtureUncached, ['home-matchday-fixture'], {
  revalidate: 30,
})
