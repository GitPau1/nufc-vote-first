/**
 * fixtures 행 → 승부예측 목록 화면용 주차 그룹 변환 (순수 함수, DB 접근 없음).
 * 조회는 lib/queries/fixtures.ts, 화면은 components/composition/predict/*.
 */

import type { PredictWeek } from '@/components/composition/predict/MatchWeekList'
import type { MyPredictionMap } from '@/lib/queries/predictions'
import type { Position } from '@/lib/predictions/candidates'
import { SUPABASE_URL } from '@/lib/config'

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
  /** '8월 23일' */
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
  /** '2627-1'(정규 시즌) 또는 '2627-0-2'(프리시즌) — 목록 그룹 키이자 예측 세션 URL 파라미터. */
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

/**
 * 엠블럼은 public `player-photos` 버킷의 `team-logos/{FotMob 팀 id}.png`다 — fixtures의 팀 id가
 * 그대로 파일명이라 별도 매핑이 없다. mock 모드(주소 없음)에서는 null → TeamBadge 이니셜 폴백.
 */
export function teamLogoUrl(teamId: number): string | null {
  return SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/player-photos/team-logos/${teamId}.png`
    : null
}

/** UTC 시각을 한국 기준 달력 날짜로 옮긴 Date(한국은 DST 없음). */
/** 표시·주차 계산용 KST 시프트. Storybook의 fixture mock도 이 함수로 weekKey를 만든다. */
export function toKst(iso: string): Date {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS)
}

const SEASON_CODE = '2627' // 2026-27시즌, 시즌 내내 고정 — 다음 시즌 시작 전 갱신 필요(feature-spec §8)

const SEASON_WEEK1_ANCHOR = Date.UTC(2026, 7, 23) // 2026-08-23(일) 00:00, KST 기준 날짜로 취급

// 이번 시즌(2026-27) 프리시즌 전용 — 실제 친선경기가 있는 주만 시간순으로 나열(2026-09-04
// supabase db query --linked 실측). 다음 시즌 프리시즌 일정이 나오면 갱신 필요(feature-spec §8).
// 닫힌 나눗셈 공식을 못 쓰는 이유는 feature-spec §2-2-보충 참고(친선경기 없는 08/02주가
// 끼어 있어 날짜 산술만으로는 "몇 번째 프리시즌 주"인지 못 구함).
const PRESEASON_WEEK_ANCHORS = [
  Date.UTC(2026, 6, 19), // 07/19주
  Date.UTC(2026, 6, 26), // 07/26주
  Date.UTC(2026, 7, 9),  // 08/09주 (3경기 그룹)
  Date.UTC(2026, 7, 16), // 08/16주
]

// 2025-26시즌 최종전(fixture_id=4813748, PL, kickoff 2026-05-24 15:00 UTC = KST 2026-05-25)
// 하나만을 위한 예외 앵커(2026-09-04 신규 발견, feature-spec §9). PRESEASON_WEEK_ANCHORS(07/19주
// 시작)보다 훨씬 이전 날짜라 정규 화이트리스트로 커버되지 않는다 — 이 시즌(2526) 데이터가 이
// 경기 1건뿐이라(DB 실측) 별도 시즌 코드 + 고정 순번(1)으로 명시 처리한다. 다음 시즌 전환 때
// 갱신할 대상이 아니다(과거 시즌 낙오 경기 전용 상수 — SEASON_WEEK1_ANCHOR/PRESEASON_WEEK_ANCHORS와
// 달리 "시즌마다 갱신" 성격이 없음).
const PREVIOUS_SEASON_CODE = '2526'
const PREVIOUS_SEASON_STRAY_ANCHOR = Date.UTC(2026, 4, 24) // 2026-05-24(일)
const PREVIOUS_SEASON_STRAY_WEEK_NO = 1

function sundayAnchorStart(kst: Date): Date {
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()) // getUTCDay(): 0=일요일
  return d
}

/**
 * ISO 8601 규칙이 아니라 시즌 앵커 기준 순번이다(2026-09-04부터). 정규 시즌(2026-08-23
 * 이후)은 1부터 양수, 프리시즌은 -1(1번째 프리시즌 주)부터 음수 — 두 구간이 절대 같은
 * 숫자로 겹치지 않는다. 2025-26시즌 낙오 경기(PREVIOUS_SEASON_STRAY_ANCHOR)는 1을 반환하지만
 * weekKey()가 별도 시즌 코드("2526")를 붙이므로 정규 시즌 1주차("2627-1")와 문자열 값은
 * 겹치지 않는다. 세 화이트리스트(정규 시즌 앵커·PRESEASON_WEEK_ANCHORS·낙오 경기 앵커) 어디에도
 * 없는 날짜(친선경기 없는 빈 주 포함)는 null.
 */
export function isoWeek(kst: Date): number | null {
  const start = sundayAnchorStart(kst).getTime()
  if (start === PREVIOUS_SEASON_STRAY_ANCHOR) return PREVIOUS_SEASON_STRAY_WEEK_NO
  if (start >= SEASON_WEEK1_ANCHOR) {
    return Math.floor((start - SEASON_WEEK1_ANCHOR) / (7 * 86_400_000)) + 1
  }
  const idx = PRESEASON_WEEK_ANCHORS.indexOf(start)
  return idx === -1 ? null : -(idx + 1)
}

/**
 * 그룹 키. 정규 시즌 "2627-N", 프리시즌 "2627-0-M"(M = -isoWeek()), 2025-26시즌 낙오 경기는
 * "2526-1"(isoWeek()의 부호 기반 매핑과 별개로 여기서 직접 분기 — isoWeek()가 반환하는 1이
 * 정규 시즌 1주차의 1과 숫자로는 같기 때문에, weekKey()가 앵커 자체를 다시 확인해 시즌 코드를
 * 결정해야 "2526-1"과 "2627-1"이 안 섞인다). 화이트리스트 밖 날짜는 null — 예전엔 여기서
 * throw했지만(2026-09-04) "그 경기 하나만 목록에서 빠지고 페이지 전체는 안 깨지는" 안전망으로
 * 바꿨다(feature-spec §10). 호출부는 null을 반드시 처리해야 한다.
 */
export function weekKey(kst: Date): string | null {
  if (sundayAnchorStart(kst).getTime() === PREVIOUS_SEASON_STRAY_ANCHOR) {
    return `${PREVIOUS_SEASON_CODE}-${PREVIOUS_SEASON_STRAY_WEEK_NO}`
  }
  const n = isoWeek(kst)
  if (n === null) return null
  return n > 0 ? `${SEASON_CODE}-${n}` : `${SEASON_CODE}-0-${-n}`
}

/**
 * 지금 시각이 속한 시즌 앵커 주차 키. 트래킹·집계에서 "이번 주"를 판정할 때 쓴다.
 *
 * weekKey()는 이름 그대로 **+9h 시프트된 Date**를 기대한다(toKst 참고). 호출부에서 그 변환을
 * 빠뜨리고 weekKey(new Date())를 부르면 UTC 달력 기준으로 계산되어 KST 00:00~09:00이 전날로
 * 밀리고, 월요일 오전엔 지난 주차로 잡힌다 — 주간 지표가 조용히 어긋나는 실수를 막는 래퍼다.
 */
export function currentWeekKey(now: Date = new Date()): string | null {
  return weekKey(new Date(now.getTime() + KST_OFFSET_MS))
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
    kickoff: kst ? `${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일` : '',
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
 * 킥오프 기준 시즌 앵커 주차로 묶는다. 그룹 하나가 예측 세션 하나다.
 * 경기가 없는 중간 주차도 빈 그룹으로 채워 "이번 주는 예정된 경기가 없어요"가 그대로 나오게 한다
 * (단, 화이트리스트 밖이라 weekKey를 못 구하는 프리시즌의 빈 주는 채우지 않고 건너뛴다 — fillGapWeeks 참고).
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
    const weekNo = isoWeek(kst)
    const key = weekKey(kst)
    if (weekNo === null || key === null) {
      // 세 화이트리스트(정규 시즌 앵커·PRESEASON_WEEK_ANCHORS·낙오 경기 앵커) 어디에도 없는
      // 과거 날짜다(2026-09-04 확정, feature-spec §10) — 앵커 상수 갱신이 빠졌다는 뜻이지만,
      // 경기 하나 때문에 목록 페이지 전체가 죽으면 안 되므로 이 경기만 조용히 빼고 넘어간다.
      console.error(`groupFixturesByWeek: 주차를 알 수 없는 경기(fixture_id=${fixture.fixture_id}) — 건너뜀`)
      continue
    }
    let group = byKey.get(key)

    if (!group) {
      fillGapWeeks(groups, byKey, kst)
      group = emptyWeek(kst, key, weekNo)
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

function emptyWeek(kst: Date, key: string, weekNo: number): WeekGroup {
  return {
    weekNo,
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

  const cursor = new Date(kst.getTime())
  cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay()) // 이번 주 일요일로 정렬
  const gaps: WeekGroup[] = []

  for (let i = 0; i < 12; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - 7)
    const weekNo = isoWeek(cursor)
    if (weekNo === null) continue // 프리시즌의 빈 주(친선경기 없음) — placeholder를 만들지 않고 계속 더 앞으로
    // weekNo가 non-null이면 weekKey()도 같은 앵커 조회로 non-null이 나온다(둘 다 sundayAnchorStart
    // 기준 같은 화이트리스트를 본다) — 타입만 좁혀준다(로직 변경 아님, feature-spec §2-5와 같은 패턴).
    const key = weekKey(cursor)!
    if (byKey.has(key)) break
    const gap = emptyWeek(cursor, key, weekNo)
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

/** weekKey('2627-1')로 예측 세션(주차)을 찾는다. 없으면 null. */
export function findWeekSession(weeks: WeekGroup[], key: string): WeekSession | null {
  return weeks.find(week => week.weekKey === key) ?? null
}

/** 내가 그 주에 제출한 내역 — 스코어도 픽도 경기별이다(2026-08-23 확정). */
export type WeekPrediction = {
  /** fixture_id → [우리, 상대] 예측 스코어 */
  scores: Record<string, [number, number]>
  /** fixture_id → 그 경기의 포지션별 픽 */
  picks: Record<string, Record<Position, { playerId: number; multiplier: number }>>
}

/**
 * 제출은 주 단위 1회(그 주 경기 전부를 한 번에 insert)라 행이 하나라도 있으면 제출한 것이다.
 * 픽은 경기별로 다를 수 있어 경기마다 따로 담는다 — 더블 매치위크에서 두 경기의 픽이 서로 다르다.
 */
export function findWeekPrediction(
  week: WeekGroup,
  myPredictions: MyPredictionMap,
): WeekPrediction | undefined {
  const scores: Record<string, [number, number]> = {}
  const picks: WeekPrediction['picks'] = {}
  let found = false

  for (const match of week.matches) {
    const mine = myPredictions[match.id]
    if (!mine) continue
    const [home, away] = mine.score
    // MyPrediction.score는 [홈, 원정] — 화면은 항상 [우리, 상대]로 다룬다.
    scores[match.id] = match.isHome ? [home, away] : [away, home]
    picks[match.id] = mine.picks
    found = true
  }

  return found ? { scores, picks } : undefined
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
