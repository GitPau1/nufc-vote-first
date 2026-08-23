/**
 * fixtures 행 → 승부예측 목록 화면용 주차 그룹 변환 (순수 함수, DB 접근 없음).
 * 조회는 lib/queries/fixtures.ts, 화면은 components/predict/*.
 */

import type { PredictWeek } from '@/components/predict/MatchWeekList'
import type { MyPrediction, MyPredictionMap } from '@/lib/queries/predictions'
import type { Position } from '@/lib/predictions/candidates'

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

/** 예측 오픈 시점: 그 주 첫 경기 킥오프 7일 전. 마감은 경기별 킥오프이라 여기 없다. */
export const PREDICT_OPEN_BEFORE_MS = 7 * 86_400_000

const KST_OFFSET_MS = 9 * 3_600_000

/**
 * 'open'=예측 가능, 'result'=그 주 경기가 다 끝나 결과 표시, 'upcoming'=잠김(아직 안 열렸거나 이미 닫힘).
 * 예측/제출의 단위는 주(week) 하나다 — 더블 매치위크의 두 경기도 한 세션에서 함께 제출된다.
 */
export type WeekStatus = 'open' | 'upcoming' | 'result'

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
  /** 킥오프 원본 시각(ISO). 없으면 null. */
  kickoffAt: string | null
  /** 이 경기는 예측 마감(킥오프 지남/이미 시작/일정 미정) — 주차가 열려 있어도 제출 대상에서 빠진다. */
  locked: boolean
  /** 종료된 경기는 주차 상태와 무관하게 스코어를 그대로 보여준다. */
  finished: boolean
  /** 종료된 경기의 [우리, 상대] 스코어. 스코어가 없으면 null. */
  actual: [number, number] | null
}

export type WeekGroup = {
  weekNo: number
  /** '2026-34' — 목록 그룹 키이자 예측 세션 URL 파라미터. 연도가 넘어가도 안 겹친다. */
  weekKey: string
  /** '2026-08' — 목록 화면 월 필터용 */
  monthKey: string
  /** 그 주 마지막 경기 킥오프(ISO) = 세션 마감 시각. 경기 없는 주는 null. */
  deadlineAt: string | null
  status: WeekStatus
  matches: MatchView[]
}

/** 예측 플로우/완료 화면이 다루는 세션 하나 = 주차 하나. */
export type WeekSession = WeekGroup

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

/**
 * 경기 단위 마감 판정. 킥오프가 지났거나 이미 시작했거나 일정이 미정이면 그 경기는 예측 불가다.
 * 주차 세션의 마감(= 그 주 **마지막** 경기 킥오프)은 여기서 파생된다 —
 * 마지막 경기 킥오프이 지나면 잠기지 않은 경기가 하나도 남지 않기 때문이다.
 */
export function isMatchLocked(fixture: FixtureRow, now: number): boolean {
  if (!fixture.kickoff_at) return true
  return fixture.started || now >= new Date(fixture.kickoff_at).getTime()
}

/**
 * 주차 하나의 예측 세션 상태.
 * - 오픈 시작: 그 주 첫 경기 킥오프 7일 전
 * - 마감: 그 주 마지막 경기 킥오프 — 아직 시작 안 한 경기가 하나라도 남아 있으면 계속 열려 있다.
 *   그래서 첫 경기가 끝난 뒤 들어온 사용자도 남은 경기만 예측할 수 있다(2026-08-23 확정).
 * DB RLS(20260823130000_predictions_weekly_window.sql)도 같은 기준을 쓴다.
 */
export function weekStatus(fixtures: FixtureRow[], now: number): WeekStatus {
  const first = fixtures
    .map(f => (f.kickoff_at ? new Date(f.kickoff_at).getTime() : null))
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b)[0]
  if (first === undefined) return 'upcoming'

  // 제출할 경기가 하나도 안 남았으면 닫힌다. 다 끝났으면 결과 표시.
  if (fixtures.every(f => isMatchLocked(f, now))) {
    return fixtures.every(f => f.finished) ? 'result' : 'upcoming'
  }
  return now >= first - PREDICT_OPEN_BEFORE_MS ? 'open' : 'upcoming'
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
    locked: isMatchLocked(fixture, now),
    finished: fixture.finished,
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
 * 킥오프 기준 ISO 주차로 묶는다. 그룹 하나가 예측 세션 하나다.
 * 경기가 없는 중간 주차도 빈 그룹으로 채워 "이번 주는 예정된 경기가 없어요"가 그대로 나오게 한다.
 */
