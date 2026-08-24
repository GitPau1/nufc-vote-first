import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadWeekModule() {
  const source = fs.readFileSync(path.join(__dirname, 'week.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: true },
  }).outputText

  const cjsModule = { exports: {} }
  new Function('exports', 'module', compiled)(cjsModule.exports, cjsModule)
  return cjsModule.exports
}

const {
  groupFixturesByWeek,
  weekStatus,
  toMatchView,
  toPredictWeeks,
  findWeekSession,
  findWeekPrediction,
  submittableMatches,
  weekKey,
  currentWeekKey,
  NUFC_TEAM_ID,
} = loadWeekModule()

test('currentWeekKey: KST 자정 직후는 UTC 기준 전날이어도 새 주차로 잡힌다', () => {
  // 2026-08-24(월) 00:30 KST = 2026-08-23(일) 15:30 UTC.
  // KST 달력으로는 34주차가 끝나고 35주차가 시작된 시점이다.
  const mondayEarlyKst = new Date('2026-08-23T15:30:00Z')

  assert.equal(currentWeekKey(mondayEarlyKst), '2026-35')
  // +9h 시프트를 빠뜨리면 UTC 달력(일요일)로 계산되어 지난 주차가 나온다 — 이게 막으려는 버그다.
  assert.equal(weekKey(mondayEarlyKst), '2026-34')
})

test('currentWeekKey: 주 중간은 UTC/KST 어느 쪽으로 계산해도 같은 주차다', () => {
  // 2026-08-20(목) 12:00 KST = 같은 날 03:00 UTC — 34주차(8/17 월 ~ 8/23 일).
  const thursdayNoonKst = new Date('2026-08-20T03:00:00Z')

  assert.equal(currentWeekKey(thursdayNoonKst), '2026-34')
})

test('currentWeekKey: 연말 경계에서 ISO 연도가 주차를 따라간다', () => {
  // 2026-12-28(월) 09:00 KST = 2026-12-28 00:00 UTC — ISO 53주차.
  assert.equal(currentWeekKey(new Date('2026-12-28T00:00:00Z')), '2026-53')
})

function fixture(overrides) {
  return {
    fixture_id: 1,
    competition_name: 'Premier League',
    kickoff_at: '2026-08-23T15:30:00+00:00',
    home_id: NUFC_TEAM_ID,
    home_name: 'Newcastle',
    home_score: null,
    away_id: 10260,
    away_name: 'Liverpool',
    away_score: null,
    started: false,
    finished: false,
    cancelled: false,
    ...overrides,
  }
}

const KICKOFF = new Date('2026-08-23T15:30:00Z').getTime()

test('같은 주 경기 2개는 한 예측 세션(주차)으로 묶인다 (더블 매치위크)', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-29T18:45:00+00:00', competition_name: 'EFL Cup' }),
    ],
    KICKOFF - 86_400_000,
  )

  assert.equal(weeks.length, 1)
  assert.deepEqual(weeks[0].matches.map(m => m.id), ['1', '2'])
  assert.equal(weeks[0].monthKey, '2026-08')
  assert.equal(weeks[0].weekKey, '2026-35')
  // 상태는 주차 단위 하나. 마감은 그 주 마지막 경기 킥오프다.
  assert.equal(weeks[0].status, 'open')
  assert.equal(weeks[0].deadlineAt, '2026-08-29T18:45:00+00:00')
})

test('경기 없는 중간 주차는 빈 그룹으로 채워진다', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' }),
      fixture({ fixture_id: 2, kickoff_at: '2026-09-14T19:00:00+00:00' }),
    ],
    KICKOFF,
  )

  assert.equal(weeks.length, 4)
  assert.deepEqual(weeks.map(w => w.matches.length), [1, 0, 0, 1])
  assert.deepEqual(weeks[1].deadlineAt, null)
  assert.equal(weeks[1].status, 'upcoming')
})

