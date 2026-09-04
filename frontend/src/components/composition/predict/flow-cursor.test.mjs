import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeNextFromPick,
  computePrevStep,
  startEditFromConfirm,
  isFirstFlowStep,
  flowPipIndex,
} from './flow-cursor.ts'

/**
 * 재현 테스트 (코드리뷰 2026-09-05): confirm 화면에서 경기 0(더블 매치위크의 마지막이 아닌 경기)의
 * "수정" 링크를 눌러 그 경기의 pick 단계로 들어간 뒤 "다음"을 누르면, 이미 다 채운 경기 1을 다시
 * 거치지 않고 곧장 confirm으로 돌아가야 한다. `returnToConfirm` 없이 "마지막 경기인지"만 보고
 * 진행 방향을 정하던 이전 구현은 이 케이스에서 경기 1의 score로 잘못 진행시켰다.
 */
test('REGRESSION: editing a non-last match from confirm returns straight to confirm, not through the remaining match', () => {
  const editingMatch0FromConfirm = startEditFromConfirm(0, 'pick')

  const next = computeNextFromPick(editingMatch0FromConfirm, 2)

  assert.equal(next.step, 'confirm')
  assert.equal(next.matchCursor, 0)
  assert.equal(next.returnToConfirm, false, 'confirm에 도착하면 왕복 플래그는 꺼져야 다음 편집에 영향이 없다')
})

// 대칭 케이스: 마지막 경기(matchCursor=1)를 confirm에서 고칠 때는 원래도 우연히 맞았다 — 회귀 확인용.
test('editing the last match from confirm also returns straight to confirm', () => {
  const editingLastMatchFromConfirm = startEditFromConfirm(1, 'pick')

  const next = computeNextFromPick(editingLastMatchFromConfirm, 2)

  assert.equal(next.step, 'confirm')
  assert.equal(next.matchCursor, 1)
})

// 정상 흐름(confirm에서 온 게 아님)에서는 기존 a-b-a-b-c 순서 그대로 진행해야 한다.
test('the normal a-b-a-b-c sequence still advances to the next match, not confirm early', () => {
  const firstMatchPick = { step: 'pick', matchCursor: 0, returnToConfirm: false }

  const afterFirst = computeNextFromPick(firstMatchPick, 2)
  assert.deepEqual(afterFirst, { step: 'score', matchCursor: 1, returnToConfirm: false })

  // 두 번째(마지막) 경기의 pick에서 "다음"을 누르면 이제 confirm으로 넘어간다.
  const secondMatchPick = { step: 'pick', matchCursor: 1, returnToConfirm: false }
  const afterSecond = computeNextFromPick(secondMatchPick, 2)
  assert.deepEqual(afterSecond, { step: 'confirm', matchCursor: 1, returnToConfirm: false })
})

test('single-match session (submit 1개 또는 edit) goes pick -> confirm directly regardless of returnToConfirm', () => {
  const normal = computeNextFromPick({ step: 'pick', matchCursor: 0, returnToConfirm: false }, 1)
  assert.equal(normal.step, 'confirm')

  const fromConfirm = computeNextFromPick(startEditFromConfirm(0, 'pick'), 1)
  assert.equal(fromConfirm.step, 'confirm')
})

test('goPrev: pick -> score (same match), confirm -> pick, score(first match) -> no-op', () => {
  assert.deepEqual(
    computePrevStep({ step: 'pick', matchCursor: 1, returnToConfirm: false }),
    { step: 'score', matchCursor: 1, returnToConfirm: false },
  )
  assert.deepEqual(
    computePrevStep({ step: 'confirm', matchCursor: 1, returnToConfirm: false }),
    { step: 'pick', matchCursor: 1, returnToConfirm: false },
  )
  // 진짜 첫 화면(경기 0의 score, returnToConfirm 아님) — 이전 버튼이 애초에 숨겨지므로 no-op이면 충분.
  assert.deepEqual(
    computePrevStep({ step: 'score', matchCursor: 0, returnToConfirm: false }),
    { step: 'score', matchCursor: 0, returnToConfirm: false },
  )
})

test('goPrev: score(matchCursor > 0) without returnToConfirm goes to the previous match\'s pick', () => {
  const next = computePrevStep({ step: 'score', matchCursor: 1, returnToConfirm: false })
  assert.deepEqual(next, { step: 'pick', matchCursor: 0, returnToConfirm: false })
})

test('goPrev: score during a returnToConfirm round trip cancels straight back to confirm, not another match', () => {
  // confirm에서 경기 1(matchCursor=1)을 고치러 score까지 갔다가 "이전"을 누른 경우 —
  // matchCursor > 0라고 경기 0의 pick으로 새지 않고 곧장 confirm으로 취소돼야 한다.
  const next = computePrevStep({ step: 'score', matchCursor: 1, returnToConfirm: true })
  assert.equal(next.step, 'confirm')
  assert.equal(next.returnToConfirm, false)
})

test('isFirstFlowStep: true only at match 0 score outside a returnToConfirm round trip', () => {
  assert.equal(isFirstFlowStep({ step: 'score', matchCursor: 0, returnToConfirm: false }), true)
  assert.equal(isFirstFlowStep({ step: 'score', matchCursor: 1, returnToConfirm: false }), false)
  assert.equal(isFirstFlowStep({ step: 'pick', matchCursor: 0, returnToConfirm: false }), false)
  // confirm에서 경기 0을 고치러 들어온 경우: matchCursor는 0이지만 "이전"이 confirm 취소로
  // 쓰여야 하므로 첫 화면 취급하면 안 된다(버튼이 숨으면 취소할 방법이 없어진다).
  assert.equal(isFirstFlowStep(startEditFromConfirm(0, 'score')), false)
})

test('flowPipIndex: single-match session keeps the original 3-dot 0/1/2 mapping', () => {
  assert.equal(flowPipIndex({ step: 'score', matchCursor: 0, returnToConfirm: false }, 1), 0)
  assert.equal(flowPipIndex({ step: 'pick', matchCursor: 0, returnToConfirm: false }, 1), 1)
  assert.equal(flowPipIndex({ step: 'confirm', matchCursor: 0, returnToConfirm: false }, 1), 2)
})

test('flowPipIndex: double matchweek maps to 5 dots (2 per match + confirm)', () => {
  assert.equal(flowPipIndex({ step: 'score', matchCursor: 0, returnToConfirm: false }, 2), 0)
  assert.equal(flowPipIndex({ step: 'pick', matchCursor: 0, returnToConfirm: false }, 2), 1)
  assert.equal(flowPipIndex({ step: 'score', matchCursor: 1, returnToConfirm: false }, 2), 2)
  assert.equal(flowPipIndex({ step: 'pick', matchCursor: 1, returnToConfirm: false }, 2), 3)
  assert.equal(flowPipIndex({ step: 'confirm', matchCursor: 1, returnToConfirm: false }, 2), 4)
})
