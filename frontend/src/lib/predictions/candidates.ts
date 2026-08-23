/**
 * 선수 픽의 포지션 정의와 표시용 헬퍼.
 * 후보 목록/배당은 DB(season_squads)에서 오고 조회는 lib/queries/squads.ts가 담당한다.
 */

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

/** fixtures 엠블럼과 같은 FotMob CDN. 없는 선수는 404라 <img> onError 폴백에 맡긴다. */
export function playerPhotoUrl(fotmobPlayerId: number): string {
  return `https://images.fotmob.com/image_resources/playerimages/${fotmobPlayerId}.png`
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
