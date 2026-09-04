'use server'

import { createClient } from '@/lib/supabase/server'
import { getServiceRoleClient } from '@/lib/supabase/service-client'
import { createImageStoragePath, getImageUploadPreset, optimizeImageForUpload } from '@/lib/images/optimize'
import { PLAYER_PHOTOS_BUCKET, POLL_UPLOAD_FOLDERS } from '@/lib/images/storage-cleanup'

const ALLOWED_FOLDERS = new Set(POLL_UPLOAD_FOLDERS)

export async function uploadPollImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  try {
    const file = formData.get('file') as File | null
    if (!file || file.size === 0) return { error: '파일이 없어요.' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: '로그인이 필요합니다.' }

    const folderInput = String(formData.get('folder') ?? 'poll-thumbnails').trim()
    const folder = ALLOWED_FOLDERS.has(folderInput) ? folderInput : 'poll-thumbnails'
    const preset = getImageUploadPreset(formData.get('preset'))
    const optimized = await optimizeImageForUpload(file, preset)
    const serviceSupabase = await getServiceRoleClient()
    const path = createImageStoragePath(`${folder}/${user.id}`, file.name)

    const { error } = await serviceSupabase.storage
      .from(PLAYER_PHOTOS_BUCKET)
      .upload(path, optimized.bytes, { contentType: optimized.contentType, upsert: true, cacheControl: '31536000' })

    if (error) return { error: error.message }

    const { data } = serviceSupabase.storage.from(PLAYER_PHOTOS_BUCKET).getPublicUrl(path)
    return { url: data.publicUrl }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
