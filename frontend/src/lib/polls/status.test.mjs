import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(__dirname, 'status.ts')

function loadStatusModule() {
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

test('treats expired polls as closed for display', () => {
  const { getEffectivePollStatus } = loadStatusModule()
  const now = new Date('2026-06-01T10:00:00.000Z')

  assert.equal(getEffectivePollStatus({
    status: 'active',
    scheduled_at: null,
    closes_at: '2026-06-01T09:59:59.000Z',
  }, now), 'closed')
})

test('treats due scheduled polls as active before closing', () => {
  const { getEffectivePollStatus } = loadStatusModule()
  const now = new Date('2026-06-01T10:00:00.000Z')

  assert.equal(getEffectivePollStatus({
    status: 'scheduled',
    scheduled_at: '2026-06-01T09:00:00.000Z',
    closes_at: '2026-06-01T11:00:00.000Z',
  }, now), 'active')
})

test('keeps future scheduled polls scheduled', () => {
  const { getEffectivePollStatus } = loadStatusModule()
  const now = new Date('2026-06-01T10:00:00.000Z')

  assert.equal(getEffectivePollStatus({
    status: 'scheduled',
    scheduled_at: '2026-06-01T10:30:00.000Z',
    closes_at: '2026-06-01T11:00:00.000Z',
  }, now), 'scheduled')
})
