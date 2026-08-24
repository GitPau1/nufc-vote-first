import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import type { FixtureRow, SquadPosition } from '@/types/database'
import { koreanTeamName } from '@/lib/predict/team-names'
import { toKst, weekKey } from '@/lib/predictions/week'
import { playerPhotoUrl } from '@/lib/predictions/candidates'
import { mockGetHomeMatchdayFixture } from '@/lib/mock/queries'
// 예측 목록(주차 그룹)은 승부예측 기능에서 쓰는 별개 경로다 — 같은 fixtures 테이블을 읽지만
// 컬럼·가공 방식이 달라서 FixtureRow도 서로 다른 타입이라 별칭으로 구분한다.
import {
  groupFixturesByWeek,
  type FixtureRow as WeekFixtureRow,
  type WeekGroup,
} from '@/lib/predictions/week'

/** 평점을 받은 선수 한 명의 표시용 형태. */
export type MatchdayRatedPlayer = {
  playerId: number
  name: string
  rating: number
  photoUrl: string
}

/** 포지션별 최고 평점 선수(수비수·미드필더·공격수). */
export type MatchdayPositionLeader = MatchdayRatedPlayer & {
  position: SquadPosition
}

/** 종료된 경기의 평점 요약 — DEF/MID/FWD 각 최고 평점 1명씩. 셋 중 최고가 골드로 강조된다. */
export type MatchRatings = {
  topDefender: MatchdayPositionLeader | null
  topMidfielder: MatchdayPositionLeader | null
  topForward: MatchdayPositionLeader | null
}

const EMPTY_RATINGS: MatchRatings = {
  topDefender: null,
  topMidfielder: null,
  topForward: null,
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
  /** 최고 평점 수비수. finished일 때만 값이 있을 수 있다 — 평점이 아직 안 들어왔으면 null. */
  topDefender: MatchdayPositionLeader | null
  /** 최고 평점 미드필더. */
  topMidfielder: MatchdayPositionLeader | null
  /** 최고 평점 공격수. */
  topForward: MatchdayPositionLeader | null
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

function toMatchdayFixture(row: FixtureRow, ratings: MatchRatings): MatchdayFixture {
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
    topDefender: ratings.topDefender,
    topMidfielder: ratings.topMidfielder,
    topForward: ratings.topForward,
    scoreStr: row.score_str,
    shootoutScore: detectShootoutScore(row),
  }
}

/**
 * 종료된 경기의 평점 요약 — DEF/MID/FWD 각 최고 평점 1명.
 * fixture_player_ratings에는 뉴캐슬 선수만 들어있고, 포지션은 season_squads에서 붙인다.
 * GK는 포지션 카드가 없어 여기 포함하지 않는다(요구상 수비수·미드필더·공격수 3종만).
 */
async function getMatchRatings(
  supabase: ReturnType<typeof createPublicClient>,
  fixtureId: number,
): Promise<MatchRatings> {
  const { data: ratings, error: ratingsError } = await supabase
    .from('fixture_player_ratings')
    .select('player_id, rating')
    .eq('fixture_id', fixtureId)
    .order('rating', { ascending: false })

  if (ratingsError) {
    console.error('getMatchRatings (ratings) error:', ratingsError)
    return EMPTY_RATINGS
  }
  if (!ratings || ratings.length === 0) return EMPTY_RATINGS

  const rows = ratings as { player_id: number; rating: number }[]

  // season_squads가 (season_id, fotmob_player_id) 복합키라 시즌을 모르면 여러 행이 걸릴 수 있다.
  const { data: season } = (await supabase
    .from('seasons')
    .select('id')
    .eq('is_current', true)
    .maybeSingle()) as { data: { id: string } | null }

  if (!season) return EMPTY_RATINGS

  const { data: squads, error: squadError } = (await supabase
    .from('season_squads')
    .select('fotmob_player_id, name, name_ko, position')
    .eq('season_id', season.id)
    .in(
      'fotmob_player_id',
      rows.map((r) => r.player_id),
    )) as {
    data: { fotmob_player_id: number; name: string; name_ko: string | null; position: SquadPosition }[] | null
    error: unknown
  }

  if (squadError) {
    console.error('getMatchRatings (squad) error:', squadError)
    return EMPTY_RATINGS
  }

  const squadById = new Map((squads ?? []).map((s) => [s.fotmob_player_id, s]))

  // ratings가 평점 내림차순이므로 이 배열도 내림차순을 유지한다 —
  // 아래 find()가 각 포지션의 "첫 번째" = 최고 평점을 집어낸다.
  const rated: MatchdayPositionLeader[] = []
  for (const r of rows) {
    const squad = squadById.get(r.player_id)
    if (!squad) continue
    rated.push({
      playerId: r.player_id,
      name: squad.name_ko?.trim() || squad.name,
      rating: r.rating,
      photoUrl: playerPhotoUrl(r.player_id),
      position: squad.position,
    })
  }
  if (rated.length === 0) return EMPTY_RATINGS

  const topOf = (position: SquadPosition) => rated.find((p) => p.position === position) ?? null

  return {
    topDefender: topOf('DEF'),
    topMidfielder: topOf('MID'),
    topForward: topOf('FWD'),
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
    return toMatchdayFixture(upcoming[0] as FixtureRow, EMPTY_RATINGS)
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
  const ratings = await getMatchRatings(supabase, row.fixture_id)
  return toMatchdayFixture(row, ratings)
}

export const getHomeMatchdayFixture = unstable_cache(getHomeMatchdayFixtureUncached, ['home-matchday-fixture'], {
  revalidate: 30,
})

export type { WeekGroup }

const WEEK_FIXTURE_COLUMNS =
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
    .select(WEEK_FIXTURE_COLUMNS)
    .order('kickoff_at', { ascending: true })

  if (error) {
    console.error('getFixtureWeeks error:', error)
    return []
  }

  return groupFixturesByWeek((data ?? []) as unknown as WeekFixtureRow[], now)
}

export const getFixtureWeeks = unstable_cache(getFixtureWeeksUncached, ['fixture-weeks'], {
  revalidate: 300,
})