test('주차는 첫 경기 킥오프 7일 전에 열리고 마지막 경기 킥오프에 닫힌다', () => {
  const first = fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' })
  const second = fixture({ fixture_id: 2, kickoff_at: '2026-08-29T18:45:00+00:00' })
  const LAST_KICKOFF = new Date('2026-08-29T18:45:00Z').getTime()

  // 첫 킥오프 7일 이내 = 오픈, 그보다 이르면 예정
  assert.equal(weekStatus([first, second], KICKOFF - 86_400_000), 'open')
  assert.equal(weekStatus([first, second], KICKOFF - 30 * 86_400_000), 'upcoming')
  // 첫 경기가 시작·종료돼도 두 번째 경기가 남아 있으면 세션은 열려 있다
  assert.equal(weekStatus([{ ...first, started: true }, second], KICKOFF + 1), 'open')
  assert.equal(weekStatus([{ ...first, started: true, finished: true }, second], KICKOFF + 1), 'open')
  // 마지막 경기 킥오프이 지나면 닫힌다
  assert.equal(
    weekStatus([{ ...first, finished: true }, second], LAST_KICKOFF + 1),
    'upcoming',
  )
  // 그 주 경기가 전부 끝나야 결과
  assert.equal(
    weekStatus([{ ...first, finished: true }, { ...second, finished: true }], LAST_KICKOFF + 1),
    'result',
  )
})

test('submittableMatches: 이미 시작된 경기는 빠지고 남은 경기만 제출 대상이다', () => {
  const [week] = groupFixturesByWeek(
    [
      // 첫 경기는 이미 끝났고, 두 번째 경기는 아직 남아 있다
      fixture({ fixture_id: 1, kickoff_at: '2026-08-24T15:30:00+00:00', started: true, finished: true, home_score: 2, away_score: 0 }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-29T18:45:00+00:00' }),
    ],
    new Date('2026-08-26T00:00:00Z').getTime(),
  )

  assert.equal(week.status, 'open')
  assert.deepEqual(week.matches.map(m => m.locked), [true, false])
  assert.deepEqual(submittableMatches(week).map(m => m.id), ['2'])
})

test('원정 경기는 상대/스코어가 뒤집혀 우리 관점으로 나온다', () => {
  const view = toMatchView(
    fixture({
      home_id: 8586,
      home_name: 'Tottenham',
      away_id: NUFC_TEAM_ID,
      away_name: 'Newcastle',
      home_score: 1,
      away_score: 3,
      started: true,
      finished: true,
      kickoff_at: '2026-08-23T10:30:00+00:00',
    }),
    KICKOFF,
  )

  assert.equal(view.isHome, false)
  assert.equal(view.opponent, 'Tottenham')
  assert.deepEqual(view.actual, [3, 1])
  assert.equal(view.finished, true)
  // 한국시간(UTC+9) 기준 표기
  assert.equal(view.kickoff, '8/23')
  assert.equal(view.kickoffTime, '오후 7:30')
})

test('findWeekSession: weekKey로 주차 세션을 찾는다', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-26T18:45:00+00:00' }),
      fixture({ fixture_id: 3, kickoff_at: '2026-09-02T18:45:00+00:00' }),
    ],
    KICKOFF - 86_400_000,
  )

  // 1·2는 같은 주(2026-35), 3은 다음 주 → 세션이 갈린다
  assert.deepEqual(findWeekSession(weeks, '2026-35').matches.map(m => m.id), ['1', '2'])
  const session = findWeekSession(weeks, '2026-36')
  assert.deepEqual(session.matches.map(m => m.id), ['3'])
  assert.equal(session.weekNo, 36)
  assert.equal(findWeekSession(weeks, '1999-01'), null)
})

