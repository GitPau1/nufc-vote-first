import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

test('public Supabase query modules use Next cache for first-request TTFB', () => {
  for (const file of ['polls.ts', 'player-pick-one.ts', 'fixtures.ts', 'predictions.ts']) {
    assert.match(source(file), /unstable_cache/, `${file} should use unstable_cache`)
  }
})

// 회귀: 조회 '실패'가 빈 결과로 1시간 캐시되던 버그(2026-08-30). pick_cost 마이그레이션 직후
// PostgREST 스키마 캐시 어긋남으로 선수 조회가 실패했는데, 그 빈 목록이 unstable_cache에 굳어
// DB를 고친 뒤에도 "선택할 수 있는 선수가 없어요"가 재시작 전까지 계속 떴다.
// 성공만 캐시하고 실패는 캐시 밖에서 EMPTY로 떨어뜨려 다음 요청이 즉시 재시도하게 한다.
test('squads.ts does not cache fetch errors — errors throw out of the cache, caller returns EMPTY uncached', () => {
  const squads = source('squads.ts')
  // 캐시되는 함수는 조회 실패 시 캐시 가능한 EMPTY를 반환하지 않고 던진다.
  assert.match(
    squads,
    /throw (error|seasonError)/,
    'cached fetch must throw on query error instead of returning a cacheable EMPTY',
  )
  // 캐시 래퍼를 감싸는 export는 실패를 잡아 EMPTY를 캐시 밖에서 반환한다.
  assert.match(
    squads,
    /catch[\s\S]{0,200}return EMPTY/,
    'exported getPickCandidates must catch cache errors and return EMPTY uncached',
  )
})

// 회귀: pick-candidates 캐시(1시간)에 태그가 없어 관리자 동기화 버튼을 눌러도 비워지지
// 않던 문제. tags가 있어야 lib/actions/sync-fixtures.ts의 revalidateTag가 먹는다.
test('squads.ts pick-candidates cache carries a revalidateTag tag', () => {
  const squads = source('squads.ts')
  assert.match(
    squads,
    /tags:\s*\[.*pick-candidates.*\]/,
    'getPickCandidatesCached must declare tags: [\'pick-candidates\'] so admin sync can revalidateTag it',
  )
})
