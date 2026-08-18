import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(__dirname, 'vote-eligibility.ts')

function loadEligibilityModule() {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: true,
    },
  }).outputText

  const cjsModule = { exports: {} }
  const fn = new Function('exports', 'module', compiled)
  fn(cjsModule.exports, cjsModule)
  return cjsModule.exports
}

test('allows voting only for active polls inside the voting window', () => {
  const { canSubmitVote } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')

  assert.equal(canSubmitVote({
    status: 'active',
    scheduled_at: null,
    closes_at: '2026-05-29T11:00:00.000Z',
  }, now), true)
})

test('blocks scheduled, closed, not-yet-open, and expired polls', () => {
  const { canSubmitVote } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')

  assert.equal(canSubmitVote({
    status: 'scheduled',
    scheduled_at: '2026-05-29T09:00:00.000Z',
    closes_at: '2026-05-29T11:00:00.000Z',
  }, now), false)

  assert.equal(canSubmitVote({
    status: 'closed',
    scheduled_at: null,
    closes_at: '2026-05-29T11:00:00.000Z',
  }, now), false)

  assert.equal(canSubmitVote({
    status: 'active',
    scheduled_at: '2026-05-29T10:30:00.000Z',
    closes_at: '2026-05-29T11:00:00.000Z',
  }, now), false)

  assert.equal(canSubmitVote({
    status: 'active',
    scheduled_at: null,
    closes_at: '2026-05-29T09:59:59.000Z',
  }, now), false)
})
