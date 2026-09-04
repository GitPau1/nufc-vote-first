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

// 더블 매치위크 "둘 다 예측하기" 재설계(feature-spec.md §9, 2026-09-04) — "그대로 적용"(픽 복사)은
// 고정 순서 a-b-a-b-c 흐름으로 대체돼 완전히 폐기됐다. 되살아나면 회귀다.
test('copyPicks ("그대로 적용") is fully removed, not just unused', () => {
  assert.doesNotMatch(file, /function copyPicks/)
  assert.doesNotMatch(file, /copyUsedRef/)
  // 실제 렌더되는 버튼 텍스트만 잡는다 — 폐기 사실을 설명하는 주석에서 이름을 언급하는 것은 허용.
  assert.doesNotMatch(file, />\s*그대로 적용\s*</)
})

// score/pick 단계는 pending.length와 무관하게 matchCursor가 가리키는 경기 하나만 보여준다.
// 실제 전이 규칙(다음 경기로 넘어갈지, confirm으로 갈지, "이전"이 어디로 되돌리는지)은
// flow-cursor.ts로 분리돼 flow-cursor.test.mjs가 로직 자체를 실행해 검증한다(코드리뷰
// 2026-09-05 — 소스 문자열 검사로는 confirm에서 온 왕복 같은 실제 동작을 못 잡는다).
test('score/pick steps are driven by a matchCursor, delegating transition rules to flow-cursor.ts', () => {
  assert.match(file, /const \[matchCursor, setMatchCursor\] = useState\(0\)/)
  assert.match(file, /const \[returnToConfirm, setReturnToConfirm\] = useState\(false\)/)
  assert.match(file, /const currentMatch = pending\[matchCursor\]/)
  assert.match(
    file,
    /import \{\s*computeNextFromPick,\s*computePrevStep,\s*startEditFromConfirm,\s*isFirstFlowStep,\s*flowPipIndex,\s*\} from '\.\/flow-cursor'/,
  )
  assert.match(file, /function goNextFromPick\(\)/)
  assert.match(file, /computeNextFromPick\(\{ step, matchCursor, returnToConfirm \}, pending\.length\)/)
  assert.match(file, /function goPrev\(\)/)
  assert.match(file, /computePrevStep\(\{ step, matchCursor, returnToConfirm \}\)/)
  // confirm의 "수정" 링크는 커서만 옮기는 게 아니라 왕복 표시(returnToConfirm)까지 켜야 한다
  // (코드리뷰 2026-09-05 버그 수정 — 안 그러면 마지막이 아닌 경기를 고칠 때 나머지 경기를
  // 다시 다 눌러야 confirm으로 돌아왔다).
  assert.match(file, /startEditFromConfirm\(i, 'score'\)/)
  assert.match(file, /startEditFromConfirm\(i, 'pick'\)/)
})

// ProgressPips는 이제 경기 수 × 2 + 1 개의 점을 동적으로 받는다(경기 하나짜리 세션은 3개로 기존과 동일).
test('ProgressPips receives a dynamic dot count instead of always assuming 3 fixed steps', () => {
  assert.match(file, /const totalSteps = pending\.length \* 2 \+ 1/)
  assert.match(file, /<ProgressPips current=\{step\} total=\{totalSteps\} activeIndex=\{currentStepIndex\} \/>/)
})

// 코드리뷰 2026-09-04 버그 수정: "겹쳐 쌓아 높이 고정" 그리드 트릭에 confirm까지 계속 끼어 있으면
// (더블 매치위크에서 confirm이 경기 2개를 다 보여줘 훨씬 커진 뒤로) score/pick 컨테이너까지
// confirm 높이로 고정돼버린다. confirm은 그 트릭에서 빼고 조건부로 자기 콘텐츠 크기만큼만 렌더한다.
test('the height-locking grid stacks only score/pick, not confirm (which sizes to its own content)', () => {
  // score/pick만 겹쳐 쌓는다 — STEP_META 전체(confirm 포함)를 도는 게 아니라 두 키만 명시한다.
  assert.match(file, /\(\['score', 'pick'\] as const\)\.map\(key => \(/)
  // confirm은 별도 분기에서 조건부로 그 내용만 렌더한다(같은 그리드 칸에 숨겨서 얹어두지 않는다).
  assert.match(file, /step === 'confirm' \? \(/)
  assert.match(file, /<div className="w-full">\{stepBody\('confirm'\)\}<\/div>/)
  // confirm이 겹쳐-쌓기용 sm:invisible로 숨겨진 채 계속 그려지는 옛 패턴이 되살아나면 회귀다.
  assert.doesNotMatch(file, /STEP_META\.map\(\{ key \}\) => \(/)
})
