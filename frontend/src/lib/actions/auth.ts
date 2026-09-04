'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ENABLE_DEV_MOCK_AUTH, IS_MOCK } from '@/lib/config'
import { isAdmin } from '@/lib/admin'
import { getMySeasonRow } from '@/lib/queries/predictions'
import { getProfileIconThresholdsSafe, resolveProfileIconUrl } from '@/lib/images/profile-icons'

export type HeaderAuth = {
  userId?: string
  displayName?: string
  avatarUrl?: string
  isAdmin: boolean
}

type HeaderProfile = {
  display_name: string | null
  deleted_at: string | null
}

export async function getHeaderAuth(): Promise<HeaderAuth | null> {
  if (IS_MOCK || ENABLE_DEV_MOCK_AUTH) {
    const cookieStore = await cookies()
    if (!cookieStore.get('mock-auth')) return null

    const adminEmail = process.env.ADMIN_EMAILS?.split(',')[0]?.trim()
    const email = adminEmail || 'mock@example.com'

    return {
      userId: 'mock-user',
      displayName: 'Mock User',
      isAdmin: isAdmin(email),
    }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return null

  // display_name 조회·시즌 점수 조회·등급 아이콘 임계값 목록 조회는 서로 의존하지 않아 병렬로 보낸다.
  // 예측 미참여 유저는 season_leaderboard에 행 자체가 없을 수 있다 — 이 경우 0점(기본 등급)으로 간주(plan 6-4).
  // 등급 아이콘 임계값 목록은 total_points와 무관하므로 점수 조회를 기다리지 않고 같이 가져온다.
  // Safe 버전을 써서 Storage 조회 실패는 던지지 않고 빈 배열로 폴백한다 — 헤더 로그인 상태 전체가
  // 부가 기능(등급 아이콘) 실패로 깨지면 안 된다(다른 호출부와 동일 패턴, profile-icons.ts 참고).
  const [{ data: profile }, mySeasonRow, iconThresholds] = await Promise.all([
    supabase
      .from('users')
      .select('display_name, deleted_at')
      .eq('id', data.user.id)
      .single<HeaderProfile>(),
    getMySeasonRow(data.user.id),
    getProfileIconThresholdsSafe(),
  ])
  const totalPoints = mySeasonRow?.total_points ?? 0
  const avatarUrl = resolveProfileIconUrl(totalPoints, iconThresholds)

  // 24시간 유예 안에 재로그인하면 탈퇴를 취소한다. pg_cron이 24시간 지난 계정은
  // auth.users를 하드 삭제하므로, 기존 id로 로그인에 성공했다는 것 자체가
  // "아직 안 지워졌다"를 보장한다 — 별도 만료 체크가 필요 없다.
  if (profile?.deleted_at) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('users').update({ deleted_at: null }).eq('id', data.user.id)
  }

  return {
    userId: data.user.id,
    displayName: profile?.display_name ?? data.user.user_metadata?.name ?? undefined,
    avatarUrl: avatarUrl ?? undefined,
    isAdmin: isAdmin(data.user.email),
  }
}

export async function submitDeleteAccount(): Promise<{ error?: string }> {
  if (IS_MOCK) return {} // MyPageClient가 이미 이 분기 이전에 alert로 막지만 방어적으로 유지

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('users')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: '탈퇴 처리 중 오류가 발생했습니다.' }
  return {}
}

export async function mockLogin() {
  if (!IS_MOCK && !ENABLE_DEV_MOCK_AUTH) return

  const cookieStore = await cookies()
  cookieStore.set('mock-auth', 'true', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7일
  })
  revalidatePath('/', 'layout')
}

export async function mockLogout() {
  if (!IS_MOCK && !ENABLE_DEV_MOCK_AUTH) return

  const cookieStore = await cookies()
  cookieStore.delete('mock-auth')
  revalidatePath('/', 'layout')
}
