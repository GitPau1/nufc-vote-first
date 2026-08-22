/**
 * fixtures 행 → 승부예측 목록 화면용 주차 그룹 변환 (순수 함수, DB 접근 없음).
 * 조회는 lib/queries/fixtures.ts, 화면은 components/predict/*.
 */

import type { PredictWeek } from '@/components/predict/MatchWeekList'
import type { MyPredictionMap } from '@/lib/queries/predictions'

export type FixtureRow = {
  fixture_id: number
  competition_name: string | null
  kickoff_at: string | null
  home_id: number
  home_name: string
  home_score: number | null
  away_id: number
  away_name: string
  away_score: number | null
  started: boolean
  finished: boolean
  cancelled: boolean
}

/** FotMob 뉴캐슬 team id — fixtures 실데이터에서 확인(2026-08-21). */
export const NUFC_TEAM_ID = 10261
export const NUFC_LABEL = '뉴캐슬'

/** 예측 오픈 시점: 킥오프 7일 전. */
export const PREDICT_OPEN_BEFORE_MS = 7 * 86_400_000

const KST_OFFSET_MS = 9 * 3_600_000

/**
 * 'open'=예측 가능, 'result'=끝나서 결과 표시, 'upcoming'=잠김(아직 안 열렸거나 이미 닫힘).
 * 예측/제출의 단위는 경기(fixture) 하나다 — 같은 주의 경기들도 각각 독립된 세션이다.
 */
export type MatchStatus = 'open' | 'upcoming' | 'result'

export type MatchView = {
  id: string
  competition: string
  opponent: string
  /** 상대팀 FotMob team id — 엠블럼 URL 구성용 */
  opponentId: number
  isHome: boolean
  /** '8/23' */
  kickoff: string
  /** '오후 8:00' */
  kickoffTime: string
  /** 킥오프 원본 시각(ISO). 완료 화면 카운트다운의 목표 시각. 없으면 null. */
  kickoffAt: string | null
  status: MatchStatus
  /** 종료된 경기의 [우리, 상대] 스코어. 스코어가 없으면 null. */
  actual: [number, number] | null
}

export type WeekGroup = {
  weekNo: number
  /** '2026-34' — 목록 그룹 키. 연도가 넘어가도 안 겹친다. */
  weekKey: string
  /** '2026-08' — 목록 화면 월 필터용 */
  monthKey: string
  matches: MatchView[]
}

/** 예측 플로우/결과 화면이 다루는 세션 하나 = 경기 하나 + 표시용 주차 번호(라운드). */
export type MatchSession = MatchView & { weekNo: number }

/** fixtures가 FotMob 동기화 데이터라 엠블럼도 같은 CDN을 쓴다. */
export function teamLogoUrl(teamId: number): string {
  return `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`
}

/** UTC 시각을 한국 기준 달력 날짜로 옮긴 Date(한국은 DST 없음). */
function toKst(iso: string): Date {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS)
}

/** ISO 8601 주차 번호 (월요일 시작). */
export function isoWeek(kst: Date): number {
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))
  // 목요일이 속한 해가 그 주의 ISO 연도 — 목요일로 옮긴 뒤 연초부터 몇 주째인지 센다.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7)
}

/** 그룹 키 — 연도가 넘어가도 주차가 겹치지 않게 ISO 연도까지 포함. */
export function weekKey(kst: Date): string {
  const thursday = new Date(kst.getTime())
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7))
  return `${thursday.getUTCFullYear()}-${String(isoWeek(kst)).padStart(2, '0')}`
}

export function fixtureStatus(fixture: FixtureRow, now: number): MatchStatus {
  if (fixture.finished) return 'result'
  const kickoff = fixture.kickoff_at ? new Date(fixture.kickoff_at).getTime() : null
  if (kickoff === null) return 'upcoming'
  // 진행 중(started && !finished)인 경기도 upcoming — 예측만 막으면 되고, 라이브 상태는 아직 화면에 없다.
  if (fixture.started || now >= kickoff) return 'upcoming'
  return now >= kickoff - PREDICT_OPEN_BEFORE_MS ? 'open' : 'upcoming'
}

