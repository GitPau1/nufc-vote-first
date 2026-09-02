import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadCandidatesModule() {
  const source = fs.readFileSync(path.join(__dirname, 'candidates.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: true },
  }).outputText

  const stubModules = {
    '@/lib/config': { SUPABASE_URL: '' },
  }

  const cjsModule = { exports: {} }
  const require = specifier => stubModules[specifier] ?? {}
  new Function('exports', 'module', 'require', compiled)(cjsModule.exports, cjsModule, require)
  return cjsModule.exports
}

const { excludeDeparted } = loadCandidatesModule()

const CANDIDATE = (id, departed) => ({
  id,
  name: `Player ${id}`,
  position: 'DEF',
  multiplier: 1.5,
  cost: 2,
  squadNumber: 1,
  nationality: null,
  age: null,
  photoUrl: null,
  departed,
})

test('excludeDeparted: departed:true 항목만 포지션별로 걷어낸다', () => {
  const candidates = {
    DEF: [CANDIDATE(1, false), CANDIDATE(2, true)],
    MID: [CANDIDATE(3, true)],
    FWD: [CANDIDATE(4, false)],
  }
  const selectable = excludeDeparted(candidates)

  assert.deepEqual(selectable.DEF.map(c => c.id), [1])
  assert.deepEqual(selectable.MID.map(c => c.id), [])
  assert.deepEqual(selectable.FWD.map(c => c.id), [4])
})

test('excludeDeparted: 원본 candidates 객체는 변경하지 않는다', () => {
  const candidates = { DEF: [CANDIDATE(1, true)], MID: [], FWD: [] }
  excludeDeparted(candidates)

  assert.equal(candidates.DEF.length, 1)
})

test('excludeDeparted: departed가 undefined인 후보는 걸러지지 않는다(과거 채점/평점 폼처럼 필드 없는 값 방어)', () => {
  const candidates = { DEF: [{ ...CANDIDATE(1, false), departed: undefined }], MID: [], FWD: [] }
  const selectable = excludeDeparted(candidates)

  assert.deepEqual(selectable.DEF.map(c => c.id), [1])
})
