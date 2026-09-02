import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(__dirname, 'storage-cleanup.ts')

// storage-cleanup.ts는 '@/lib/config'를 실제로 import한다(SUPABASE_URL 사용) — 이 경로 별칭은
// plain node로 못 푸니 vote-eligibility.test.mjs/rating.test.mjs와 같은 transpile+mock-require
// 방식으로 돌린다. optimize.test.mjs처럼 .ts를 직접 import하는 방식은 여기선 안 통한다(경로
// 별칭이 없는 optimize.ts만 그 방식이 가능하다).
function loadStorageCleanupModule(supabaseUrl) {
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
    if (specifier.includes('lib/config')) return { SUPABASE_URL: supabaseUrl }
    return {}
  }
  const fn = new Function('exports', 'module', 'require', compiled)
  fn(cjsModule.exports, cjsModule, fakeRequire)
  return cjsModule.exports
}

const BUCKET = 'player-photos'
const SUPABASE_URL = 'https://example.supabase.co'

test('getStorageObjectPath: 정상 공개 URL → 경로 추출 성공', () => {
  const { getStorageObjectPath } = loadStorageCleanupModule(SUPABASE_URL)
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/poll-thumbnails/user-1/123-abc.webp`
  assert.equal(getStorageObjectPath(url, BUCKET), 'poll-thumbnails/user-1/123-abc.webp')
})

test('getStorageObjectPath: 외부 도메인 URL → null', () => {
  const { getStorageObjectPath } = loadStorageCleanupModule(SUPABASE_URL)
  assert.equal(getStorageObjectPath('https://cdn.example.com/foo.webp', BUCKET), null)
})

test('getStorageObjectPath: 다른 버킷 URL → null', () => {
  const { getStorageObjectPath } = loadStorageCleanupModule(SUPABASE_URL)
  const url = `${SUPABASE_URL}/storage/v1/object/public/other-bucket/poll-thumbnails/user-1/123-abc.webp`
  assert.equal(getStorageObjectPath(url, BUCKET), null)
})

test('getStorageObjectPath: SUPABASE_URL이 빈 문자열(목 모드)이면 항상 null', () => {
  const { getStorageObjectPath } = loadStorageCleanupModule('')
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/poll-thumbnails/user-1/123-abc.webp`
  assert.equal(getStorageObjectPath(url, BUCKET), null)
})

test('getStorageObjectPath: 허용 폴더 밖(players/)이면 null', () => {
  const { getStorageObjectPath } = loadStorageCleanupModule(SUPABASE_URL)
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/players/isak.webp`
  assert.equal(getStorageObjectPath(url, BUCKET, ['poll-thumbnails']), null)
})

test('getStorageObjectPath: 허용 폴더 안(poll-thumbnails/)이면 통과', () => {
  const { getStorageObjectPath } = loadStorageCleanupModule(SUPABASE_URL)
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/poll-thumbnails/user-1/123-abc.webp`
  assert.equal(getStorageObjectPath(url, BUCKET, ['poll-thumbnails']), 'poll-thumbnails/user-1/123-abc.webp')
})

test('resolveOldThumbnailToDelete: 옛 URL 없음 → null', () => {
  const { resolveOldThumbnailToDelete } = loadStorageCleanupModule(SUPABASE_URL)
  assert.equal(resolveOldThumbnailToDelete(null, 'https://x', BUCKET), null)
})

test('resolveOldThumbnailToDelete: 옛=새 URL 동일 → null', () => {
  const { resolveOldThumbnailToDelete } = loadStorageCleanupModule(SUPABASE_URL)
  const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/poll-thumbnails/user-1/123-abc.webp`
  assert.equal(resolveOldThumbnailToDelete(url, url, BUCKET), null)
})

test('resolveOldThumbnailToDelete: 외부 URL → null', () => {
  const { resolveOldThumbnailToDelete } = loadStorageCleanupModule(SUPABASE_URL)
  assert.equal(resolveOldThumbnailToDelete('https://cdn.example.com/foo.webp', null, BUCKET), null)
})

test('resolveOldThumbnailToDelete: 정상 케이스 → { path } 반환', () => {
  const { resolveOldThumbnailToDelete } = loadStorageCleanupModule(SUPABASE_URL)
  const oldUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/poll-thumbnails/user-1/old.webp`
  const newUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/poll-thumbnails/user-1/new.webp`
  assert.deepEqual(resolveOldThumbnailToDelete(oldUrl, newUrl, BUCKET), { path: 'poll-thumbnails/user-1/old.webp' })
})

test('resolveOldThumbnailToDelete: 허용 폴더(players/) 밖이면 null — 선수 사진 오삭제 방지', () => {
  const { resolveOldThumbnailToDelete } = loadStorageCleanupModule(SUPABASE_URL)
  const oldUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/players/isak.webp`
  assert.equal(resolveOldThumbnailToDelete(oldUrl, null, BUCKET, ['poll-thumbnails']), null)
})