export function toMatchView(fixture: FixtureRow, now: number): MatchView {
  const isHome = fixture.home_id === NUFC_TEAM_ID
  const kst = fixture.kickoff_at ? toKst(fixture.kickoff_at) : null
  const ourScore = isHome ? fixture.home_score : fixture.away_score
  const theirScore = isHome ? fixture.away_score : fixture.home_score

  return {
    id: String(fixture.fixture_id),
    competition: fixture.competition_name ?? '',
    opponent: isHome ? fixture.away_name : fixture.home_name,
    opponentId: isHome ? fixture.away_id : fixture.home_id,
    isHome,
    kickoff: kst ? `${kst.getUTCMonth() + 1}/${kst.getUTCDate()}` : '',
    kickoffTime: kst ? formatKickoffTime(kst) : '',
    kickoffAt: fixture.kickoff_at,
    status: fixtureStatus(fixture, now),
    actual:
      fixture.finished && ourScore !== null && theirScore !== null
        ? [ourScore, theirScore]
        : null,
  }
}

function formatKickoffTime(kst: Date): string {
  const hour24 = kst.getUTCHours()
  const minute = String(kst.getUTCMinutes()).padStart(2, '0')
  const meridiem = hour24 < 12 ? '오전' : '오후'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${meridiem} ${hour12}:${minute}`
}

/**
 * 킥오프 기준 ISO 주차로 묶는다. 그룹은 목록의 표시 단위일 뿐이고 예측 세션은 경기 하나다.
 * 경기가 없는 중간 주차도 빈 그룹으로 채워 "이번 주는 예정된 경기가 없어요"가 그대로 나오게 한다.
 */
export function groupFixturesByWeek(fixtures: FixtureRow[], now: number): WeekGroup[] {
  const dated = fixtures
    .filter(f => !f.cancelled && f.kickoff_at)
    .sort((a, b) => (a.kickoff_at! < b.kickoff_at! ? -1 : 1))

  const groups: WeekGroup[] = []
  const byKey = new Map<string, WeekGroup>()

  for (const fixture of dated) {
    const kst = toKst(fixture.kickoff_at!)
    const key = weekKey(kst)
    let group = byKey.get(key)

    if (!group) {
      fillGapWeeks(groups, byKey, kst)
      group = emptyWeek(kst, key)
      byKey.set(key, group)
      groups.push(group)
    }
    group.matches.push(toMatchView(fixture, now))
  }

  return groups
}

function emptyWeek(kst: Date, key: string): WeekGroup {
  return {
    weekNo: isoWeek(kst),
    weekKey: key,
    monthKey: `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`,
    matches: [],
  }
}

/** 직전 그룹과 이번 주차 사이에 비어 있는 주를 빈 그룹으로 메운다. */
function fillGapWeeks(groups: WeekGroup[], byKey: Map<string, WeekGroup>, kst: Date) {
  const previous = groups[groups.length - 1]
  if (!previous) return

  // 직전 그룹의 월요일에서 한 주씩 전진하며 이번 주차 직전까지 채운다.
  const cursor = new Date(kst.getTime())
  cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() || 7) - 1))
  const gaps: WeekGroup[] = []

  for (let i = 0; i < 12; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - 7)
    const key = weekKey(cursor)
    if (byKey.has(key)) break
    const gap = emptyWeek(cursor, key)
    byKey.set(key, gap)
    gaps.unshift(gap)
  }

  groups.push(...gaps)
}

/** fixture_id로 예측 세션(경기 + 주차 번호)을 찾는다. 없으면 null. */
export function findMatchSession(weeks: WeekGroup[], fixtureId: string): MatchSession | null {
  for (const week of weeks) {
    const match = week.matches.find(m => m.id === fixtureId)
    if (match) return { ...match, weekNo: week.weekNo }
  }
  return null
}

/**
 * WeekGroup[] → MatchWeekList가 받는 PredictWeek[].
 * myPredictions는 fixture_id → 내 제출 내역(lib/queries/predictions.ts).
 * ponytail: totalPoints는 prediction_results view(채점)를 붙일 때 함께 주입한다.
 */
export function toPredictWeeks(
  weeks: WeekGroup[],
  myPredictions: MyPredictionMap = {},
): PredictWeek[] {
  return weeks.map(week => ({
    weekNo: week.weekNo,
    matches: week.matches.map(match => ({
      id: match.id,
      competition: match.competition || undefined,
      opponent: match.opponent,
      opponentLogoUrl: teamLogoUrl(match.opponentId),
      isHome: match.isHome,
      kickoff: match.kickoff,
      kickoffTime: match.kickoffTime,
      status: match.status,
      myResult: myPredictions[match.id] ? { predicted: myPredictions[match.id].score } : undefined,
      // MatchView.actual은 [우리, 상대]인데 PredictWeekMatch.actual은 [홈, 원정]이라 원정 경기는 뒤집는다.
      actual: match.actual
        ? match.isHome
          ? match.actual
          : ([match.actual[1], match.actual[0]] as [number, number])
        : undefined,
    })),
  }))
}
