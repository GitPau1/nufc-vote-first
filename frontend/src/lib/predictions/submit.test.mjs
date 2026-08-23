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
  DEF: [{ id: 4, name: '보트만', position: 'DEF', multiplier: 2.1 }],
  MID: [{ id: 39, name: '기마랑이스', position: 'MID', multiplier: 1.7 }],
  FWD: [{ id: 14, name: '이사크', position: 'FWD', multiplier: 1.3 }],
}

const PICKS = { DEF: 4, MID: 39, FWD: 14 }

/** 경기 1개짜리 주차 */
const SINGLE = { status: 'open', matches: [{ id: '9001', isHome: true }] }
/** 더블 매치위크 — 홈 1경기 + 원정 1경기 */
const DOUBLE = {
  status: 'open',
  matches: [
    { id: '9001', isHome: true },
    { id: '9002', isHome: false },
  ],
}

test('경기 1개인 주차 = 1행. 배당은 후보 목록에서 스냅샷된다', () => {
  const result = buildPredictionRows(SINGLE, { scores: { 9001: [2, 1] }, picks: PICKS }, CANDIDATES)

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
  assert.equal(result.rows[0].def_player_id, 4)
})

test('더블 매치위크 = 2행. 픽은 주 단위 1세트라 두 행에 같은 값이 들어간다', () => {
  const result = buildPredictionRows(
    DOUBLE,
    { scores: { 9001: [2, 1], 9002: [0, 3] }, picks: PICKS },
    CANDIDATES,
  )

  assert.ok(!('error' in result), JSON.stringify(result))
  assert.deepEqual(result.rows.map(r => r.fixture_id), [9001, 9002])
  // 원정 경기는 [우리, 상대] → [홈, 원정]으로 뒤집힌다
  assert.deepEqual([result.rows[1].home_score, result.rows[1].away_score], [3, 0])
  // 픽/배당은 두 행이 동일 — 주 단위 픽이 경기별로 채점되어 합산된다(FR-017)
  for (const row of result.rows) {
    assert.deepEqual(
      [row.def_player_id, row.mid_player_id, row.fwd_player_id],
      [4, 39, 14],
    )
    assert.deepEqual([row.def_multiplier, row.mid_multiplier, row.fwd_multiplier], [2.1, 1.7, 1.3])
  }
})

test('그 주 경기 중 하나라도 스코어가 없으면 거절된다 (부분 제출 방지)', () => {
  assert.deepEqual(
    buildPredictionRows(DOUBLE, { scores: { 9001: [2, 1] }, picks: PICKS }, CANDIDATES),
    { error: 'incomplete' },
  )
})

test('마감/미완성/범위초과/모르는 선수는 전부 거절된다', () => {
  const scores = { 9001: [1, 0] }

  assert.deepEqual(
    buildPredictionRows({ ...SINGLE, status: 'result' }, { scores, picks: PICKS }, CANDIDATES),
    { error: 'closed' },
  )
  assert.deepEqual(
    buildPredictionRows({ ...SINGLE, status: 'upcoming' }, { scores, picks: PICKS }, CANDIDATES),
    { error: 'closed' },
  )
  // 경기가 없는 주차는 제출 대상이 아니다
  assert.deepEqual(
    buildPredictionRows({ status: 'open', matches: [] }, { scores, picks: PICKS }, CANDIDATES),
    { error: 'incomplete' },
  )
  assert.deepEqual(
    buildPredictionRows(SINGLE, { scores, picks: { DEF: 4, MID: 39 } }, CANDIDATES),
    { error: 'incomplete' },
  )
  assert.deepEqual(
    buildPredictionRows(SINGLE, { scores: { 9001: [99, 0] }, picks: PICKS }, CANDIDATES),
    { error: 'invalid_score' },
  )
  assert.deepEqual(
    buildPredictionRows(SINGLE, { scores: { 9001: [1.5, 0] }, picks: PICKS }, CANDIDATES),
    { error: 'invalid_score' },
  )
  // 후보 목록에 없는 id = 조작되거나 다른 시즌 선수
  assert.deepEqual(
    buildPredictionRows(SINGLE, { scores, picks: { ...PICKS, FWD: 999 } }, CANDIDATES),
    { error: 'unknown_player' },
  )
})

test('같은 선수를 두 포지션에 넣으면 거절된다 (DB check와 같은 규칙)', () => {
  const candidates = {
    ...CANDIDATES,
    MID: [...CANDIDATES.MID, { id: 4, name: '보트만', position: 'MID', multiplier: 2.1 }],
  }
  const result = buildPredictionRows(
    SINGLE,
    { scores: { 9001: [1, 0] }, picks: { DEF: 4, MID: 4, FWD: 14 } },
    candidates,
  )

  assert.deepEqual(result, { error: 'duplicate_picks' })
})
