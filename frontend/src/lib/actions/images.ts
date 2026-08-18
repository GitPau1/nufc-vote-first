'use server'

import { createClient } from '@/lib/supabase/server'
import { createImageStoragePath, getImageUploadPreset, optimizeImageForUpload } from '@/lib/images/optimize'

const ALLOWED_FOLDERS = new Set(['poll-thumbnails', 'poll-options'])

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
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const path = createImageStoragePath(`${folder}/${user.id}`, file.name)

    const { error } = await serviceSupabase.storage
      .from('player-photos')
      .upload(path, optimized.bytes, { contentType: optimized.contentType, upsert: true })

    if (error) return { error: error.message }

    const { data } = serviceSupabase.storage.from('player-photos').getPublicUrl(path)
    return { url: data.publicUrl }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
