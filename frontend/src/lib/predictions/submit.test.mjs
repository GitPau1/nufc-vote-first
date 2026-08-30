import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadSubmitModule() {
  const source = fs.readFileSync(path.join(__dirname, 'submit.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: true },
  }).outputText

  // submit.ts는 candidates.ts에서 POSITIONS만 값으로 가져온다(나머지는 type import라 컴파일 후 사라진다).
  const cjsModule = { exports: {} }
  const require = () => ({ POSITIONS: ['DEF', 'MID', 'FWD'] })
  new Function('exports', 'module', 'require', compiled)(cjsModule.exports, cjsModule, require)
  return cjsModule.exports
}

const { buildPredictionRows } = loadSubmitModule()

const CANDIDATES = {
  DEF: [{ id: 4, name: '보트만', position: 'DEF', multiplier: 2.1, cost: 2 }],
  MID: [{ id: 39, name: '기마랑이스', position: 'MID', multiplier: 1.7, cost: 2 }],
  FWD: [{ id: 14, name: '이사크', position: 'FWD', multiplier: 1.3, cost: 1 }],
}

const PICKS = { DEF: 4, MID: 39, FWD: 14 }
/** 픽은 경기별이다 — 경기 id마다 3포지션을 채운다. */
const picksFor = (...matchIds) => Object.fromEntries(matchIds.map(id => [id, PICKS]))

/** 경기 1개짜리 주차 */
const SINGLE = { status: 'open', matches: [{ id: '9001', isHome: true, locked: false }] }
/** 더블 매치위크 — 홈 1경기 + 원정 1경기 */
const DOUBLE = {
  status: 'open',
  matches: [
    { id: '9001', isHome: true, locked: false },
    { id: '9002', isHome: false, locked: false },
  ],
}
/** 첫 경기 킥오프이 지난 더블 매치위크 — 두 번째 경기만 제출 가능 */
const DOUBLE_FIRST_LOCKED = {
  status: 'open',
  matches: [
    { id: '9001', isHome: true, locked: true },
    { id: '9002', isHome: false, locked: false },
  ],
}

test('경기 1개인 주차 = 1행. 배당은 후보 목록에서 스냅샷된다', () => {
  const result = buildPredictionRows(
    SINGLE,
    { scores: { 9001: [2, 1] }, picks: picksFor('9001') },
    CANDIDATES,
  )

  assert.ok(!('error' in result), JSON.stringify(result))
  assert.equal(result.rows.length, 1)
  assert.deepEqual(
    [result.rows[0].fixture_id, result.rows[0].home_score, result.rows[0].away_score],
    [9001, 2, 1],
  )
  // 배당은 클라이언트 값이 아니라 후보 목록에서 스냅샷된다.
  assert.deepEqual(
    [result.rows[0].def_multiplier, result.rows[0].mid_multiplier, result.rows[0].fwd_multiplier],
    [2.1, 1.7, 1.3],
  )
  // 비용도 후보 목록에서 스냅샷된다(점수엔 무관, 예산·기록용).
  assert.deepEqual(
    [result.rows[0].def_cost, result.rows[0].mid_cost, result.rows[0].fwd_cost],
    [2, 2, 1],
  )
  assert.equal(result.rows[0].def_player_id, 4)
})

test('더블 매치위크 = 2행. 픽은 경기별로 따로 들어간다', () => {
  const candidates = {
    ...CANDIDATES,
    FWD: [...CANDIDATES.FWD, { id: 10, name: '고든', position: 'FWD', multiplier: 1.6, cost: 1 }],
  }
  const result = buildPredictionRows(
    DOUBLE,
    {
      scores: { 9001: [2, 1], 9002: [0, 3] },
      // 두 경기의 공격수 픽이 다르다 — 경기별 픽이 그대로 각 행에 들어가야 한다.
      picks: { 9001: PICKS, 9002: { ...PICKS, FWD: 10 } },
    },
    candidates,
  )

  assert.ok(!('error' in result), JSON.stringify(result))
  assert.deepEqual(result.rows.map(r => r.fixture_id), [9001, 9002])
  // 원정 경기는 [우리, 상대] → [홈, 원정]으로 뒤집힌다
  assert.deepEqual([result.rows[1].home_score, result.rows[1].away_score], [3, 0])
  assert.deepEqual([result.rows[0].fwd_player_id, result.rows[0].fwd_multiplier], [14, 1.3])
  assert.deepEqual([result.rows[1].fwd_player_id, result.rows[1].fwd_multiplier], [10, 1.6])
  // 수비/미드는 두 경기 같은 선수를 골랐다 — 경기끼리는 중복이 허용된다.
  assert.deepEqual(result.rows.map(r => r.def_player_id), [4, 4])
})

test('한 경기의 픽이 비어 있으면 거절된다', () => {
  assert.deepEqual(
    buildPredictionRows(
      DOUBLE,
      { scores: { 9001: [2, 1], 9002: [0, 3] }, picks: picksFor('9001') },
      CANDIDATES,
    ),
    { error: 'incomplete' },
  )
})

