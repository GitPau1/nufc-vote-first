'use server'

import { IS_MOCK } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'
import { isFeedbackCategory, type FeedbackCategory } from '@/lib/feedback/categories'

export type SubmitFeedbackInput = {
  content: string
  category?: FeedbackCategory
  rating?: number | null
  pagePath?: string | null
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<{ error?: string }> {
  const trimmed = input.content.trim()

  if (!trimmed) return { error: '피드백을 입력해주세요.' }
  if (trimmed.length > 500) return { error: '피드백은 500자 이하로 입력해주세요.' }

  // 카테고리는 허용 집합만 인정, 아니면 'etc'로 흡수(/my/feedback은 category 없이 호출).
  const category: FeedbackCategory = isFeedbackCategory(input.category) ? input.category : 'etc'

  const rating = input.rating ?? null
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { error: '만족도 값이 올바르지 않아요.' }
  }

  const pagePath = input.pagePath ?? null

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
      category,
      rating,
      page_path: pagePath,
    })

  if (error) {
    console.error('submitFeedback error:', error)
    return { error: '저장에 실패했어요. 다시 시도해주세요.' }
  }

  return {}
}
