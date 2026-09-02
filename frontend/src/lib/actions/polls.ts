'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import { getPollList } from '@/lib/queries/polls'
import { datetimeLocalToKoreaIso } from '@/lib/datetime'
import type { PollType } from '@/types/database'
import { canAccessPollEdit, validatePollEditPayload, type PollEditPoll } from '@/lib/polls/poll-edit-eligibility'
import { resolveOldThumbnailToDelete } from '@/lib/images/storage-cleanup'

const POLL_THUMBNAIL_BUCKET = 'player-photos'
const POLL_THUMBNAIL_ALLOWED_FOLDERS = ['poll-thumbnails']

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

export async function updateUserPoll(
  pollId: string,
  formData: FormData
): Promise<{ success?: true; error?: string }> {
  if (IS_MOCK) {
    const { mockUpdatePoll } = await import('@/lib/mock/queries')
    return mockUpdatePoll(pollId, formData)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { getHeaderAuth } = await import('./auth')
  const auth = await getHeaderAuth()

  // .select()에 컬럼을 여러 개 나열하면 supabase-js 제네릭 타입 추론이 poll을 never로 좁힌다 —
  // queries/polls.ts의 AnyRow 캐스팅과 같은 우회.
  type PollEditRow = {
    status: PollEditPoll['status']
    scheduled_at: string | null
    closes_at: string
    created_by: string | null
    thumbnail_url: string | null
  }
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .select('status, scheduled_at, closes_at, created_by, thumbnail_url')
    .eq('id', pollId)
    .single() as { data: PollEditRow | null; error: { message: string } | null }
  if (pollError || !poll) return { error: '투표를 찾을 수 없습니다.' }

  const editPoll: PollEditPoll = {
    status: poll.status,
    scheduled_at: poll.scheduled_at,
    closes_at: poll.closes_at,
    created_by: poll.created_by,
  }

  if (!canAccessPollEdit(editPoll, { userId: auth?.userId ?? null, isAdmin: auth?.isAdmin ?? false })) {
    return { error: '수정 권한이 없습니다.' }
  }

  const payload: Record<string, string | null> = {}
  if (formData.has('title')) payload.title = String(formData.get('title') ?? '').trim()
  if (formData.has('description')) payload.description = String(formData.get('description') ?? '').trim() || null
  if (formData.has('thumbnail_url')) payload.thumbnail_url = String(formData.get('thumbnail_url') ?? '').trim() || null

  const check = validatePollEditPayload(editPoll, Object.keys(payload))
  if (!check.ok) return { error: '수정할 수 없는 항목입니다.' }

  if ('title' in payload && !payload.title) return { error: '투표 제목을 입력해주세요.' }

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const oldThumbnailUrl = poll.thumbnail_url as string | null
  const { error: updateError } = await serviceSupabase.from('polls').update(payload).eq('id', pollId)
  if (updateError) return { error: updateError.message }

  // 썸네일이 실제로 바뀐 경우에만 옛 파일 정리 시도 — 실패해도 저장 자체는 이미 끝난 성공이다.
  if ('thumbnail_url' in payload) {
    await cleanupOldPollThumbnail(serviceSupabase, pollId, oldThumbnailUrl, payload.thumbnail_url)
  }

  revalidatePath('/')
  revalidatePath('/polls')
  revalidatePath('/my')
  revalidatePath(`/polls/${pollId}`)
  return { success: true }
}

async function cleanupOldPollThumbnail(
  serviceSupabase: SupabaseClient,
  pollId: string,
  oldUrl: string | null,
  newUrl: string | null
) {
  const target = resolveOldThumbnailToDelete(oldUrl, newUrl, POLL_THUMBNAIL_BUCKET, POLL_THUMBNAIL_ALLOWED_FOLDERS)
  if (!target) return

  try {
    // 같은 URL을 다른 행이 참조 중이면 지우지 않는다 — database.ts상 URL 컬럼은
    // polls.thumbnail_url / poll_options.image_url 둘뿐이다(avatar_url·photo_url은 각각
    // users/players 도메인이라 poll 썸네일과 무관, 물리적으로도 다른 폴더 경로를 쓴다 —
    // team-logos/·players/ vs poll-thumbnails/<userId>/·poll-options/<userId>/).
    const [{ count: pollRefs }, { count: optionRefs }] = await Promise.all([
      serviceSupabase.from('polls').select('id', { count: 'exact', head: true })
        .eq('thumbnail_url', oldUrl).neq('id', pollId),
      serviceSupabase.from('poll_options').select('id', { count: 'exact', head: true })
        .eq('image_url', oldUrl),
    ])
    if ((pollRefs ?? 0) > 0 || (optionRefs ?? 0) > 0) return

    const { error } = await serviceSupabase.storage.from(POLL_THUMBNAIL_BUCKET).remove([target.path])
    if (error) console.error('updateUserPoll: 옛 썸네일 삭제 실패', error)
  } catch (error) {
    console.error('updateUserPoll: 옛 썸네일 삭제 중 예외', error)
  }
}
