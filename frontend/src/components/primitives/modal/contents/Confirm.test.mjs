import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const file = source('components/primitives/modal/contents/Confirm.tsx')

// "제출 후에는 변경할 수 없습니다"는 투표 도메인 기준이라 승부예측(제출 후에도 킥오프 전까지
// 수정 가능)과 모순된다 — 이번에 description prop으로 덮어쓸 수 있게 열었다(feature-spec.md §7-9).
// 기본값은 그대로 유지해 기존 투표 호출부(PollClient 등)는 변경 없이 동작해야 한다.
test('ConfirmContent description is overridable but keeps the poll-domain default', () => {
  assert.match(file, /description\?: string/)
  assert.match(file, /description = '제출 후에는 변경할 수 없습니다'/)
  assert.match(file, /<SheetDescription>\{description\}<\/SheetDescription>/)
})
