'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import { getPollList } from '@/lib/queries/polls'
import { datetimeLocalToKoreaIso } from '@/lib/datetime'
import type { PollType } from '@/types/database'
import { isAdmin } from '@/lib/admin'
import { resolvePollEditUpdate, type PollEditPoll } from '@/lib/polls/poll-edit-eligibility'
import { resolveOldThumbnailToDelete, canDeleteOldThumbnail, PLAYER_PHOTOS_BUCKET, POLL_THUMBNAIL_DELETE_FOLDERS } from '@/lib/images/storage-cleanup'

export async function loadMorePolls(page: number) {
  return getPollList(page)
}

export async function createUserPoll(formData: FormData): Promise<{ pollId?: string; error?: string }> {
  const type = (formData.get('type') as PollType) || 'poll'

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
      description: option.description ? String(option.description).trim() : null,
      player_id: option.player_id ?? null,
      image_url: option.image_url ? String(option.image_url).trim() : null,
    }))
    .filter(option => option.label)

  if (options.length < 2) return { error: '선택지를 최소 2개 입력해주세요.' }

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
      player_id: playerId,
      created_by: user.id,
      thumbnail_url: String(formData.get('thumbnail_url') ?? '').trim() || null,
      status: 'active',
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

// .select()에 컬럼을 여러 개 나열하면 supabase-js 제네릭 타입 추론이 poll을 never로 좁힌다 —
// queries/polls.ts의 AnyRow 캐스팅과 같은 우회.
type PollEditRow = {
  status: PollEditPoll['status']
  closes_at: string
  created_by: string | null
  thumbnail_url: string | null
}

function formFieldOrUndefined(formData: FormData, key: string): string | undefined {
  return formData.has(key) ? String(formData.get(key) ?? '') : undefined
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

  // auth 확인(getUser)과 poll 조회를 병렬로 — 로그인 여부를 알기 전에도 poll 조회를 미리
  // 시작해둔다. getHeaderAuth()(비캐시 getUser + users 테이블 SELECT)를 또 부르지 않고,
  // 이미 여기서 얻은 user로 isAdmin(user.email)까지 직접 계산한다(createUserPoll·
  // sync-fixtures.ts가 이미 쓰는 방식과 동일).
  const userPromise = supabase.auth.getUser()
  const pollPromise = supabase
    .from('polls')
    .select('status, closes_at, created_by, thumbnail_url')
    .eq('id', pollId)
    .single()

  const [{ data: { user } }, pollResult] = await Promise.all([userPromise, pollPromise])
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: poll, error: pollError } = pollResult as { data: PollEditRow | null; error: { message: string } | null }
  if (pollError || !poll) return { error: '투표를 찾을 수 없습니다.' }

  const editPoll: PollEditPoll = {
    status: poll.status,
    closes_at: poll.closes_at,
    created_by: poll.created_by,
  }

  const resolved = resolvePollEditUpdate(
    editPoll,
    { userId: user.id, isAdmin: isAdmin(user.email) },
    {
      title: formFieldOrUndefined(formData, 'title'),
      description: formFieldOrUndefined(formData, 'description'),
      thumbnail_url: formFieldOrUndefined(formData, 'thumbnail_url'),
    }
  )
  if (!resolved.ok) return { error: resolved.error }
  const payload = resolved.payload

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const oldThumbnailUrl = poll.thumbnail_url
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
  const target = resolveOldThumbnailToDelete(oldUrl, newUrl, PLAYER_PHOTOS_BUCKET, POLL_THUMBNAIL_DELETE_FOLDERS)
  if (!target) return

  try {
    // 같은 URL을 다른 행이 참조 중이면 지우지 않는다 — database.ts상 URL 컬럼은
    // polls.thumbnail_url / poll_options.image_url 둘뿐이다(avatar_url·photo_url은 각각
    // users/players 도메인이라 poll 썸네일과 무관, 물리적으로도 다른 폴더 경로를 쓴다 —
    // team-logos/·players/ vs poll-thumbnails/<userId>/·poll-options/<userId>/).
    const [
      { count: pollRefs, error: pollRefsError },
      { count: optionRefs, error: optionRefsError },
    ] = await Promise.all([
      serviceSupabase.from('polls').select('id', { count: 'exact', head: true })
        .eq('thumbnail_url', oldUrl).neq('id', pollId),
      serviceSupabase.from('poll_options').select('id', { count: 'exact', head: true })
        .eq('image_url', oldUrl),
    ])
    // canDeleteOldThumbnail(storage-cleanup.ts)이 에러 유무까지 함께 판별한다 — count만 보면
    // 조회 실패 시 (null ?? 0) > 0이 항상 false가 되어 "참조 없음"으로 오판할 수 있다.
    if (!canDeleteOldThumbnail({ pollRefs, pollRefsError, optionRefs, optionRefsError })) {
      if (pollRefsError || optionRefsError) {
        console.error('updateUserPoll: 옛 썸네일 참조 확인 실패, 삭제 스킵', pollRefsError, optionRefsError)
      }
      return
    }

    const { error } = await serviceSupabase.storage.from(PLAYER_PHOTOS_BUCKET).remove([target.path])
    if (error) console.error('updateUserPoll: 옛 썸네일 삭제 실패', error)
  } catch (error) {
    console.error('updateUserPoll: 옛 썸네일 삭제 중 예외', error)
  }
}
