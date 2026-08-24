'use server'

import { revalidateTag } from 'next/cache'
import { IS_MOCK } from '@/lib/config'
import { isAdmin } from '@/lib/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * 크론(KST 08:00)이 부르는 것과 같은 수집 함수 두 개. 순서가 중요하다 —
 * `sync-fixture`가 스코어와 `finished`를 먼저 넣어야 `sync-fixture-ratings`의 대상이 잡힌다.
 * 함수 본문은 `supabase/functions/*`에 있다.
 */
const SYNC_FUNCTIONS = ['sync-fixture', 'sync-fixture-ratings'] as const

export type SyncResult =
  | {
      success: true
      /** upsert된 경기 수 */
      fixtures: number
      /** upsert된 평점 행 수 */
      ratings: number
      /** 배치 상한(5경기) 때문에 남은 경기 수 — 0이 아니면 한 번 더 눌러야 한다 */
      remaining: number
    }
  | { error: 'mock_unsupported' | 'forbidden' | 'config' | 'failed'; detail?: string }

/**
 * 경기 결과·선수 평점을 지금 즉시 동기화한다(관리자 전용).
 *
 * 평상시엔 크론이 하루 한 번 같은 함수를 부르므로 이 버튼은 예외 처리용이다 —
 * 백필, 경기 연기, FotMob 평점이 늦게 확정된 경우, 응답 구조 변경 후 재적재.
 *
 * Edge Function이 `verify_jwt: true`라 service-role 키로 호출한다. 두 함수 모두 멱등하고
 * 할 일이 없으면 즉시 끝나므로 여러 번 눌러도 무해하다.
 */
export async function syncFixtureData(): Promise<SyncResult> {
  if (IS_MOCK) return { error: 'mock_unsupported' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user?.email)) return { error: 'forbidden' }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!baseUrl || !serviceRoleKey) return { error: 'config' }

  const bodies: Record<string, { upserted?: number; remaining?: number; message?: string }> = {}

  for (const name of SYNC_FUNCTIONS) {
    const response = await fetch(`${baseUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRoleKey}` },
      cache: 'no-store',
    })

    const body = await response.json().catch(() => null)

    if (!response.ok) {
      console.error('syncFixtureData error:', name, response.status, body)
      return { error: 'failed', detail: `${name}: ${body?.message ?? response.status}` }
    }

    bodies[name] = body ?? {}
  }

  // 목록·결과 화면이 읽는 fixtures 캐시(300초)를 즉시 비운다 — 눌렀는데 화면이 안 바뀌면
  // 동기화가 안 된 것처럼 보인다.
  revalidateTag('fixture-weeks')

  return {
    success: true,
    fixtures: bodies['sync-fixture']?.upserted ?? 0,
    ratings: bodies['sync-fixture-ratings']?.upserted ?? 0,
    remaining: bodies['sync-fixture-ratings']?.remaining ?? 0,
  }
}
