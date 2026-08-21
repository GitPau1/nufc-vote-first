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

const { groupFixturesByWeek, fixtureStatus, weekSessionStatus, toMatchView, toPredictWeeks, NUFC_TEAM_ID } =
  loadWeekModule()

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

test('같은 주 경기 2개는 한 주차로 묶인다 (더블 매치위크)', () => {
  const weeks = groupFixturesByWeek(
    [
      fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' }),
      fixture({ fixture_id: 2, kickoff_at: '2026-08-26T18:45:00+00:00', competition_name: 'EFL Cup' }),
    ],
    KICKOFF - 86_400_000,
  )

  assert.equal(weeks.length, 1)
  assert.deepEqual(weeks[0].matches.map(m => m.id), ['1', '2'])
  assert.equal(weeks[0].monthKey, '2026-08')
  assert.equal(weeks[0].weekKey, '2026-35')
  // 예측 세션은 주 단위 — 첫 킥오프 7일 전부터 열린다.
  assert.equal(weeks[0].status, 'open')
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
})

test('상태는 종료 > 진행중/킥오프 경과 > 오픈(7일 이내) > 예정 순으로 갈린다', () => {
  assert.equal(fixtureStatus(fixture({ finished: true }), KICKOFF + 1), 'result')
  assert.equal(fixtureStatus(fixture({ started: true }), KICKOFF + 1), 'upcoming')
  assert.equal(fixtureStatus(fixture(), KICKOFF - 86_400_000), 'open')
  assert.equal(fixtureStatus(fixture(), KICKOFF - 30 * 86_400_000), 'upcoming')
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
  // 한국시간(UTC+9) 기준 표기
  assert.equal(view.kickoff, '8/23')
  assert.equal(view.kickoffTime, '오후 7:30')
})

test('주 세션 상태: 전부 종료면 결과, 첫 킥오프가 지나면 잠김', () => {
  const first = fixture({ fixture_id: 1, kickoff_at: '2026-08-23T15:30:00+00:00' })
  const second = fixture({ fixture_id: 2, kickoff_at: '2026-08-26T18:45:00+00:00' })

  assert.equal(weekSessionStatus([first, second], KICKOFF - 30 * 86_400_000), 'upcoming')
  assert.equal(weekSessionStatus([first, second], KICKOFF - 86_400_000), 'open')
  // 첫 경기가 끝났어도 둘째가 남아 있으면 예측은 닫히고 결과도 아직 아니다.
  assert.equal(weekSessionStatus([{ ...first, finished: true }, second], KICKOFF + 86_400_000), 'upcoming')
  assert.equal(
    weekSessionStatus([{ ...first, finished: true }, { ...second, finished: true }], KICKOFF + 10 * 86_400_000),
    'result',
  )
  assert.equal(weekSessionStatus([], KICKOFF), 'upcoming')
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
  // MatchView는 [우리, 상대] = [3, 1] → PredictWeekMatch는 [홈, 원정] = [1, 3]
  assert.deepEqual(week.matches[0].actual, [1, 3])
  assert.equal(week.matches[0].isHome, false)
  assert.match(week.matches[0].opponentLogoUrl, /teamlogo\/8586\.png$/)
  assert.equal(week.myResult, undefined)
})
