import sharp from 'sharp'

export type ImageUploadPreset =
  | 'general'
  | 'player-photo'
  | 'poll-thumbnail'
  | 'poll-option'

type PresetConfig = {
  width: number
  height?: number
  fit: 'inside' | 'cover'
  quality: number
}

const PRESETS: Record<ImageUploadPreset, PresetConfig> = {
  general: { width: 1280, fit: 'inside', quality: 72 },
  'player-photo': { width: 720, fit: 'inside', quality: 72 },
  'poll-thumbnail': { width: 1280, fit: 'inside', quality: 72 },
  'poll-option': { width: 720, fit: 'inside', quality: 70 },
}

const PRESET_VALUES = new Set<ImageUploadPreset>([
  'general',
  'player-photo',
  'poll-thumbnail',
  'poll-option',
])

export function getImageUploadPreset(value: FormDataEntryValue | string | null): ImageUploadPreset {
  const normalized = String(value ?? '').trim()
  return PRESET_VALUES.has(normalized as ImageUploadPreset) ? normalized as ImageUploadPreset : 'general'
}

export function createImageStoragePath(
  folder: string,
  _filename: string,
  now = Date.now(),
  random = Math.random().toString(36).slice(2),
) {
  const safeFolder = folder.replace(/^\/+|\/+$/g, '') || 'uploads'
  return `${safeFolder}/${now}-${random}.webp`
}

export async function optimizeImageForUpload(file: File, preset: ImageUploadPreset) {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.')
  }

  const config = PRESETS[preset]
  const input = Buffer.from(await file.arrayBuffer())
  const pipeline = sharp(input, { animated: false }).rotate()

  if (config.height) {
    pipeline.resize(config.width, config.height, {
      fit: config.fit,
      withoutEnlargement: false,
    })
  } else {
    pipeline.resize({
      width: config.width,
      height: config.height,
      fit: config.fit,
      withoutEnlargement: true,
    })
  }

  const bytes = await pipeline.webp({ quality: config.quality, effort: 6 }).toBuffer()
  return {
    bytes,
    contentType: 'image/webp' as const,
    extension: 'webp' as const,
  }
}