export function groupFixturesByWeek(fixtures: FixtureRow[], now: number): WeekGroup[] {
  const dated = fixtures
    .filter(f => !f.cancelled && f.kickoff_at)
    .sort((a, b) => (a.kickoff_at! < b.kickoff_at! ? -1 : 1))

  const groups: WeekGroup[] = []
  const byKey = new Map<string, WeekGroup>()
  const rowsByKey = new Map<string, FixtureRow[]>()

  for (const fixture of dated) {
    const kst = toKst(fixture.kickoff_at!)
    const key = weekKey(kst)
    let group = byKey.get(key)

    if (!group) {
      fillGapWeeks(groups, byKey, kst)
      group = emptyWeek(kst, key)
      byKey.set(key, group)
      rowsByKey.set(key, [])
      groups.push(group)
    }
    rowsByKey.get(key)!.push(fixture)
    group.matches.push(toMatchView(fixture, now))
  }

  // 상태와 마감 시각은 주차 단위 판정이라 그룹이 다 모인 뒤에 계산한다.
  for (const group of groups) {
    const rows = rowsByKey.get(group.weekKey) ?? []
    // dated가 킥오프 오름차순이라 마지막 원소가 그 주 마지막 경기 = 세션 마감이다.
    group.deadlineAt = rows[rows.length - 1]?.kickoff_at ?? null
    group.status = weekStatus(rows, now)
  }

  return groups
}

function emptyWeek(kst: Date, key: string): WeekGroup {
  return {
    weekNo: isoWeek(kst),
    weekKey: key,
    monthKey: `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`,
    deadlineAt: null,
    status: 'upcoming',
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

/**
 * 그 주에서 아직 제출 가능한 경기. 이미 시작·종료된 경기는 빠지므로,
 * 첫 경기가 끝난 뒤 처음 들어온 사용자는 남은 경기만 예측한다.
 */
export function submittableMatches(week: WeekGroup): MatchView[] {
  return week.matches.filter(match => !match.locked)
}

/** weekKey('2026-35')로 예측 세션(주차)을 찾는다. 없으면 null. */
export function findWeekSession(weeks: WeekGroup[], key: string): WeekSession | null {
  return weeks.find(week => week.weekKey === key) ?? null
}

/** 내가 그 주에 제출한 내역 — 스코어는 경기별, 픽은 주 단위 1세트. */
export type WeekPrediction = {
  /** fixture_id → [우리, 상대] 예측 스코어 */
  scores: Record<string, [number, number]>
  picks: Record<Position, { playerId: number; multiplier: number }>
}

/**
 * 제출은 주 단위 1회(그 주 경기 전부를 한 번에 insert)라 행이 하나라도 있으면 제출한 것이다.
 * 픽도 주 단위 1세트라 아무 행에서나 꺼내도 같다 — lib/actions/predictions.ts가 같은 값을 넣는다.
 */
export function findWeekPrediction(
  week: WeekGroup,
  myPredictions: MyPredictionMap,
): WeekPrediction | undefined {
  const scores: Record<string, [number, number]> = {}
  let picks: MyPrediction['picks'] | undefined

  for (const match of week.matches) {
    const mine = myPredictions[match.id]
    if (!mine) continue
    const [home, away] = mine.score
    // MyPrediction.score는 [홈, 원정] — 화면은 항상 [우리, 상대]로 다룬다.
    scores[match.id] = match.isHome ? [home, away] : [away, home]
    picks ??= mine.picks
  }

  return picks ? { scores, picks } : undefined
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
    weekKey: week.weekKey,
    status: week.status,
    submitted: week.matches.some(match => myPredictions[match.id]),
    // 부분 제출이 가능하다 — 첫 경기 제출 후에도 남은 경기가 있으면 다시 들어와야 한다.
    hasPending: submittableMatches(week).some(match => !myPredictions[match.id]),
    matches: week.matches.map(match => ({
      id: match.id,
      competition: match.competition || undefined,
      opponent: match.opponent,
      opponentLogoUrl: teamLogoUrl(match.opponentId),
      isHome: match.isHome,
      kickoff: match.kickoff,
      kickoffTime: match.kickoffTime,
      locked: match.locked,
      finished: match.finished,
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
