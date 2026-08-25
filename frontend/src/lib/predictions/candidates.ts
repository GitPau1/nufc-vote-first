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
  squadNumber: number | null
  nationality: string | null
  age: number | null
  photoUrl: string | null
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

/** date_of_birth → 만 나이. 없으면 null. */
export function ageFrom(dateOfBirth: string | null, now: number): number | null {
  if (!dateOfBirth) return null
  const birth = new Date(dateOfBirth)
  if (Number.isNaN(birth.getTime())) return null
  const years = (now - birth.getTime()) / (365.2425 * 86_400_000)
  return years < 0 ? null : Math.floor(years)
}