test('toPredictWeeks: 원정 경기 스코어는 [홈, 원정] 순서로 되돌아간다', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({
        fixture_id: 1,
        home_id: 8586,
        home_name: 'Tottenham',
        away_id: NUFC_TEAM_ID,
        away_name: 'Newcastle',
        home_score: 1,
        away_score: 3,
        started: true,
        finished: true,
      }),
    ],
    KICKOFF + 86_400_000,
  )

  const [week] = toPredictWeeks(weeks)
  assert.equal(week.status, 'result')
  assert.equal(week.submitted, false)
  assert.equal(week.hasPending, false)
  assert.equal(week.matches[0].finished, true)
  // MatchView는 [우리, 상대] = [3, 1] → PredictWeekMatch는 [홈, 원정] = [1, 3]
  assert.deepEqual(week.matches[0].actual, [1, 3])
  assert.equal(week.matches[0].isHome, false)
  assert.match(week.matches[0].opponentLogoUrl, /teamlogo\/8586\.png$/)
  assert.equal(week.matches[0].myResult, undefined)
})

const SUBMITTED_PICKS = {
  DEF: { playerId: 4, multiplier: 2.1 },
  MID: { playerId: 39, multiplier: 1.7 },
  FWD: { playerId: 14, multiplier: 1.3 },
}

test('findWeekPrediction: 주 단위 제출은 경기별 스코어 + 경기별 픽으로 읽힌다', () => {
  const [week] = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-24T15:30:00+00:00' }),
      // 원정 경기 — 저장된 [홈, 원정]이 화면용 [우리, 상대]로 뒤집혀야 한다.
      fixture({
        fixture_id: 2,
        kickoff_at: '2026-08-27T18:45:00+00:00',
        home_id: 8586,
        home_name: 'Tottenham',
        away_id: NUFC_TEAM_ID,
        away_name: 'Newcastle',
      }),
    ],
    KICKOFF,
  )

  // 그 주 경기가 한 번에 들어가고, 픽은 경기별로 다를 수 있다.
  const otherPicks = { ...SUBMITTED_PICKS, FWD: { playerId: 10, multiplier: 1.6 } }
  const submitted = {
    1: { score: [2, 1], picks: SUBMITTED_PICKS },
    2: { score: [0, 3], picks: otherPicks },
  }
  const mine = findWeekPrediction(week, submitted)
  assert.deepEqual(mine.scores, { 1: [2, 1], 2: [3, 0] })
  assert.deepEqual(mine.picks, { 1: SUBMITTED_PICKS, 2: otherPicks })

  assert.equal(findWeekPrediction(week, {}), undefined)
})

test('toPredictWeeks: 제출 여부는 주차 단위, 예측 스코어는 경기별로 붙는다', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-24T15:30:00+00:00' }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-27T18:45:00+00:00' }),
    ],
    KICKOFF,
  )

  const submitted = {
    1: { score: [2, 1], picks: SUBMITTED_PICKS },
    2: { score: [0, 0], picks: SUBMITTED_PICKS },
  }
  const [week] = toPredictWeeks(weeks, submitted)
  assert.equal(week.submitted, true)
  assert.equal(week.hasPending, false)
  assert.equal(week.weekKey, '2026-35')
  assert.deepEqual(week.matches[0].myResult, { predicted: [2, 1] })
  assert.deepEqual(week.matches[1].myResult, { predicted: [0, 0] })
})

test('toPredictWeeks: 첫 경기만 제출된 상태면 남은 경기가 pending으로 남는다', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-24T15:30:00+00:00', started: true, finished: true, home_score: 2, away_score: 0 }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-29T18:45:00+00:00' }),
    ],
    new Date('2026-08-26T00:00:00Z').getTime(),
  )

  // 첫 경기가 끝난 뒤 처음 들어온 사용자 = 아무것도 제출 안 함
  const [fresh] = toPredictWeeks(weeks)
  assert.equal(fresh.status, 'open')
  assert.equal(fresh.submitted, false)
  assert.equal(fresh.hasPending, true)

  // 남은 경기까지 제출하면 pending이 사라진다
  const [done] = toPredictWeeks(weeks, { 2: { score: [1, 1], picks: SUBMITTED_PICKS } })
  assert.equal(done.submitted, true)
  assert.equal(done.hasPending, false)
})
