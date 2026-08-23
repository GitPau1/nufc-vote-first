'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { trackServerEvent } from '@/lib/analytics/server'
import { IS_MOCK } from '@/lib/config'
import { getFixtureWeeks } from '@/lib/queries/fixtures'
import { getPickCandidates } from '@/lib/queries/squads'
import { findWeekSession } from '@/lib/predictions/week'
import { buildPredictionRows, type PredictionInput } from '@/lib/predictions/submit'

export type SubmitPredictionResult =
  | { success: true }
  | {
      error:
        | 'unauthenticated'
        | 'already_submitted'
        | 'closed'
        | 'incomplete'
        | 'invalid_score'
        | 'duplicate_picks'
        | 'unknown_player'
        | 'setup_required'
        | 'failed'
    }

function isMissingPredictionSchemaError(error: { message?: string } | null | undefined): boolean {
  const message = String(error?.message ?? '')
  return (
    message.includes('predictions') && (message.includes('schema cache') || message.includes('does not exist'))
  )
}

/**
 * 주차 하나에 대한 예측을 제출한다 — 그 주 경기 수만큼(보통 1행, 더블 매치위크면 2행) 한 번에 insert.
 * 다중 행 insert는 단일 statement라 부분 제출이 생기지 않는다(픽이 한쪽 경기에만 붙는 상태 방지).
 * 마감·후보·배당은 전부 서버가 다시 확인한다(클라이언트 값은 스코어와 선수 id만 쓴다).
 */
export async function submitWeekPrediction(
  weekKey: string,
  input: PredictionInput,
): Promise<SubmitPredictionResult> {
  const weeks = await getFixtureWeeks()
  const week = findWeekSession(weeks, weekKey)
  if (!week) return { error: 'failed' }

  const candidates = await getPickCandidates()
  const built = buildPredictionRows(week, input, candidates)
  if ('error' in built) return { error: built.error }

  if (IS_MOCK) {
    const { cookies } = await import('next/headers')
    const jar = await cookies()
    if (jar.get('mock-auth')?.value !== 'true') return { error: 'unauthenticated' }
    if (built.rows.some(row => jar.get(`mock-prediction-${row.fixture_id}`))) {
      return { error: 'already_submitted' }
    }

    // insert 행 그대로 저장한다 — queries/predictions.ts가 DB 행과 같은 형식으로 읽는다.
    for (const row of built.rows) {
      jar.set(`mock-prediction-${row.fixture_id}`, JSON.stringify(row), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      })
    }
    revalidatePath('/predictions')
    return { success: true }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('predictions')
    .insert(built.rows.map(row => ({ ...row, user_id: user.id })))

  if (error) {
    // 23505 = unique violation → 이미 제출한 주차(제출 후 수정 불가)
    if (error.code === '23505') return { error: 'already_submitted' }
    // 42501 = RLS 위반 → 서버 시각 기준으로는 이미 닫힌 주차
    if (error.code === '42501') return { error: 'closed' }
    if (isMissingPredictionSchemaError(error)) {
      console.error('submitWeekPrediction: predictions 스키마 미적용(supabase db push 필요)', error)
      return { error: 'setup_required' }
    }
    console.error('submitWeekPrediction insert failed:', error)
    return { error: 'failed' }
  }

  // 리텐션·WAU 지표의 authoritative source라 서버에서 보낸다 — 애드블록에 막히지 않고
  // distinct_id가 user.id로 정확하다. 퍼널 종료 지점은 클라이언트 prediction_done_viewed가 맡는다.
  // is_partial: 그 주 경기 전부를 예측한 게 아닌 상태(이미 킥오프된 경기가 있었음).
  // 부분 참여자를 주간·시즌 집계에서 어떻게 다룰지는 미확정(요구사항 명세서 CST-006)이라,
  // 어느 쪽으로 결정되든 소급 재분석할 수 있게 분모가 되는 경기 수를 함께 남긴다.
  await trackServerEvent('prediction_submitted', user.id, {
    week_key: weekKey,
    match_count: built.rows.length,
    week_match_count: week.matches.length,
    is_partial: built.rows.length < week.matches.length,
  })

  revalidatePath('/predictions')
  revalidatePath(`/predictions/${weekKey}`)
  return { success: true }
}
