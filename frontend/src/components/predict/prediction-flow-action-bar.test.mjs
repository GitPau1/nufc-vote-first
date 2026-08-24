import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

// PredictionFlowClient의 하단 제출 바는 투표 화면과 같은 StickyActionBar를 재사용해야 한다.
// 예전엔 `fixed bottom-0 ... sm:static` 위치 로직을 이 파일에 통째로 복붙해뒀는데(2026-08-24
// 통합), 그 복제가 다시 생기면 하단 바 스타일을 두 곳에서 따로 고쳐야 하는 상태로 돌아간다.
test('prediction flow reuses StickyActionBar instead of duplicating the fixed bottom bar', () => {
  const flow = source('components/predict/PredictionFlowClient.tsx')

  assert.match(flow, /import \{ StickyActionBar \} from '@\/components\/primitives\/sticky-action-bar'/)
  assert.match(flow, /<StickyActionBar/)

  // 위치 전환 로직(fixed→static)을 이 파일이 직접 다시 쓰면 안 된다 — StickyActionBar가 소유한다.
  assert.doesNotMatch(flow, /fixed bottom-0[\s\S]{0,200}sm:static/)
})
