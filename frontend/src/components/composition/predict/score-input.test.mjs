import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

/**
 * 스코어 입력의 상한 가드 회귀 방지.
 *
 * 원래는 하한만 두 겹(버튼 disabled + Math.max)으로 막고 상한은 어디에도 없어서,
 * `+`를 21번 누르면 서버 왕복 후에야 invalid_score를 받았다. 상한도 같은 두 겹 +
 * 화면 안전망까지 갖추도록 잠근다.
 */

test('score stepper guards both bounds, not just the lower one', () => {
  const file = source('components/composition/predict/PredictionFlowClient.tsx')

  // 서버 검증과 같은 상수를 공유한다 — 20을 하드코딩하지 않는다
  // (같은 import에 BUDGET 등 다른 상수가 함께 와도 된다 — 툰 예산제에서 BUDGET을 추가로 가져온다)
  assert.match(file, /import \{[^}]*\bMAX_SCORE\b[^}]*\} from '@\/lib\/predictions\/submit'/)
  assert.doesNotMatch(file, /value >= 20/)

  // 버튼 가드가 +/− 대칭
  assert.match(file, /aria-label="점수 증가"[\s\S]{0,120}disabled=\{value >= MAX_SCORE\}/)
  assert.match(file, /aria-label="점수 감소"[\s\S]{0,120}disabled=\{value <= 0\}/)

  // changeScore가 양쪽을 클램프
  assert.match(file, /Math\.min\(MAX_SCORE, Math\.max\(0, next\[side\] \+ delta\)\)/)
})

test('out-of-range score surfaces an error and blocks advancing instead of failing on the server', () => {
  const file = source('components/composition/predict/PredictionFlowClient.tsx')

  assert.match(file, /const scoreRangeError =/)
  assert.match(file, /value >= 0 && value <= MAX_SCORE/)
  assert.match(file, /스코어는 0~\$\{MAX_SCORE\} 사이로 입력해주세요/)

  // 범위 오류는 제출 실패 메시지보다 먼저 노출된다
  assert.match(file, /const visibleError = scoreRangeError \?\? error/)
  assert.match(file, /\{visibleError && \(/)
  assert.match(file, /role="alert"/)

  // 넘어가기·제출이 함께 잠긴다(제출 버튼은 allPicked까지 최종 안전망으로 본다 — feature-spec §9)
  assert.match(file, /disabled=\{!!scoreRangeError\}/)
  assert.match(file, /disabled=\{submitting \|\| !!scoreRangeError \|\| !allPicked\}/)
})

test('MAX_SCORE stays the single source shared with server validation', () => {
  const file = source('lib/predictions/submit.ts')

  assert.match(file, /export const MAX_SCORE = 20/)
  assert.match(file, /value <= MAX_SCORE/)
})
