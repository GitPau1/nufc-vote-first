/**
 * 결과 화면이 쓰는 순수 계산 (DB 접근 없음).
 * 조회는 lib/queries/predictions.ts(`getMyResults`, `getWeekRanking`), 화면은 components/composition/predict/PredictionResult.tsx.
 */

import type { MyResult, MyResultMap, RankingRow } from '@/lib/queries/predictions'
import type { MatchView, WeekGroup } from '@/lib/predictions/week'

/** 평점 구간 — 배지 색이 3단계로 갈린다(퍼블리싱 `ratingTier`). */
export type RatingTier = 'good' | 'mid' | 'bad'

/**
 * 픽 점수가 붙는 기준(`prediction_pick_points`)은 7.0이고, 6.0~6.9는 점수는 0이지만
 * "나쁘지 않았다"는 표시를 위해 중간 색을 쓴다. 평점이 없으면(미출전/미집계) 색을 정할 수 없다.
 */
export function ratingTier(rating: number | null): RatingTier | null {
  if (rating === null) return null
  if (rating >= 7) return 'good'
  return rating >= 6 ? 'mid' : 'bad'
}

/** 예측 스코어의 적중 정도 — 제출 완료 화면 배지. 점수는 정산 후에만 공개하므로 여기선 등급만 낸다. */
export type MatchHit = 'exact' | 'outcome' | 'miss'

/**
 * DB `prediction_match_points`(20260821120000_create_predictions.sql)와 같은 기준이다:
 * 스코어까지 정확하면 3점(exact), 승/무/패만 맞으면 2점(outcome), 아니면 0점(miss).
 * 한쪽 기준만 바꾸면 화면 배지와 실제 점수가 어긋나니 둘을 같이 고칠 것.
 *
 * 두 인자는 같은 순서여야 한다 — 화면은 [우리, 상대], DB는 [홈, 원정]이라 섞어 넣으면 안 된다.
 */
export function matchHit(
  predicted: [number, number],
  actual: [number, number],
): MatchHit {
  const [predictedOurs, predictedTheirs] = predicted
  const [actualOurs, actualTheirs] = actual

  if (predictedOurs === actualOurs && predictedTheirs === actualTheirs) return 'exact'

  return Math.sign(predictedOurs - predictedTheirs) === Math.sign(actualOurs - actualTheirs)
    ? 'outcome'
    : 'miss'
}

/** 그 주 성적 한 줄 — 결과 히어로가 그리는 값. */
export type WeekResultSummary = {
  matchPoints: number
  pickPoints: number
  totalPoints: number
  /** 랭킹에 내 행이 없으면 null(집계 전) */
  rank: number | null
  /** 그 주차 전체 참여자 수 */
  totalEntries: number
}

/**
 * 그 주에 채점된 내 경기들을 하나의 주차 성적으로 합산한다. 더블 매치위크는 두 경기 점수를 더한다 —
 * 같은 선수를 골랐어도 평점은 경기별로 따로 매겨지므로 픽 점수도 경기별로 쌓이는 게 맞다
 * (DB의 week_leaderboard view와 같은 기준).
 * 참여한(채점된) 경기가 하나도 없으면 null = 미참여 히어로.
 */
export function aggregateWeekResult(
  week: WeekGroup,
  results: MyResultMap,
  ranking: RankingRow[],
): WeekResultSummary | null {
  const mine = week.matches.map(match => results[match.id]).filter((r): r is MyResult => !!r)
  if (mine.length === 0) return null

  return {
    matchPoints: mine.reduce((sum, r) => sum + r.matchPoints, 0),
    pickPoints: mine.reduce((sum, r) => sum + r.pickPoints, 0),
    totalPoints: mine.reduce((sum, r) => sum + r.totalPoints, 0),
    rank: ranking.find(entry => entry.isMe)?.rank ?? null,
    totalEntries: ranking.length,
  }
}

/**
 * 내 예측 스코어를 화면 기준([우리, 상대])으로 되돌린다 — `MyResult.predicted`는 DB와 같은
 * [홈, 원정]이라 원정 경기는 뒤집어야 한다(`findWeekPrediction`과 같은 변환).
 */
export function ourScoreOrder(
  predicted: [number, number],
  isHome: boolean,
): [number, number] {
  return isHome ? predicted : [predicted[1], predicted[0]]
}

/** 결과 화면에서 이 경기를 어떻게 그릴지 — 경기별 마감이라 한 주차 안에서도 상태가 갈린다. */
export type MatchResultState =
  /** 끝났고 내가 참여함 → 예측 vs 실제 비교 */
  | { kind: 'scored'; result: MyResult }
  /** 끝났지만 참여 안 함 → "미참여" 안내 */
  | { kind: 'missed' }
  /** 아직 안 끝남(그 주 다른 경기만 끝난 경우) → "아직 시작하지 않은 경기" 안내 */
  | { kind: 'pending' }

export function matchResultState(match: MatchView, results: MyResultMap): MatchResultState {
  const result = results[match.id]
  if (result) return { kind: 'scored', result }
  return match.finished ? { kind: 'missed' } : { kind: 'pending' }
}
