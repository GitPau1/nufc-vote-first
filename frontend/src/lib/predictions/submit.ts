/**
 * 예측 제출 검증 + insert 행 생성 (순수 함수, DB 접근 없음).
 *
 * 제출 단위는 주(week) 하나다. predictions 테이블은 경기당 1행이라 그 주 경기 수만큼 행이 나가고,
 * 선수 픽은 주 단위 1세트라 모든 행에 같은 값이 들어간다(FR-017: 픽 점수는 주 단위 합산).
 * 배당은 클라이언트가 보낸 값을 쓰지 않는다 — 서버가 읽은 후보 목록에서 다시 꺼낸다.
 */

import { POSITIONS, type Candidate, type Position } from './candidates'
import type { WeekStatus } from './week'

export const MAX_SCORE = 20

/** 화면이 모으는 값은 항상 뉴캐슬 관점([우리, 상대])이다. 홈/원정 변환은 여기서 한다. */
export type PredictionInput = {
  /** fixture_id(문자열) → [우리, 상대] 예측 스코어. 그 주 경기 전부가 있어야 한다. */
  scores: Record<string, [number, number]>
  /** 포지션별로 고른 season_squads.fotmob_player_id */
  picks: Partial<Record<Position, number>>
}

export type PredictionInsertRow = {
  fixture_id: number
  home_score: number
  away_score: number
  def_player_id: number
  mid_player_id: number
  fwd_player_id: number
  def_multiplier: number
  mid_multiplier: number
  fwd_multiplier: number
}

export type SubmitValidationError =
  | 'closed'
  | 'incomplete'
  | 'invalid_score'
  | 'duplicate_picks'
  | 'unknown_player'

/** 제출 대상 주차 — WeekSession 중 검증에 필요한 부분만. */
type WeekTarget = {
  status: WeekStatus
  matches: { id: string; isHome: boolean }[]
}

function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_SCORE
}

export function buildPredictionRows(
  week: WeekTarget,
  input: PredictionInput,
  candidates: Record<Position, Candidate[]>,
): { rows: PredictionInsertRow[] } | { error: SubmitValidationError } {
  if (week.status !== 'open') return { error: 'closed' }
  if (week.matches.length === 0) return { error: 'incomplete' }

  const picked: Partial<Record<Position, Candidate>> = {}
  for (const position of POSITIONS) {
    const playerId = input.picks[position]
    if (playerId === undefined || playerId === null) return { error: 'incomplete' }

    const candidate = candidates[position].find(c => c.id === playerId)
    // 후보 목록에 없는 id = 다른 포지션/시즌 선수이거나 조작된 값.
    if (!candidate) return { error: 'unknown_player' }
    picked[position] = candidate
  }

  const [def, mid, fwd] = [picked.DEF!, picked.MID!, picked.FWD!]
  if (def.id === mid.id || mid.id === fwd.id || def.id === fwd.id) return { error: 'duplicate_picks' }

  const rows: PredictionInsertRow[] = []
  for (const match of week.matches) {
    const score = input.scores[match.id]
    // 그 주 경기 중 하나라도 스코어가 없으면 주 단위 제출이 성립하지 않는다.
    if (!score) return { error: 'incomplete' }
    const [ourScore, theirScore] = score
    if (!isValidScore(ourScore) || !isValidScore(theirScore)) return { error: 'invalid_score' }

    rows.push({
      fixture_id: Number(match.id),
      home_score: match.isHome ? ourScore : theirScore,
      away_score: match.isHome ? theirScore : ourScore,
      def_player_id: def.id,
      mid_player_id: mid.id,
      fwd_player_id: fwd.id,
      def_multiplier: def.multiplier,
      mid_multiplier: mid.multiplier,
      fwd_multiplier: fwd.multiplier,
    })
  }

  return { rows }
}
