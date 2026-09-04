import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const file = source('components/composition/predict/PredictionMatchSelect.tsx')

// 제출/수정 공용 컴포넌트로 확장됐다(feature-spec.md §3.5) — mode prop으로 문맥을 가른다.
test('PredictionMatchSelect is a submit/edit dual-mode component', () => {
  assert.match(file, /mode: 'submit' \| 'edit'/)
})

// "둘 다 예측하기"는 경기가 정확히 2개일 때만 보인다 — 3개 이상은 확정된 카피가 없다
// (근거 미확인, feature-spec.md §3.5).
test('the combined "both" button only appears for exactly two matches, never in edit mode', () => {
  assert.match(file, /mode === 'submit' && matches\.length === 2/)
  assert.match(file, /둘 다 예측하기/)
})

// submit 문맥은 ?match=, edit 문맥은 ?edit=로 이동한다 — 서로 다른 서버 액션 경로로 갈라진다.
test('submit mode links to ?match= and edit mode links to ?edit=', () => {
  assert.match(file, /\?match=\$\{match\.id\}/)
  assert.match(file, /\?edit=\$\{match\.id\}/)
})

// edit 문맥 카드는 기존 제출 스코어를 같이 보여준다.
test('edit mode cards show the existing submitted score', () => {
  assert.match(file, /existing = prediction\?\.scores\[match\.id\]/)
  assert.match(file, /현재 예측/)
})
