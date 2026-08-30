// 피드백 카테고리 — 서버 액션(검증)과 클라이언트 모달(드롭다운)이 공유한다.
// 'use server' 파일에서는 비-async 값을 export할 수 없어 별도 모듈로 둔다.

export const FEEDBACK_CATEGORIES = ['vote', 'prediction', 'player', 'etc'] as const

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

/** 드롭다운 노출 라벨. 배열 순서가 곧 드롭다운 순서다. */
export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  vote: '투표',
  prediction: '승부예측',
  player: '역대선수',
  etc: '기타',
}

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === 'string' && (FEEDBACK_CATEGORIES as readonly string[]).includes(value)
}

/** 현재 경로에서 기본 카테고리를 추론한다. 매핑 안 되는 경로는 'etc'. */
export function pathToCategory(pathname: string): FeedbackCategory {
  if (pathname === '/' || pathname.startsWith('/polls')) return 'vote'
  if (pathname.startsWith('/predictions')) return 'prediction'
  if (pathname.startsWith('/players')) return 'player'
  return 'etc'
}
