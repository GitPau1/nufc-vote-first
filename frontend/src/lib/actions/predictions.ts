'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { trackServerEvent } from '@/lib/analytics/server'
import { IS_MOCK } from '@/lib/config'
import { getFixtureWeeks } from '@/lib/queries/fixtures'
import { excludeDeparted, getPickCandidates } from '@/lib/queries/squads'
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
        | 'over_budget'
        | 'setup_required'
        | 'failed'
    }

export type UpdateMatchPredictionResult =
  | { success: true }
  | {
      error:
        | 'unauthenticated'
        | 'closed' // RLS가 막았거나(킥오프 지남) 대상 행이 없음(0행 갱신) — 둘 다 "지금은 못 고친다"로 통일
        | 'incomplete'
        | 'invalid_score'
        | 'duplicate_picks'
        | 'unknown_player'
        | 'over_budget'
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
 * 주차 안에서 `matchIds`로 지정한 경기만 제출한다(insert 전용) — 지정한 경기 수만큼
 * (경기 하나만 고르면 1행, "둘 다"면 그 주 경기 수만큼) 한 번에 insert.
 * `matchIds`는 클라이언트가 이번 세션에서 다루는 정확한 경기 집합을 명시한다 — 부분 제출
 * 선택권(경기 하나만 지금 제출)이 열리면서, 그 주에 이미 제출된 다른 경기가 섞여 있어도
 * `matchIds`에 없으면 검증 대상에서 빠진다(week.matches 전체를 넘기면 그 경기의 스코어까지
 * 요구해 incomplete가 나는 문제를 여기서 막는다).
 * 다중 행 insert는 단일 statement라 지정한 경기들 사이에서는 부분 제출이 생기지 않는다.
 * 마감·후보·배당은 전부 서버가 다시 확인한다(클라이언트 값은 스코어와 선수 id만 쓴다).
 */
export async function submitWeekPrediction(
  weekKey: string,
  matchIds: string[],
  input: PredictionInput,
): Promise<SubmitPredictionResult> {
  const weeks = await getFixtureWeeks()
  const week = findWeekSession(weeks, weekKey)
  if (!week) return { error: 'failed' }

  const candidates = excludeDeparted(await getPickCandidates())
  const targets = week.matches.filter(match => matchIds.includes(match.id))
  const built = buildPredictionRows({ status: week.status, matches: targets }, input, candidates)
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
  // is_partial: 그 주 경기 전부를 예측한 게 아닌 상태(이미 킥오프된 경기이거나 사용자가 일부만
  // 선택함). 부분 참여자는 제출한 경기 수만큼만 주간·시즌 집계에 포함된다(CST-006 확정) — 소급
  // 재분석에 대비해 분모가 되는 경기 수를 함께 남긴다.
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

/**
 * 경기 하나의 예측을 수정한다(update 전용) — 이미 제출된 행 하나의 스코어·픽만 바꾸고 같은 주의
 * 다른 경기 행은 건드리지 않는다(design-brief §9 질문3=B). `input`은 `PredictionInput`의 맵에
 * `fixtureId` 키 하나만 채워 넘긴다 — `buildPredictionRows`를 그대로 재사용하기 위함이다.
 * 마감 판정은 UPDATE RLS 정책("predictions: update own while week open")이 최종 결정한다:
 * RLS 위반은 에러가 아니라 0행 갱신으로 조용히 나타나므로, 에러 코드가 아니라 갱신된 행 개수로
 * closed 여부를 판정한다.
 */
export async function updateMatchPrediction(
  weekKey: string,
  fixtureId: string,
  input: PredictionInput,
): Promise<UpdateMatchPredictionResult> {
  const weeks = await getFixtureWeeks()
  const week = findWeekSession(weeks, weekKey)
  if (!week) return { error: 'failed' }

  const candidates = excludeDeparted(await getPickCandidates())
  const target = week.matches.filter(match => match.id === fixtureId)
  const built = buildPredictionRows({ status: week.status, matches: target }, input, candidates)
  if ('error' in built) return { error: built.error }
  const row = built.rows[0]

  if (IS_MOCK) {
    const { cookies } = await import('next/headers')
    const jar = await cookies()
    if (jar.get('mock-auth')?.value !== 'true') return { error: 'unauthenticated' }
    if (!jar.get(`mock-prediction-${fixtureId}`)) return { error: 'closed' }

    jar.set(`mock-prediction-${fixtureId}`, JSON.stringify(row), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    })
    revalidatePath('/predictions')
    revalidatePath(`/predictions/${weekKey}`)
    return { success: true }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('predictions')
    .update({
      home_score: row.home_score,
      away_score: row.away_score,
      def_player_id: row.def_player_id,
      mid_player_id: row.mid_player_id,
      fwd_player_id: row.fwd_player_id,
      def_multiplier: row.def_multiplier,
      mid_multiplier: row.mid_multiplier,
      fwd_multiplier: row.fwd_multiplier,
      def_cost: row.def_cost,
      mid_cost: row.mid_cost,
      fwd_cost: row.fwd_cost,
    })
    .eq('user_id', user.id)
    .eq('fixture_id', fixtureId)
    .select('id')

  if (error) {
    if (isMissingPredictionSchemaError(error)) {
      console.error('updateMatchPrediction: predictions 스키마 미적용(supabase db push 필요)', error)
      return { error: 'setup_required' }
    }
    console.error('updateMatchPrediction update failed:', error)
    return { error: 'failed' }
  }

  // 0행 갱신 = RLS가 막았거나(킥오프 지남) 애초에 그 경기를 제출한 적이 없음 — 둘 다 "지금은
  // 못 고친다"로 통일해 안내한다.
  if (!data || data.length === 0) return { error: 'closed' }

  // 분석 이벤트 확장(prediction_updated 등)은 이번 스코프에서 스킵 확정
  // (feature-spec.md §7-7) — prediction_submitted와 달리 여기선 서버 이벤트를 보내지 않는다.

  revalidatePath('/predictions')
  revalidatePath(`/predictions/${weekKey}`)
  return { success: true }
}
