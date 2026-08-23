'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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

  revalidatePath('/predictions')
  revalidatePath(`/predictions/${weekKey}`)
  return { success: true }
}
