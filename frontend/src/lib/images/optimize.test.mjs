import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import {
  createImageStoragePath,
  getImageUploadPreset,
  optimizeImageForUpload,
} from './optimize.ts'

async function pngFile(width, height, name = 'source.png') {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#41b6e6',
    },
  }).png().toBuffer()

  return new File([buffer], name, { type: 'image/png' })
}

test('normalizes upload preset values', () => {
  assert.equal(getImageUploadPreset('poll-option'), 'poll-option')
  assert.equal(getImageUploadPreset('unknown'), 'general')
  assert.equal(getImageUploadPreset(null), 'general')
})

test('creates webp storage paths regardless of source extension', () => {
  const path = createImageStoragePath('poll-options', 'original.large.PNG', 1780385000000, 'abc123')
  assert.equal(path, 'poll-options/1780385000000-abc123.webp')
})

test('converts png uploads to webp with webp content type', async () => {
  const file = await pngFile(1800, 1200)
  const result = await optimizeImageForUpload(file, 'poll-thumbnail')
  const metadata = await sharp(result.bytes).metadata()

  assert.equal(result.extension, 'webp')
  assert.equal(result.contentType, 'image/webp')
  assert.equal(metadata.format, 'webp')
  assert.ok((metadata.width ?? 0) <= 1280)
})

test('preserves cropped poll thumbnail frame', async () => {
  const file = await pngFile(1200, 400, 'poll-thumbnail.webp')
  const result = await optimizeImageForUpload(file, 'poll-thumbnail')
  const metadata = await sharp(result.bytes).metadata()

  assert.equal(metadata.width, 1200)
  assert.equal(metadata.height, 400)
})

// 크롭 UI가 보낸 1000×1300이 서버에서 줄어들지 않아야 한다 — 줄어들면 크롭 화면이
// 약속한 해상도와 저장된 해상도가 어긋난다(2026-08-24: 720 → 1000으로 상한 상향).
test('preserves cropped poll option card frame', async () => {
  const file = await pngFile(1000, 1300, 'poll-option.webp')
  const result = await optimizeImageForUpload(file, 'poll-option')
  const metadata = await sharp(result.bytes).metadata()

  assert.equal(metadata.width, 1000)
  assert.equal(metadata.height, 1300)
})

// 상한을 넘는 원본은 여전히 줄인다.
test('caps oversized poll option uploads at the preset width', async () => {
  const file = await pngFile(2000, 2600, 'poll-option.webp')
  const result = await optimizeImageForUpload(file, 'poll-option')
  const metadata = await sharp(result.bytes).metadata()

  assert.equal(metadata.width, 1000)
  assert.equal(metadata.height, 1300)
})
