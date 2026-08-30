/**
 * 예측 제출 검증 + insert 행 생성 (순수 함수, DB 접근 없음).
 *
 * 제출 단위는 주(week) 하나다. predictions 테이블은 경기당 1행이라 그 주 경기 수만큼 행이 나가고,
 * 선수 픽도 **경기별로 따로** 고른다(2026-08-23 확정) — 더블 매치위크는 경기마다 다른 선수를 고를 수 있다.
 * 점수는 그 주 행들을 합산해 주차 성적이 된다(FR-017: 픽 점수는 주 단위 합산).
 * 이미 킥오프이 지난 경기는 제출 대상에서 빠진다 — 첫 경기가 끝난 뒤 들어와도 남은 경기는 예측할 수 있다.
 * 배당은 클라이언트가 보낸 값을 쓰지 않는다 — 서버가 읽은 후보 목록에서 다시 꺼낸다.
 */

import { POSITIONS, type Candidate, type Position } from './candidates'
import type { WeekStatus } from './week'

export const MAX_SCORE = 20

/** 한 경기 3픽 비용의 합 상한(툰). 설계: 툰 예산제. */
export const BUDGET = 5

/** 화면이 모으는 값은 항상 뉴캐슬 관점([우리, 상대])이다. 홈/원정 변환은 여기서 한다. */
export type PredictionInput = {
  /** fixture_id(문자열) → [우리, 상대] 예측 스코어. 그 주 **아직 안 잠긴** 경기 전부가 있어야 한다. */
  scores: Record<string, [number, number]>
  /** fixture_id(문자열) → 포지션별로 고른 season_squads.fotmob_player_id. 스코어와 같은 경기 집합이어야 한다. */
  picks: Record<string, Partial<Record<Position, number>>>
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
  def_cost: number
  mid_cost: number
  fwd_cost: number
}

export type SubmitValidationError =
  | 'closed'
  | 'incomplete'
  | 'invalid_score'
  | 'duplicate_picks'
  | 'unknown_player'
  | 'over_budget'

/** 제출 대상 주차 — WeekSession 중 검증에 필요한 부분만. */
type WeekTarget = {
  status: WeekStatus
  matches: { id: string; isHome: boolean; locked: boolean }[]
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
  // 킥오프이 지난 경기는 조용히 제외한다 — 남은 경기만으로 주 단위 제출이 성립한다.
  const targets = week.matches.filter(match => !match.locked)
  if (targets.length === 0) return { error: 'closed' }

  const rows: PredictionInsertRow[] = []
  for (const match of targets) {
    const score = input.scores[match.id]
    // 남은 경기 중 하나라도 스코어가 없으면 주 단위 제출이 성립하지 않는다.
    if (!score) return { error: 'incomplete' }
    const [ourScore, theirScore] = score
    if (!isValidScore(ourScore) || !isValidScore(theirScore)) return { error: 'invalid_score' }

    // 픽도 경기별이라 경기마다 3포지션이 다 채워져 있어야 한다.
    const resolved = resolvePicks(input.picks[match.id], candidates)
    if ('error' in resolved) return { error: resolved.error }
    const { def, mid, fwd } = resolved

    // 경기별 예산: 3픽 비용 합이 5툰을 넘으면 제출 불가.
    if (def.cost + mid.cost + fwd.cost > BUDGET) return { error: 'over_budget' }

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
      def_cost: def.cost,
      mid_cost: mid.cost,
      fwd_cost: fwd.cost,
    })
  }

  return { rows }
}

/**
 * 경기 하나의 픽 3개를 후보 목록에서 다시 찾아 확정한다 — 배당은 클라이언트 값이 아니라 여기서 온다.
 * 같은 경기 안에서 포지션끼리 같은 선수를 고를 수 없다(DB의 predictions_distinct_picks와 같은 규칙).
 * 경기끼리는 같은 선수를 골라도 된다 — 행이 다르니 제약에 걸리지 않는다.
 */
function resolvePicks(
  picks: Partial<Record<Position, number>> | undefined,
  candidates: Record<Position, Candidate[]>,
): { def: Candidate; mid: Candidate; fwd: Candidate } | { error: SubmitValidationError } {
  const picked: Partial<Record<Position, Candidate>> = {}
  for (const position of POSITIONS) {
    const playerId = picks?.[position]
    if (playerId === undefined || playerId === null) return { error: 'incomplete' }

    const candidate = candidates[position].find(c => c.id === playerId)
    // 후보 목록에 없는 id = 다른 포지션/시즌 선수이거나 조작된 값.
    if (!candidate) return { error: 'unknown_player' }
    picked[position] = candidate
  }

  const [def, mid, fwd] = [picked.DEF!, picked.MID!, picked.FWD!]
  if (def.id === mid.id || mid.id === fwd.id || def.id === fwd.id) return { error: 'duplicate_picks' }
  return { def, mid, fwd }
}
