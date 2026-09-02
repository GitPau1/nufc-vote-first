import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(__dirname, 'poll-edit-eligibility.ts')
const statusPath = path.join(__dirname, 'status.ts')

function loadModule(filePath, resolveImport) {
  const source = fs.readFileSync(filePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: true,
    },
  }).outputText

  const cjsModule = { exports: {} }
  const fakeRequire = resolveImport ?? (() => ({}))
  const fn = new Function('exports', 'module', 'require', compiled)
  fn(cjsModule.exports, cjsModule, fakeRequire)
  return cjsModule.exports
}

function loadEligibilityModule() {
  const statusModule = loadModule(statusPath)
  return loadModule(sourcePath, (specifier) => {
    if (specifier.includes('polls/status')) return statusModule
    return {}
  })
}

test('canAccessPollEdit: 작성자 본인/active → true', () => {
  const { canAccessPollEdit } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  assert.equal(canAccessPollEdit({
    status: 'active',
    scheduled_at: null,
    closes_at: '2026-05-29T11:00:00.000Z',
    created_by: 'user-1',
  }, { userId: 'user-1', isAdmin: false }, now), true)
})

test('canAccessPollEdit: 관리자/active(비작성자) → true', () => {
  const { canAccessPollEdit } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  assert.equal(canAccessPollEdit({
    status: 'active',
    scheduled_at: null,
    closes_at: '2026-05-29T11:00:00.000Z',
    created_by: 'user-1',
  }, { userId: 'admin-1', isAdmin: true }, now), true)
})

test('canAccessPollEdit: 제3자/active → false', () => {
  const { canAccessPollEdit } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  assert.equal(canAccessPollEdit({
    status: 'active',
    scheduled_at: null,
    closes_at: '2026-05-29T11:00:00.000Z',
    created_by: 'user-1',
  }, { userId: 'user-2', isAdmin: false }, now), false)
})

test('canAccessPollEdit: scheduled은 작성자·관리자도 false', () => {
  const { canAccessPollEdit } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  const poll = {
    status: 'scheduled',
    scheduled_at: '2026-05-29T12:00:00.000Z',
    closes_at: '2026-05-29T13:00:00.000Z',
    created_by: 'user-1',
  }
  assert.equal(canAccessPollEdit(poll, { userId: 'user-1', isAdmin: false }, now), false)
  assert.equal(canAccessPollEdit(poll, { userId: 'admin-1', isAdmin: true }, now), false)
})

test('canAccessPollEdit: closed+작성자 → true', () => {
  const { canAccessPollEdit } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  assert.equal(canAccessPollEdit({
    status: 'closed',
    scheduled_at: null,
    closes_at: '2026-05-29T09:00:00.000Z',
    created_by: 'user-1',
  }, { userId: 'user-1', isAdmin: false }, now), true)
})

test('getEditablePollFields: active → title/description/thumbnail_url', () => {
  const { getEditablePollFields } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  assert.deepEqual(getEditablePollFields({
    status: 'active',
    scheduled_at: null,
    closes_at: '2026-05-29T11:00:00.000Z',
    created_by: 'user-1',
  }, now), ['title', 'description', 'thumbnail_url'])
})

test('getEditablePollFields: closed → thumbnail_url만', () => {
  const { getEditablePollFields } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  assert.deepEqual(getEditablePollFields({
    status: 'closed',
    scheduled_at: null,
    closes_at: '2026-05-29T09:00:00.000Z',
    created_by: 'user-1',
  }, now), ['thumbnail_url'])
})

test('getEditablePollFields: status active + closes_at 과거(자동 마감 처리 전) → thumbnail_url만', () => {
  const { getEditablePollFields } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  // DB status는 아직 'active'인데 마감 시각이 지난 경우 — getEffectivePollStatus가 이걸
  // 'closed'로 취급해야, 이 값을 그대로 쓰는 화면(edit page/폼)의 배너·서브카피 문구가
  // 실제 편집 가능 필드와 어긋나지 않는다.
  assert.deepEqual(getEditablePollFields({
    status: 'active',
    scheduled_at: null,
    closes_at: '2026-05-29T09:00:00.000Z',
    created_by: 'user-1',
  }, now), ['thumbnail_url'])
})

test('getEditablePollFields: scheduled → 빈 배열', () => {
  const { getEditablePollFields } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  assert.deepEqual(getEditablePollFields({
    status: 'scheduled',
    scheduled_at: '2026-05-29T12:00:00.000Z',
    closes_at: '2026-05-29T13:00:00.000Z',
    created_by: 'user-1',
  }, now), [])
})

test('validatePollEditPayload: active에서 title/thumbnail_url → ok', () => {
  const { validatePollEditPayload } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  const result = validatePollEditPayload({
    status: 'active',
    scheduled_at: null,
    closes_at: '2026-05-29T11:00:00.000Z',
    created_by: 'user-1',
  }, ['title', 'thumbnail_url'], now)
  assert.deepEqual(result, { ok: true })
})

test('validatePollEditPayload: closed에서 title → 거절', () => {
  const { validatePollEditPayload } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  const result = validatePollEditPayload({
    status: 'closed',
    scheduled_at: null,
    closes_at: '2026-05-29T09:00:00.000Z',
    created_by: 'user-1',
  }, ['title'], now)
  assert.deepEqual(result, { ok: false, disallowedKey: 'title' })
})

test('validatePollEditPayload: closed에서 thumbnail_url → ok', () => {
  const { validatePollEditPayload } = loadEligibilityModule()
  const now = new Date('2026-05-29T10:00:00.000Z')
  const result = validatePollEditPayload({
    status: 'closed',
    scheduled_at: null,
    closes_at: '2026-05-29T09:00:00.000Z',
    created_by: 'user-1',
  }, ['thumbnail_url'], now)
  assert.deepEqual(result, { ok: true })
})
