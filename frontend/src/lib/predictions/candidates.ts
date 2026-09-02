/**
 * 선수 픽의 포지션 정의와 표시용 헬퍼.
 * 후보 목록/배당은 DB(season_squads)에서 오고 조회는 lib/queries/squads.ts가 담당한다.
 */

import { SUPABASE_URL } from '@/lib/config'

export const POSITIONS = ['DEF', 'MID', 'FWD'] as const
export type Position = (typeof POSITIONS)[number]

export const POSITION_LABEL: Record<Position, string> = {
  DEF: '수비수',
  MID: '미드필더',
  FWD: '공격수',
}

export type Candidate = {
  /** season_squads.fotmob_player_id — predictions.{def,mid,fwd}_player_id에 그대로 들어간다 */
  id: number
  name: string
  position: Position
  /** 제출 시 서버가 DB 값을 다시 읽어 스냅샷한다 — 화면 표시용으로만 믿는다 */
  multiplier: number
  /** 툰 비용(1~3). 순수 예산 제약이며 점수와 무관. 서버가 제출 시 재확인·스냅샷한다. */
  cost: number
  squadNumber: number | null
  nationality: string | null
  age: number | null
  photoUrl: string | null
  /** season_squads.is_active가 false(떠난 선수)면 true. 픽 선택 경로에서만 걸러내는 데 쓴다. */
  departed?: boolean
}

/**
 * 엠블럼과 같은 public `player-photos` 버킷의 `players/{fotmob_player_id}.png`. 현재 스쿼드
 * 25명은 전부 올라와 있고, 빠진 선수(평점에만 있는 이적/유스 선수)는 400이라 PlayerPhoto의
 * onError 실루엣 폴백에 맡긴다. mock 모드(주소 없음)에서는 곧바로 null.
 */
export function playerPhotoUrl(fotmobPlayerId: number): string | null {
  return SUPABASE_URL
    ? `${SUPABASE_URL}/storage/v1/object/public/player-photos/players/${fotmobPlayerId}.png`
    : null
}

export function isPickPosition(position: string): position is Position {
  return (POSITIONS as readonly string[]).includes(position)
}

/**
 * 픽 선택이 필요한 경로(픽 모달, 제출 검증)에서만 쓴다 — 떠난 선수를 후보 목록에서 걷어낸다.
 * 완료/결과 화면 이름 표시, 관리자 평점 폼은 이 함수를 거치지 않은 getPickCandidates() 결과를
 * 그대로 써야 한다(과거 픽 이름 표시·과거 평점 손보정이 깨지면 안 된다).
 * 클라이언트 컴포넌트(PredictionFlowClient)에서 직접 쓸 수 있도록 서버 전용 의존성이 없는
 * 이 파일에 둔다 — lib/queries/squads.ts는 next/headers를 타는 서버 전용 모듈이라
 * 거기서 값을 import하면 클라이언트 번들에 서버 코드가 딸려온다(빌드 시 발견).
 */
export function excludeDeparted(
  candidates: Record<Position, Candidate[]>,
): Record<Position, Candidate[]> {
  const filtered = { DEF: [], MID: [], FWD: [] } as Record<Position, Candidate[]>
  for (const position of POSITIONS) {
    filtered[position] = candidates[position].filter(candidate => !candidate.departed)
  }
  return filtered
}

/** date_of_birth → 만 나이. 없으면 null. */
export function ageFrom(dateOfBirth: string | null, now: number): number | null {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return null
  const years = (now - birth.getTime()) / (365.2425 * 86_400_000)
  return years < 0 ? null : Math.floor(years)
}