test('남은 경기 중 하나라도 스코어가 없으면 거절된다', () => {
  assert.deepEqual(
    buildPredictionRows(DOUBLE, { scores: { 9001: [2, 1] }, picks: picksFor('9001', '9002') }, CANDIDATES),
    { error: 'incomplete' },
  )
})

test('킥오프이 지난 경기는 제외되고 남은 경기만 제출된다', () => {
  // 첫 경기 스코어를 보내도 무시하고 남은 경기만 행으로 나간다
  const result = buildPredictionRows(
    DOUBLE_FIRST_LOCKED,
    { scores: { 9001: [9, 9], 9002: [0, 3] }, picks: picksFor('9001', '9002') },
    CANDIDATES,
  )

  assert.ok(!('error' in result), JSON.stringify(result))
  assert.deepEqual(result.rows.map(r => r.fixture_id), [9002])
  assert.deepEqual([result.rows[0].home_score, result.rows[0].away_score], [3, 0])

  // 잠긴 경기 스코어가 없어도 통과해야 한다
  const withoutLocked = buildPredictionRows(
    DOUBLE_FIRST_LOCKED,
    { scores: { 9002: [0, 3] }, picks: picksFor('9002') },
    CANDIDATES,
  )
  assert.ok(!('error' in withoutLocked), JSON.stringify(withoutLocked))

  // 전부 잠기면 제출할 게 없다
  assert.deepEqual(
    buildPredictionRows(
      { status: 'open', matches: DOUBLE_FIRST_LOCKED.matches.map(m => ({ ...m, locked: true })) },
      { scores: { 9002: [0, 3] }, picks: picksFor('9002') },
      CANDIDATES,
    ),
    { error: 'closed' },
  )
})

test('마감/미완성/범위초과/모르는 선수는 전부 거절된다', () => {
  const scores = { 9001: [1, 0] }
  const picks = picksFor('9001')

  assert.deepEqual(
    buildPredictionRows({ ...SINGLE, status: 'result' }, { scores, picks }, CANDIDATES),
    { error: 'closed' },
  )
  assert.deepEqual(
    buildPredictionRows({ ...SINGLE, status: 'upcoming' }, { scores, picks }, CANDIDATES),
    { error: 'closed' },
  )
  // 경기가 없는 주차는 제출 대상이 아니다
  assert.deepEqual(
    buildPredictionRows({ status: 'open', matches: [] }, { scores, picks }, CANDIDATES),
    { error: 'closed' },
  )
  assert.deepEqual(
    buildPredictionRows(SINGLE, { scores, picks: { 9001: { DEF: 4, MID: 39 } } }, CANDIDATES),
    { error: 'incomplete' },
  )
  assert.deepEqual(
    buildPredictionRows(SINGLE, { scores: { 9001: [99, 0] }, picks }, CANDIDATES),
    { error: 'invalid_score' },
  )
  assert.deepEqual(
    buildPredictionRows(SINGLE, { scores: { 9001: [1.5, 0] }, picks }, CANDIDATES),
    { error: 'invalid_score' },
  )
  // 후보 목록에 없는 id = 조작되거나 다른 시즌 선수
  assert.deepEqual(
    buildPredictionRows(SINGLE, { scores, picks: { 9001: { ...PICKS, FWD: 999 } } }, CANDIDATES),
    { error: 'unknown_player' },
  )
})

test('같은 선수를 두 포지션에 넣으면 거절된다 (DB check와 같은 규칙)', () => {
  const candidates = {
    ...CANDIDATES,
    MID: [...CANDIDATES.MID, { id: 4, name: '보트만', position: 'MID', multiplier: 2.1, cost: 2 }],
  }
  const result = buildPredictionRows(
    SINGLE,
    { scores: { 9001: [1, 0] }, picks: { 9001: { DEF: 4, MID: 4, FWD: 14 } } },
    candidates,
  )

  assert.deepEqual(result, { error: 'duplicate_picks' })
})

test('한 경기 3픽 비용 합이 5툰을 넘으면 거절된다 (경기별 예산)', () => {
  const candidates = {
    DEF: [{ id: 4, name: '보트만', position: 'DEF', multiplier: 2.1, cost: 3 }],
    MID: [{ id: 39, name: '기마랑이스', position: 'MID', multiplier: 1.7, cost: 3 }],
    FWD: [{ id: 14, name: '이사크', position: 'FWD', multiplier: 1.3, cost: 1 }],
  }
  // 3 + 3 + 1 = 7 > 5
  assert.deepEqual(
    buildPredictionRows(SINGLE, { scores: { 9001: [2, 1] }, picks: picksFor('9001') }, candidates),
    { error: 'over_budget' },
  )
})

test('비용 합이 정확히 5툰이면 통과한다 (경계값)', () => {
  const candidates = {
    DEF: [{ id: 4, name: '보트만', position: 'DEF', multiplier: 2.1, cost: 3 }],
    MID: [{ id: 39, name: '기마랑이스', position: 'MID', multiplier: 1.7, cost: 1 }],
    FWD: [{ id: 14, name: '이사크', position: 'FWD', multiplier: 1.3, cost: 1 }],
  }
  const result = buildPredictionRows(SINGLE, { scores: { 9001: [2, 1] }, picks: picksFor('9001') }, candidates)
  assert.ok(!('error' in result), JSON.stringify(result))
})
