'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { IS_MOCK } from '@/lib/config'

function validateNickname(displayName: string): string | null {
  if (!displayName || displayName.length < 2 || displayName.length > 12)
    return '닉네임은 2~12자로 입력해주세요.'
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(displayName))
    return '특수문자는 사용할 수 없어요.'
  return null
}

/** 온보딩 완료 후 저장 — redirect('/')로 이동 */
export async function saveNickname(formData: FormData): Promise<{ error?: string }> {
  const displayName = (formData.get('displayName') as string)?.trim()
  const validationError = validateNickname(displayName)
  if (validationError) return { error: validationError }

  if (IS_MOCK) {
    const cookieStore = await cookies()
    cookieStore.set('mock-display-name', displayName, { path: '/', httpOnly: true, sameSite: 'lax' })
    redirect('/')
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // upsert: 행이 없으면 생성, 있으면 display_name만 업데이트
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('users')
    .upsert({
      id: user.id,
      email: user.email ?? '',
      avatar_url: user.user_metadata?.avatar_url ?? null,
      display_name: displayName,
    }, { onConflict: 'id' })

  if (error) {
    console.error('saveNickname error:', error)
    return { error: '저장에 실패했어요. 다시 시도해주세요.' }
  }

  redirect('/')
}

/** 마이페이지에서 닉네임 수정 — redirect 없이 결과만 반환 */
export async function updateNickname(displayName: string): Promise<{ error?: string }> {
  const trimmed = displayName.trim()
  const validationError = validateNickname(trimmed)
  if (validationError) return { error: validationError }

  if (IS_MOCK) {
    const cookieStore = await cookies()
    cookieStore.set('mock-display-name', trimmed, { path: '/', httpOnly: true, sameSite: 'lax' })
    return {}
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('users')
    .upsert({
      id: user.id,
      email: user.email ?? '',
      avatar_url: user.user_metadata?.avatar_url ?? null,
      display_name: trimmed,
    }, { onConflict: 'id' })

  if (error) {
    console.error('updateNickname error:', error)
    return { error: '저장에 실패했어요. 다시 시도해주세요.' }
  }

  return {}
}
