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
  'fotmob_player_id, name, name_ko, shirt_number, position, nationality_name, date_of_birth, prediction_multiplier, pick_cost'

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
  | 'pick_cost'
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
      cost: Number(row.pick_cost),
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

  const { data: season, error: seasonError } = (await supabase
    .from('seasons')
    .select('id')
    .eq('is_current', true)
    .maybeSingle()) as { data: { id: string } | null; error: unknown }

  // 조회 실패는 던진다 — unstable_cache가 실패 결과를 캐시하지 않게 한다(다음 요청서 재시도).
  if (seasonError) throw seasonError
  // 현재 시즌 표시가 진짜로 없는 건 정상 상태(에러 아님) — 화면은 "선택할 수 있는 선수가 없어요"로 떨어진다.
  if (!season) return EMPTY

  const { data, error } = await supabase
    .from('season_squads')
    .select(SQUAD_COLUMNS)
    .eq('season_id', season.id)
    .in('position', ['DEF', 'MID', 'FWD'])

  // 조회 실패는 던진다(위와 같은 이유) — 빈 목록으로 굳지 않게.
  if (error) throw error

  return toPickCandidates((data ?? []) as unknown as SquadCandidateRow[], now)
}

const getPickCandidatesCached = unstable_cache(getPickCandidatesUncached, ['pick-candidates'], {
  revalidate: 3600,
  // 관리자 동기화 버튼(lib/actions/sync-fixtures.ts)이 이 태그로 캐시를 즉시 비운다.
  tags: ['pick-candidates'],
})

/**
 * 조회 '실패'는 캐시하지 않는다 — 한 번의 오류(예: 마이그레이션 직후 PostgREST 스키마 캐시 어긋남)가
 * 빈 선수 목록으로 1시간 굳는 걸 막는다. 성공한 결과만 unstable_cache에 남고(빠른 TTFB 유지),
 * 실패는 여기서 잡아 EMPTY를 캐시 밖에서 돌려줘 다음 요청이 곧바로 재시도한다.
 */
export async function getPickCandidates(): Promise<PickCandidates> {
  try {
    return await getPickCandidatesCached()
  } catch (error) {
    console.error('getPickCandidates error:', error)
    return EMPTY
  }
}
