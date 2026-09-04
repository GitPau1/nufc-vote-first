import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

// submitWeekPrediction은 이제 matchIds를 명시적으로 받아 그 경기만 buildPredictionRows에 넘겨야
// 한다 — week.matches 전체를 넘기면 이미 제출된 다른 경기의 스코어까지 요구해 incomplete가 난다
// (승부예측 제출 수정·부분 제출 feature-spec.md §2.3.1).
test('submitWeekPrediction narrows buildPredictionRows targets to the given matchIds', () => {
  const file = source('lib/actions/predictions.ts')

  assert.match(
    file,
    /export async function submitWeekPrediction\(\s*weekKey: string,\s*matchIds: string\[\],\s*input: PredictionInput,/,
  )
  assert.match(file, /week\.matches\.filter\(match => matchIds\.includes\(match\.id\)\)/)
  assert.match(
    file,
    /buildPredictionRows\(\{ status: week\.status, matches: targets \}, input, candidates\)/,
  )
})

// 경기 단위 수정 경로 — design-brief §9 질문3=B: 경기 하나만, 다른 경기 행은 안 건드림.
test('updateMatchPrediction is a single-match update path, separate from the insert-only submit action', () => {
  const file = source('lib/actions/predictions.ts')

  assert.match(file, /export async function updateMatchPrediction\(/)
  assert.match(file, /\.update\(\{/)
  assert.match(file, /\.eq\('user_id', user\.id\)/)
  assert.match(file, /\.eq\('fixture_id', fixtureId\)/)
  // buildPredictionRows를 재사용한다 — submit.ts 자체는 변경하지 않는다.
  assert.match(
    file,
    /buildPredictionRows\(\{ status: week\.status, matches: target \}, input, candidates\)/,
  )
})

// RLS 위반은 UPDATE에서 에러 코드로 안 나오고 0행 갱신으로 나타난다 — 갱신된 행 개수로 판정해야 한다.
test('updateMatchPrediction treats a zero-row update result as closed, not a thrown error', () => {
  const file = source('lib/actions/predictions.ts')

  assert.match(file, /if \(!data \|\| data\.length === 0\) return \{ error: 'closed' \}/)
})

// 분석 이벤트 확장(§5)은 스킵 확정 — updateMatchPrediction은 prediction_submitted와 달리
// 서버 이벤트를 보내지 않는다.
test('updateMatchPrediction does not send a new analytics event (scope skipped)', () => {
  const file = source('lib/actions/predictions.ts')
  const updateFn = file.slice(file.indexOf('export async function updateMatchPrediction'))

  assert.doesNotMatch(updateFn, /trackServerEvent\('prediction_updated'/)
})
