'use server'

import { IS_MOCK } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'

export async function submitFeedback(content: string): Promise<{ error?: string }> {
  const trimmed = content.trim()

  if (!trimmed) return { error: '피드백을 입력해주세요.' }
  if (trimmed.length > 500) return { error: '피드백은 500자 이하로 입력해주세요.' }

  if (IS_MOCK) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_feedback')
    .insert({
      user_id: user.id,
      content: trimmed,
    })

  if (error) {
    console.error('submitFeedback error:', error)
    return { error: '저장에 실패했어요. 다시 시도해주세요.' }
  }

  return {}
}
