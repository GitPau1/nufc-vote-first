import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

// `/`는 한때 `/polls` 페이지 컴포넌트를 그대로 다시 렌더해서 리다이렉트를 피했다. 지금은
// 홈 전용 화면(HomeClient — 히어로 + 3개 섹션)이 됐고, `/polls`는 탭 + 무한 스크롤 목록으로
// 남았다. 변하지 않은 계약은 "루트에서 다른 경로로 튕기지 않는다" 하나다.
test('root route renders the home screen without redirecting away from /', () => {
  const file = source('app/page.tsx')

  assert.doesNotMatch(file, /redirect\(/)
  assert.match(file, /<HomeClient sections=\{sections\} fixture=\{fixture\} \/>/)
  // 홈이 목록 화면을 재사용하던 구조로 되돌아가면 두 화면의 스크롤·탭 상태가 다시 얽힌다.
  assert.doesNotMatch(file, /@\/app\/polls\/page/)
})
