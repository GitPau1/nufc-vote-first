/**
 * 예측 제출 검증 + insert 행 생성 (순수 함수, DB 접근 없음).
 *
 * 제출 단위는 경기(fixture) 하나이고 predictions 테이블도 경기당 1행이라 항상 1행이 나간다.
 * 배당은 클라이언트가 보낸 값을 쓰지 않는다 — 서버가 읽은 후보 목록에서 다시 꺼낸다.
 */

import { POSITIONS, type Candidate, type Position } from './candidates'
import type { MatchStatus } from './week'

export const MAX_SCORE = 20

/** 화면이 모으는 값은 항상 뉴캐슬 관점([우리, 상대])이다. 홈/원정 변환은 여기서 한다. */
export type PredictionInput = {
  ourScore: number
  theirScore: number
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

/** 제출 대상 경기 — MatchView 중 검증에 필요한 부분만. */
type MatchTarget = {
  id: string
  isHome: boolean
  status: MatchStatus
}

function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_SCORE
}

export function buildPredictionRow(
  match: MatchTarget,
  input: PredictionInput,
  candidates: Record<Position, Candidate[]>,
): { row: PredictionInsertRow } | { error: SubmitValidationError } {
  if (match.status !== 'open') return { error: 'closed' }
  if (!isValidScore(input.ourScore) || !isValidScore(input.theirScore)) return { error: 'invalid_score' }

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

  return {
    row: {
      fixture_id: Number(match.id),
      home_score: match.isHome ? input.ourScore : input.theirScore,
      away_score: match.isHome ? input.theirScore : input.ourScore,
      def_player_id: def.id,
      mid_player_id: mid.id,
      fwd_player_id: fwd.id,
      def_multiplier: def.multiplier,
      mid_multiplier: mid.multiplier,
      fwd_multiplier: fwd.multiplier,
    },
  }
}
