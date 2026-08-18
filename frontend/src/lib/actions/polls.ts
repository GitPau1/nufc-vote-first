'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import { getPollList } from '@/lib/queries/polls'
import { datetimeLocalToKoreaIso } from '@/lib/datetime'
import type { PollType } from '@/types/database'

export async function loadMorePolls(page: number) {
  return getPollList(page)
}

export async function createUserPoll(formData: FormData): Promise<{ pollId?: string; error?: string }> {
  const type = (formData.get('type') as PollType) || 'subject_options'

  if (IS_MOCK) {
    return { pollId: 'poll-1' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const title = String(formData.get('title') ?? '').trim()
  const closesAtInput = String(formData.get('closes_at') ?? '').trim()
  const closesAt = datetimeLocalToKoreaIso(closesAtInput)
  if (!title) return { error: '투표 제목을 입력해주세요.' }
  if (!closesAtInput) return { error: '투표 종료일을 지정해주세요.' }
  if (new Date(closesAt).getTime() <= Date.now()) return { error: '종료일은 현재 이후로 지정해주세요.' }

  const playerId = String(formData.get('player_id') ?? '').trim() || null
  const optionsRaw = String(formData.get('options') ?? '')

  let options: Array<{ label: string; description?: string | null; player_id?: string | null; image_url?: string | null }>
  try {
    options = JSON.parse(optionsRaw) as Array<{ label: string; description?: string | null; player_id?: string | null; image_url?: string | null }>
  } catch {
    return { error: '선택지 형식이 올바르지 않습니다.' }
  }

  options = options
    .map(option => ({
      label: String(option.label ?? '').trim(),
      description: type === 'free_choice' && option.description ? String(option.description).trim() : null,
      player_id: option.player_id ?? null,
      image_url: option.image_url ? String(option.image_url).trim() : null,
    }))
    .filter(option => option.label)

  if (options.length < 2) return { error: '선택지를 최소 2개 입력해주세요.' }
  if (type === 'subject_options' && !playerId) return { error: '대상 선수를 선택해주세요.' }

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: poll, error: pollError } = await serviceSupabase
    .from('polls')
    .insert({
      title,
      type,
      description: String(formData.get('description') ?? '').trim() || null,
      player_id: type === 'subject_options' ? playerId : null,
      created_by: user.id,
      thumbnail_url: String(formData.get('thumbnail_url') ?? '').trim() || null,
      status: 'active',
      scheduled_at: null,
      closes_at: closesAt,
    })
    .select('id')
    .single()

  if (pollError || !poll) return { error: pollError?.message ?? '투표 생성에 실패했습니다.' }

  const optionRows = options.map((option, index) => ({
    poll_id: poll.id,
    label: option.label,
    description: option.description || null,
    player_id: option.player_id ?? null,
    image_url: option.image_url ?? null,
    display_order: index,
  }))

  const { error: optionError } = await serviceSupabase.from('poll_options').insert(optionRows)
  if (optionError) {
    await serviceSupabase.from('polls').delete().eq('id', poll.id)
    return { error: optionError.message }
  }

  revalidatePath('/')
  revalidatePath('/polls')
  revalidatePath('/my')
  return { pollId: poll.id }
}

export async function deleteUserPoll(pollId: string): Promise<{ error?: string }> {
  if (IS_MOCK) return { error: '데모 모드에서는 지원하지 않습니다.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: poll, error: pollError } = await serviceSupabase
    .from('polls')
    .select('id, created_by')
    .eq('id', pollId)
    .single()

  if (pollError || !poll) return { error: '투표를 찾을 수 없습니다.' }
  if (poll.created_by !== user.id) return { error: '내가 만든 투표만 삭제할 수 있습니다.' }

  const { data: comments } = await serviceSupabase
    .from('comments')
    .select('id')
    .eq('poll_id', pollId) as { data: Array<{ id: string }> | null }
  const commentIds = (comments ?? []).map(comment => comment.id)

  if (commentIds.length > 0) {
    const { error } = await serviceSupabase.from('comment_likes').delete().in('comment_id', commentIds)
    if (error) return { error: error.message }
  }

  for (const table of ['comments', 'votes', 'poll_options'] as const) {
    const { error } = await serviceSupabase.from(table).delete().eq('poll_id', pollId)
    if (error) return { error: error.message }
  }

  const { error: deleteError } = await serviceSupabase.from('polls').delete().eq('id', pollId)
  if (deleteError) return { error: deleteError.message }

  revalidatePath('/')
  revalidatePath('/polls')
  revalidatePath('/my')
  return {}
}
