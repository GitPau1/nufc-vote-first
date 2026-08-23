import { unstable_cache } from 'next/cache'
import { createPublicClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import {
  ageFrom,
  isPickPosition,
  playerPhotoUrl,
  POSITIONS,
  type Candidate,
  type Position,
} from '@/lib/predictions/candidates'
import type { SeasonSquadRow } from '@/types/database'

export type PickCandidates = Record<Position, Candidate[]>

const SQUAD_COLUMNS =
  'fotmob_player_id, name, name_ko, shirt_number, position, nationality_name, date_of_birth, prediction_multiplier'

type SquadCandidateRow = Pick<
  SeasonSquadRow,
  | 'fotmob_player_id'
  | 'name'
  | 'name_ko'
  | 'shirt_number'
  | 'position'
  | 'nationality_name'
  | 'date_of_birth'
  | 'prediction_multiplier'
>

const EMPTY: PickCandidates = { DEF: [], MID: [], FWD: [] }

export function toPickCandidates(rows: SquadCandidateRow[], now: number): PickCandidates {
  const grouped: PickCandidates = { DEF: [], MID: [], FWD: [] }

  for (const row of rows) {
    // GK는 픽 대상이 아니다(포지션 3개 고정).
    if (!isPickPosition(row.position)) continue
    grouped[row.position].push({
      id: row.fotmob_player_id,
      name: row.name_ko?.trim() || row.name,
      position: row.position,
      multiplier: Number(row.prediction_multiplier),
      squadNumber: row.shirt_number,
      nationality: row.nationality_name,
      age: ageFrom(row.date_of_birth, now),
      photoUrl: playerPhotoUrl(row.fotmob_player_id),
    })
  }

  // 배당 낮은(=안전한) 선수부터 — 프로토타입 목록 순서와 같다.
  for (const position of POSITIONS) {
    grouped[position].sort((a, b) => a.multiplier - b.multiplier)
  }

  return grouped
}

async function getPickCandidatesUncached(): Promise<PickCandidates> {
  const now = Date.now()

  if (IS_MOCK) {
    const { MOCK_SQUAD } = await import('@/lib/mock/data')
    return toPickCandidates(MOCK_SQUAD, now)
  }

  const supabase = createPublicClient()

  const { data: season } = (await supabase
    .from('seasons')
    .select('id')
    .eq('is_current', true)
    .maybeSingle()) as { data: { id: string } | null }

  // 현재 시즌 표시가 없으면 후보를 만들 근거가 없다 — 화면은 "선택할 수 있는 선수가 없어요"로 떨어진다.
  if (!season) return EMPTY

  const { data, error } = await supabase
    .from('season_squads')
    .select(SQUAD_COLUMNS)
    .eq('season_id', season.id)
    .in('position', ['DEF', 'MID', 'FWD'])

  if (error) {
    console.error('getPickCandidates error:', error)
    return EMPTY
  }

  return toPickCandidates((data ?? []) as unknown as SquadCandidateRow[], now)
}

export const getPickCandidates = unstable_cache(getPickCandidatesUncached, ['pick-candidates'], {
  revalidate: 3600,
})
