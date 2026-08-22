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

const { buildPredictionRow } = loadSubmitModule()

const CANDIDATES = {
  DEF: [{ id: 4, name: '보트만', position: 'DEF', multiplier: 2.1 }],
  MID: [{ id: 39, name: '기마랑이스', position: 'MID', multiplier: 1.7 }],
  FWD: [{ id: 14, name: '이사크', position: 'FWD', multiplier: 1.3 }],
}

const PICKS = { DEF: 4, MID: 39, FWD: 14 }

const HOME_MATCH = { id: '9001', isHome: true, status: 'open' }
const AWAY_MATCH = { id: '9002', isHome: false, status: 'open' }

test('경기 하나 = 1행. 배당은 후보 목록에서 스냅샷된다', () => {
  const result = buildPredictionRow(HOME_MATCH, { ourScore: 2, theirScore: 1, picks: PICKS }, CANDIDATES)

  assert.ok(!('error' in result), JSON.stringify(result))
  assert.deepEqual(
    [result.row.fixture_id, result.row.home_score, result.row.away_score],
    [9001, 2, 1],
  )
  // 배당은 클라이언트 값이 아니라 후보 목록에서 스냅샷된다.
  assert.deepEqual(
    [result.row.def_multiplier, result.row.mid_multiplier, result.row.fwd_multiplier],
    [2.1, 1.7, 1.3],
  )
  assert.equal(result.row.def_player_id, 4)
})

test('원정 경기는 [우리, 상대] → [홈, 원정]으로 뒤집힌다', () => {
  const result = buildPredictionRow(AWAY_MATCH, { ourScore: 0, theirScore: 3, picks: PICKS }, CANDIDATES)

  assert.ok(!('error' in result), JSON.stringify(result))
  assert.deepEqual([result.row.home_score, result.row.away_score], [3, 0])
})

test('마감/미완성/범위초과/모르는 선수는 전부 거절된다', () => {
  const score = { ourScore: 1, theirScore: 0 }

  assert.deepEqual(
    buildPredictionRow({ ...HOME_MATCH, status: 'result' }, { ...score, picks: PICKS }, CANDIDATES),
    { error: 'closed' },
  )
  assert.deepEqual(
    buildPredictionRow({ ...HOME_MATCH, status: 'upcoming' }, { ...score, picks: PICKS }, CANDIDATES),
    { error: 'closed' },
  )
  assert.deepEqual(
    buildPredictionRow(HOME_MATCH, { ...score, picks: { DEF: 4, MID: 39 } }, CANDIDATES),
    { error: 'incomplete' },
  )
  assert.deepEqual(
    buildPredictionRow(HOME_MATCH, { ourScore: 99, theirScore: 0, picks: PICKS }, CANDIDATES),
    { error: 'invalid_score' },
  )
  assert.deepEqual(
    buildPredictionRow(HOME_MATCH, { ourScore: 1.5, theirScore: 0, picks: PICKS }, CANDIDATES),
    { error: 'invalid_score' },
  )
  // 후보 목록에 없는 id = 조작되거나 다른 시즌 선수
  assert.deepEqual(
    buildPredictionRow(HOME_MATCH, { ...score, picks: { ...PICKS, FWD: 999 } }, CANDIDATES),
    { error: 'unknown_player' },
  )
})

test('같은 선수를 두 포지션에 넣으면 거절된다 (DB check와 같은 규칙)', () => {
  const candidates = {
    ...CANDIDATES,
    MID: [...CANDIDATES.MID, { id: 4, name: '보트만', position: 'MID', multiplier: 2.1 }],
  }
  const result = buildPredictionRow(
    HOME_MATCH,
    { ourScore: 1, theirScore: 0, picks: { DEF: 4, MID: 4, FWD: 14 } },
    candidates,
  )

  assert.deepEqual(result, { error: 'duplicate_picks' })
})
