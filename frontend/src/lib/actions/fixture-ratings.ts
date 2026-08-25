'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { IS_MOCK } from '@/lib/config'
import { requireAdminClient } from '@/lib/supabase/admin'

export type SaveRatingsResult =
  | { success: true; saved: number }
  | { error: 'mock_unsupported' | 'invalid_rating' | 'empty' | 'forbidden' | 'failed' }

/** 화면에서 올라오는 입력 — 빈 칸은 아예 보내지 않는다(= 그 선수는 미집계로 남긴다). */
export type RatingInput = { playerId: number; rating: number }

/**
 * 경기별 선수 평점을 손으로 입력한다(관리자 전용, 최소 형태).
 * 이름이 `ratings.ts`가 아닌 이유: 그 파일은 선수 평점 **투표**(rating_votes) 액션이 이미 쓰고 있다.
 *
 * `fixture_player_ratings`에는 insert 정책이 없어서 service-role 클라이언트로만 쓸 수 있다 —
 * 권한 판정은 `requireAdminClient`의 ADMIN_EMAILS 확인 하나로 끝난다.
 *
 * 이미 있는 평점은 덮어쓴다(upsert). 반대로 "평점 지우기"는 지원하지 않는다 —
 * 잘못 넣은 값은 올바른 값으로 다시 저장하면 되고, 삭제가 필요한 적이 아직 없다.
 */
export async function saveFixtureRatings(
  fixtureId: string,
  ratings: RatingInput[],
): Promise<SaveRatingsResult> {
  if (IS_MOCK) return { error: 'mock_unsupported' }
  if (ratings.length === 0) return { error: 'empty' }
  // DB check(rating between 0 and 10)와 같은 범위를 먼저 막는다.
  if (ratings.some(entry => !Number.isFinite(entry.rating) || entry.rating < 0 || entry.rating > 10)) {
    return { error: 'invalid_rating' }
  }

  let supabase
  try {
    supabase = await requireAdminClient()
  } catch {
    return { error: 'forbidden' }
  }

  const { error } = await supabase.from('fixture_player_ratings').upsert(
    ratings.map(entry => ({
      fixture_id: Number(fixtureId),
      player_id: entry.playerId,
      rating: entry.rating,
    })),
    { onConflict: 'fixture_id,player_id' },
  )

  if (error) {
    console.error('saveFixtureRatings error:', error)
    return { error: 'failed' }
  }

  revalidatePath('/admin/ratings')
  // 평점이 바뀌면 week_leaderboard/season_leaderboard가 다시 계산돼야 한다.
  // 크론(Edge Function) 적재 경로는 이 액션을 안 거치므로 그쪽은 revalidate 60초로 따라온다.
  revalidateTag('prediction-rankings')
  return { success: true, saved: ratings.length }
}
