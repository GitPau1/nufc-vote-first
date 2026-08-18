import type { Position } from '@/types/database'

type RatingPlayer = {
  position: Position
  squad_number: number | null
}

const POSITION_ORDER: Record<Position, number> = {
  GK: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
  MGR: 4,
}

const GRADE_RANGES = [
  { max: 0.5, grade: 'F' },
  { max: 0.8, grade: 'D-' },
  { max: 1.1, grade: 'D' },
  { max: 1.5, grade: 'D+' },
  { max: 1.8, grade: 'C-' },
  { max: 2.1, grade: 'C' },
  { max: 2.5, grade: 'C+' },
  { max: 2.8, grade: 'B-' },
  { max: 3.1, grade: 'B' },
  { max: 3.5, grade: 'B+' },
  { max: 3.8, grade: 'A-' },
  { max: 4.1, grade: 'A' },
  { max: 4.5, grade: 'A+' },
  { max: 4.8, grade: 'S' },
  { max: 5, grade: 'S+' },
]

export function getRatingGrade(score: number): string {
  const rounded = Math.round(score * 10) / 10
  return GRADE_RANGES.find(range => rounded <= range.max)?.grade ?? 'S+'
}

export function sortPlayersForRating<T extends RatingPlayer>(players: T[]): T[] {
  return players.slice().sort((a, b) => {
    const positionDiff = POSITION_ORDER[a.position] - POSITION_ORDER[b.position]
    if (positionDiff !== 0) return positionDiff
    return (a.squad_number ?? 999) - (b.squad_number ?? 999)
  })
}
