import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(__dirname, 'profile-icons.ts')

// profile-icons.ts는 '@/lib/config'(SUPABASE_URL/IS_MOCK)와 'next/cache'(unstable_cache)를
// 실제로 import한다 — 이 경로 별칭·Next 런타임 모듈은 plain node로 못 푸니
// storage-cleanup.test.mjs와 같은 transpile+mock-require 방식으로 돌린다.
// resolveProfileIconUrl은 순수 함수라 이 두 의존성을 흉내만 내도 정상 동작한다.
function loadProfileIconsModule(supabaseUrl) {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: true,
    },
  }).outputText

  const cjsModule = { exports: {} }
  const fakeRequire = (specifier) => {
    if (specifier.includes('lib/config')) return { SUPABASE_URL: supabaseUrl, IS_MOCK: !supabaseUrl }
    if (specifier === 'next/cache') return { unstable_cache: (fn) => fn }
    return {}
  }
  const fn = new Function('exports', 'module', 'require', compiled)
  fn(cjsModule.exports, cjsModule, fakeRequire)
  return cjsModule.exports
}

const SUPABASE_URL = 'https://example.supabase.co'

test('resolveProfileIconUrl: 임계값 미만 점수는 가장 낮은 등급을 적용한다', () => {
  const { resolveProfileIconUrl } = loadProfileIconsModule(SUPABASE_URL)
  assert.equal(
    resolveProfileIconUrl(499, [0, 500, 2000]),
    `${SUPABASE_URL}/storage/v1/object/public/profile-icons/0.webp`
  )
})

test('resolveProfileIconUrl: 임계값에 정확히 도달하면 해당 등급으로 올라간다', () => {
  const { resolveProfileIconUrl } = loadProfileIconsModule(SUPABASE_URL)
  assert.equal(
    resolveProfileIconUrl(500, [0, 500, 2000]),
    `${SUPABASE_URL}/storage/v1/object/public/profile-icons/500.webp`
  )
})

test('resolveProfileIconUrl: 최고 임계값을 넘어도 최고 등급에 머문다', () => {
  const { resolveProfileIconUrl } = loadProfileIconsModule(SUPABASE_URL)
  assert.equal(
    resolveProfileIconUrl(999999, [0, 500, 2000]),
    `${SUPABASE_URL}/storage/v1/object/public/profile-icons/2000.webp`
  )
})

test('resolveProfileIconUrl: thresholds가 비어있으면 null(아바타 폴백)', () => {
  const { resolveProfileIconUrl } = loadProfileIconsModule(SUPABASE_URL)
  assert.equal(resolveProfileIconUrl(1000, []), null)
})

test('resolveProfileIconUrl: totalPoints보다 작거나 같은 threshold가 하나도 없으면 null', () => {
  const { resolveProfileIconUrl } = loadProfileIconsModule(SUPABASE_URL)
  assert.equal(resolveProfileIconUrl(100, [500, 2000]), null)
})

test('resolveProfileIconUrl: 정렬 안 된 입력도 정상 동작한다', () => {
  const { resolveProfileIconUrl } = loadProfileIconsModule(SUPABASE_URL)
  assert.equal(
    resolveProfileIconUrl(1500, [2000, 0, 500]),
    `${SUPABASE_URL}/storage/v1/object/public/profile-icons/500.webp`
  )
})
