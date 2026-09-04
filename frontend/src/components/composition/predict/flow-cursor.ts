/**
 * 예측 플로우 score/pick/confirm 커서 전이 — 순수 함수로 분리해 React 없이 단위 테스트한다
 * (코드리뷰 2026-09-05: confirm 화면에서 경기 하나만 고치는 왕복이 실제로 되는지는 소스 문자열
 * 검사로는 못 잡는다 — 로직을 여기로 빼서 flow-cursor.test.mjs가 직접 실행·검증한다).
 *
 * PredictionFlowClient는 이 파일의 함수들을 호출해 step/matchCursor/returnToConfirm 세
 * React state를 갱신한다. 상태 자체(useState)는 여전히 컴포넌트가 들고 있다 — 여기는 "다음
 * 상태가 뭐여야 하는가"라는 규칙만 담는다.
 */
import type { StepKey } from './steps'

export type FlowCursor = {
  step: StepKey
  matchCursor: number
  /**
   * confirm 화면에서 경기 하나만 고치러 들어온 상태면 true. 이게 없으면 "다음"이 "마지막
   * 경기인지"만 보고 방향을 정해서, confirm에서 들어온 것인지 원래 순서대로 진행 중인지
   * 구분하지 못한다 — 그래서 마지막이 아닌 경기를 고치면 나머지 경기를 다시 다 눌러야
   * confirm으로 돌아오는 버그가 났다(코드리뷰 2026-09-05, flow-cursor.test.mjs의 REGRESSION
   * 테스트가 이 정확한 시나리오를 재현한다).
   */
  returnToConfirm: boolean
}

export const INITIAL_FLOW_CURSOR: FlowCursor = { step: 'score', matchCursor: 0, returnToConfirm: false }

/**
 * confirm 화면의 "수정" 링크 — 그 경기(matchIndex)의 score 또는 pick 단계로 들어가면서
 * "다음"을 눌렀을 때 나머지 경기를 건너뛰고 confirm으로 바로 돌아오게 표시한다.
 */
export function startEditFromConfirm(matchIndex: number, target: Extract<StepKey, 'score' | 'pick'>): FlowCursor {
  return { step: target, matchCursor: matchIndex, returnToConfirm: true }
}

/** pick 단계 "다음". returnToConfirm이면 몇 번째 경기든 곧장 confirm으로, 아니면 고정 순서대로 진행. */
export function computeNextFromPick(cursor: FlowCursor, matchCount: number): FlowCursor {
  if (cursor.returnToConfirm) {
    return { ...cursor, step: 'confirm', returnToConfirm: false }
  }
  if (cursor.matchCursor < matchCount - 1) {
    return { ...cursor, step: 'score', matchCursor: cursor.matchCursor + 1 }
  }
  return { ...cursor, step: 'confirm' }
}

/**
 * "이전" — score/pick/confirm 사이를 대칭으로 되돌린다. returnToConfirm 왕복 중에는 다른
 * 경기의 커서를 건드리지 않고 그 자리(score)에서 곧장 confirm으로 취소한다.
 */
export function computePrevStep(cursor: FlowCursor): FlowCursor {
  if (cursor.step === 'confirm') return { ...cursor, step: 'pick' }
  if (cursor.step === 'pick') return { ...cursor, step: 'score' }
  // step === 'score'
  if (cursor.returnToConfirm) return { ...cursor, step: 'confirm', returnToConfirm: false }
  if (cursor.matchCursor > 0) return { ...cursor, matchCursor: cursor.matchCursor - 1, step: 'pick' }
  return cursor
}

/**
 * score 단계의 진짜 첫 화면 — "이전" 버튼을 숨기는 기준(뒤로가기 히스토리 가드만 이탈을 처리).
 * returnToConfirm 중에는 matchCursor가 0이어도 "이전"이 confirm 취소로 쓰이므로 첫 화면이 아니다.
 */
export function isFirstFlowStep(cursor: FlowCursor): boolean {
  return cursor.step === 'score' && cursor.matchCursor === 0 && !cursor.returnToConfirm
}

/** ProgressPips 점 개수 중 지금 활성화된 0-based 위치. */
export function flowPipIndex(cursor: FlowCursor, matchCount: number): number {
  const totalSteps = matchCount * 2 + 1
  return cursor.step === 'confirm' ? totalSteps - 1 : cursor.matchCursor * 2 + (cursor.step === 'pick' ? 1 : 0)
}
