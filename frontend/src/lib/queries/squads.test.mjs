import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadSquadsModule() {
  const source = fs.readFileSync(path.join(__dirname, 'squads.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: true },
  }).outputText

  // excludeDeparted는 lib/predictions/candidates.ts 소유(re-export만 여기 있음) —
  // 이 테스트는 toPickCandidates만 다루므로 그 함수는 스텁으로 충분하다.
  const stubModules = {
    'next/cache': { unstable_cache: fn => fn },
    '@/lib/supabase/server': { createPublicClient: () => ({}) },
    '@/lib/config': { IS_MOCK: false },
    '@/lib/predictions/candidates': {
      POSITIONS: ['DEF', 'MID', 'FWD'],
      isPickPosition: position => ['DEF', 'MID', 'FWD'].includes(position),
      ageFrom: () => null,
      playerPhotoUrl: () => null,
      excludeDeparted: candidates => candidates,
    },
  }

  const cjsModule = { exports: {} }
  const require = specifier => stubModules[specifier] ?? {}
  new Function('exports', 'module', 'require', compiled)(cjsModule.exports, cjsModule, require)
  return cjsModule.exports
}

const { toPickCandidates } = loadSquadsModule()

const ROW = (fotmobPlayerId, position, multiplier, isActive) => ({
  fotmob_player_id: fotmobPlayerId,
  name: `Player ${fotmobPlayerId}`,
  name_ko: null,
  shirt_number: 1,
  position,
  nationality_name: null,
  date_of_birth: null,
  prediction_multiplier: multiplier,
  pick_cost: 2,
  is_active: isActive,
})

test('toPickCandidates: is_active=false 행은 departed:true로 매핑된다', () => {
  const rows = [ROW(1, 'DEF', 2.0, true), ROW(2, 'DEF', 1.5, false)]
  const candidates = toPickCandidates(rows, Date.now())

  assert.equal(candidates.DEF.find(c => c.id === 1).departed, false)
  assert.equal(candidates.DEF.find(c => c.id === 2).departed, true)
})

test('toPickCandidates: GK 행은 걸러지고, 나머지 포지션은 전부(이적 여부 무관) 포함된다', () => {
  const rows = [ROW(1, 'GK', 1.1, true), ROW(2, 'FWD', 1.3, false)]
  const candidates = toPickCandidates(rows, Date.now())

  assert.equal(candidates.DEF.length + candidates.MID.length + candidates.FWD.length, 1)
  assert.equal(candidates.FWD.length, 1)
  assert.equal(candidates.FWD[0].departed, true)
})
