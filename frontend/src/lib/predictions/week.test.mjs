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
  NUFC_TEAM_ID,
} = loadWeekModule()

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
  // 상태는 주차 단위 하나 — 기준은 그 주 첫 경기 킥오프다.
  assert.equal(weeks[0].status, 'open')
  assert.equal(weeks[0].firstKickoffAt, '2026-08-23T15:30:00+00:00')
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
  assert.deepEqual(weeks[1].firstKickoffAt, null)
  assert.equal(weeks[1].status, 'upcoming')
})

test('주차 상태는 첫 경기 킥오프 기준으로 갈린다', () => {
  const first = fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' })
  const second = fixture({ fixture_id: 2, kickoff_at: '2026-08-29T18:45:00+00:00' })

  // 첫 킥오프 7일 이내 = 오픈, 그보다 이르면 예정
  assert.equal(weekStatus([first, second], KICKOFF - 86_400_000), 'open')
  assert.equal(weekStatus([first, second], KICKOFF - 30 * 86_400_000), 'upcoming')
  // 첫 경기가 시작되면 두 번째 경기가 남아 있어도 그 주 전체가 닫힌다
  assert.equal(weekStatus([{ ...first, started: true }, second], KICKOFF - 3_600_000), 'upcoming')
  assert.equal(weekStatus([first, second], KICKOFF + 1), 'upcoming')
  // 그 주 경기가 전부 끝나야 결과
  assert.equal(
    weekStatus([{ ...first, finished: true }, { ...second, finished: true }], KICKOFF + 1),
    'result',
  )
  assert.equal(weekStatus([{ ...first, finished: true }, second], KICKOFF + 1), 'upcoming')
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

test('findWeekPrediction: 주 단위 제출은 경기별 스코어 + 픽 1세트로 읽힌다', () => {
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

  // 그 주 경기가 한 번에 들어가고 픽은 모든 행에 같은 값으로 복사된다.
  const submitted = {
    1: { score: [2, 1], picks: SUBMITTED_PICKS },
    2: { score: [0, 3], picks: SUBMITTED_PICKS },
  }
  const mine = findWeekPrediction(week, submitted)
  assert.deepEqual(mine.scores, { 1: [2, 1], 2: [3, 0] })
  assert.deepEqual(mine.picks, SUBMITTED_PICKS)

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
  assert.equal(week.weekKey, '2026-35')
  assert.deepEqual(week.matches[0].myResult, { predicted: [2, 1] })
  assert.deepEqual(week.matches[1].myResult, { predicted: [0, 0] })
})
