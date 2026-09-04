import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const file = source('components/composition/predict/PredictionFlowClient.tsx')

// edit 모드는 신규 prop(mode/matchIds/initialValues)으로 받는다(feature-spec.md §3.3).
test('PredictionFlowClient accepts an edit mode with explicit matchIds and initial values', () => {
  assert.match(file, /mode\?: 'submit' \| 'edit'/)
  assert.match(file, /matchIds: string\[\]/)
  assert.match(file, /initialValues\?: \{/)
})

// handleSubmit은 mode에 따라 서로 다른 서버 액션을 호출한다 — submit은 항상 insert 전용
// submitWeekPrediction, edit은 항상 updateMatchPrediction 하나(경기 1개, matchIds[0]).
test('handleSubmit calls updateMatchPrediction in edit mode and submitWeekPrediction otherwise', () => {
  assert.match(file, /updateMatchPrediction\(week\.weekKey, matchIds\[0\], input\)/)
  assert.match(file, /submitWeekPrediction\(week\.weekKey, matchIds, input\)/)
})

// 제출 후에도 킥오프 전까지 수정 가능하다는 결정과, 완료 화면 하단 "수정하기" 진입점에 맞춰
// already_submitted 문구는 "완료 화면에서 수정" 안내로 바뀌어야 한다(feature-spec.md §4).
test('already_submitted error message points to the done screen instead of claiming edits are impossible', () => {
  assert.match(file, /already_submitted: '이미 제출한 경기예요\. 완료 화면에서 수정해주세요\.'/)
  assert.doesNotMatch(file, /already_submitted: '이미 제출한 주차예요\. 제출한 예측은 수정할 수 없어요\.'/)
})

// ConfirmContent 기본 문구("제출 후에는 변경할 수 없습니다")는 투표 도메인 기준이라 승부예측에서는
// 반드시 덮어써야 한다(feature-spec.md §7-9) — description prop을 명시적으로 넘긴다.
test('the submit confirm modal overrides ConfirmContent default copy for the editable prediction domain', () => {
  assert.match(file, /description="킥오프 전까지 다시 수정할 수 있어요"/)
  assert.match(file, /title=\{mode === 'edit' \? '이대로 수정할까요\?' : '이대로 제출할까요\?'\}/)
  assert.match(file, /confirmLabel=\{mode === 'edit' \? '수정하기' : undefined\}/)
})
