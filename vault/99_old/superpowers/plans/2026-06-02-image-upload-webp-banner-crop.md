# Image Upload WebP Banner Crop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert uploaded poll and transfer images to optimized WebP files, and add a 21:9 adjustable crop flow for transfer banners.

**Architecture:** Put server-side image optimization in a focused `src/lib/images` utility and reuse it from admin and authenticated user upload actions. Keep existing database URL columns unchanged. Handle banner framing in a client component that writes a cropped WebP `File` into the existing form field before the existing submit handlers run.

**Tech Stack:** Next.js 14 server actions, Supabase Storage, React client components, Node test runner, `sharp` for server-side WebP conversion.

---

## File Structure

- Modify: `app/package.json`
  - Add `sharp`.
  - Add a focused image test script.
- Modify: `app/package-lock.json`
  - Updated by `npm install sharp`.
- Create: `app/src/lib/images/optimize.ts`
  - Own upload presets, MIME validation, WebP conversion, resize rules, and storage path generation.
- Create: `app/src/lib/images/optimize.test.mjs`
  - Unit tests for preset parsing, `.webp` paths, WebP content type, and 21:9 banner dimensions.
- Create: `app/src/lib/actions/images.ts`
  - Authenticated non-admin poll image upload action for user-created polls.
- Modify: `app/src/lib/actions/admin.ts`
  - Update `uploadPhoto` to use the optimizer and optional `preset`.
- Create: `app/src/components/images/BannerImageInput.tsx`
  - Client-side 21:9 preview, zoom, x/y controls, and cropped WebP file generation.
- Modify: `app/src/app/admin/AdminDashboard.tsx`
  - Add representative image file upload.
  - Use `preset` values when uploading poll thumbnails, poll options, player photos, and transfer banners.
  - Replace transfer banner file inputs with `BannerImageInput`.
- Modify: `app/src/components/polls/UserPollCreateForm.tsx`
  - Add representative image and free-choice option file uploads for user polls.
  - Upload user images before calling `createUserPoll`.

---

### Task 1: Add Image Optimizer Dependency and Failing Unit Test

**Files:**
- Modify: `app/package.json`
- Create: `app/src/lib/images/optimize.test.mjs`

- [ ] **Step 1: Install `sharp`**

Run:

```bash
cd app
npm install sharp
```

Expected:

```text
added ... packages
found 0 vulnerabilities
```

- [ ] **Step 2: Add the test script**

In `app/package.json`, add this script next to the existing test scripts:

```json
"test:images": "node --no-warnings --experimental-strip-types --test src/lib/images/optimize.test.mjs"
```

- [ ] **Step 3: Write the failing optimizer tests**

Create `app/src/lib/images/optimize.test.mjs`:

```js
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
  assert.equal(getImageUploadPreset('transfer-banner'), 'transfer-banner')
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

test('outputs transfer banners in a 21:9 frame', async () => {
  const file = await pngFile(2400, 2400)
  const result = await optimizeImageForUpload(file, 'transfer-banner')
  const metadata = await sharp(result.bytes).metadata()

  assert.equal(metadata.width, 1400)
  assert.equal(metadata.height, 600)
})
```

- [ ] **Step 4: Run the image tests and verify RED**

Run:

```bash
cd app
npm run test:images
```

Expected:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module .../src/lib/images/optimize.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/package-lock.json app/src/lib/images/optimize.test.mjs
git commit -m "test: cover image upload optimization"
```

---

### Task 2: Implement Server-Side WebP Optimization

**Files:**
- Create: `app/src/lib/images/optimize.ts`
- Test: `app/src/lib/images/optimize.test.mjs`

- [ ] **Step 1: Create the optimizer implementation**

Create `app/src/lib/images/optimize.ts`:

```ts
import sharp from 'sharp'

export type ImageUploadPreset =
  | 'general'
  | 'player-photo'
  | 'poll-thumbnail'
  | 'poll-option'
  | 'transfer-banner'

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
  'transfer-banner': { width: 1400, height: 600, fit: 'cover', quality: 72 },
}

const PRESET_VALUES = new Set<ImageUploadPreset>([
  'general',
  'player-photo',
  'poll-thumbnail',
  'poll-option',
  'transfer-banner',
])

export function getImageUploadPreset(value: FormDataEntryValue | string | null): ImageUploadPreset {
  const normalized = String(value ?? '').trim()
  return PRESET_VALUES.has(normalized as ImageUploadPreset) ? normalized as ImageUploadPreset : 'general'
}

export function createImageStoragePath(folder: string, _filename: string, now = Date.now(), random = Math.random().toString(36).slice(2)) {
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
```

- [ ] **Step 2: Run image tests and verify GREEN**

Run:

```bash
cd app
npm run test:images
```

Expected:

```text
# pass 4
# fail 0
```

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/images/optimize.ts app/src/lib/images/optimize.test.mjs
git commit -m "feat: add webp image optimizer"
```

---

### Task 3: Apply WebP Optimization to Admin Uploads

**Files:**
- Modify: `app/src/lib/actions/admin.ts`
- Test: `app/src/lib/images/optimize.test.mjs`

- [ ] **Step 1: Update imports**

In `app/src/lib/actions/admin.ts`, add:

```ts
import { createImageStoragePath, getImageUploadPreset, optimizeImageForUpload } from '@/lib/images/optimize'
```

- [ ] **Step 2: Replace `uploadPhoto` internals**

Replace the existing `uploadPhoto` body with:

```ts
export async function uploadPhoto(formData: FormData): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await requireAdmin()

    const file = formData.get('file') as File | null
    if (!file || file.size === 0) return { error: '파일이 없어요.' }

    const folder = (formData.get('folder') as string) || 'players'
    const preset = getImageUploadPreset(formData.get('preset'))
    const path = createImageStoragePath(folder, file.name)
    const optimized = await optimizeImageForUpload(file, preset)

    const { error } = await supabase.storage
      .from('player-photos')
      .upload(path, optimized.bytes, { contentType: optimized.contentType, upsert: true })

    if (error) return { error: error.message }

    const { data } = supabase.storage.from('player-photos').getPublicUrl(path)
    return { url: data.publicUrl }
  } catch (e) {
    return { error: (e as Error).message }
  }
}
```

- [ ] **Step 3: Run image tests**

Run:

```bash
cd app
npm run test:images
```

Expected:

```text
# fail 0
```

- [ ] **Step 4: Run TypeScript check**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected:

```text
no output
```

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/actions/admin.ts
git commit -m "feat: optimize admin image uploads"
```

---

### Task 4: Add Authenticated User Poll Image Upload Action

**Files:**
- Create: `app/src/lib/actions/images.ts`
- Test: `app/src/lib/images/optimize.test.mjs`

- [ ] **Step 1: Create the user upload server action**

Create `app/src/lib/actions/images.ts`:

```ts
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
```

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected:

```text
no output
```

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/actions/images.ts
git commit -m "feat: add user poll image upload action"
```

---

### Task 5: Add Banner Crop Input Component

**Files:**
- Create: `app/src/components/images/BannerImageInput.tsx`

- [ ] **Step 1: Create the banner crop component**

Create `app/src/components/images/BannerImageInput.tsx`:

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  name: string
  label: string
}

type CropState = {
  zoom: number
  x: number
  y: number
}

const OUTPUT_WIDTH = 1400
const OUTPUT_HEIGHT = 600

function setInputFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer()
  transfer.items.add(file)
  input.files = transfer.files
}

export function BannerImageInput({ name, label }: Props) {
  const previewRef = useRef<HTMLCanvasElement>(null)
  const hiddenFileRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 50, y: 50 })

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    }
  }, [sourceUrl])

  useEffect(() => {
    const image = imageRef.current
    const canvas = previewRef.current
    if (!image || !canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    canvas.width = OUTPUT_WIDTH
    canvas.height = OUTPUT_HEIGHT
    context.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)

    const scale = Math.max(OUTPUT_WIDTH / image.naturalWidth, OUTPUT_HEIGHT / image.naturalHeight) * crop.zoom
    const drawWidth = image.naturalWidth * scale
    const drawHeight = image.naturalHeight * scale
    const maxX = Math.max(0, drawWidth - OUTPUT_WIDTH)
    const maxY = Math.max(0, drawHeight - OUTPUT_HEIGHT)
    const offsetX = -maxX * (crop.x / 100)
    const offsetY = -maxY * (crop.y / 100)

    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
    canvas.toBlob(blob => {
      const input = hiddenFileRef.current
      if (!blob || !input) return
      setInputFile(input, new File([blob], 'banner.webp', { type: 'image/webp' }))
    }, 'image/webp', 0.72)
  }, [crop, sourceUrl])

  function handleSourceChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (!file) return
    if (sourceUrl) URL.revokeObjectURL(sourceUrl)
    const nextUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      imageRef.current = image
      setCrop({ zoom: 1, x: 50, y: 50 })
      setSourceUrl(nextUrl)
    }
    image.src = nextUrl
  }

  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground">
      <p>{label}</p>
      <input type="file" accept="image/*" onChange={handleSourceChange} className="mt-2 block w-full text-[12px]" />
      <input ref={hiddenFileRef} name={name} type="file" accept="image/webp" className="hidden" tabIndex={-1} />
      {sourceUrl && (
        <div className="mt-3 space-y-2">
          <canvas ref={previewRef} className="aspect-[21/9] w-full rounded-lg bg-[#07111f] object-cover" />
          <label className="block text-[11px] font-bold text-foreground">
            확대
            <input
              type="range"
              min="1"
              max="2.2"
              step="0.05"
              value={crop.zoom}
              onChange={event => setCrop(current => ({ ...current, zoom: Number(event.target.value) }))}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-[11px] font-bold text-foreground">
            가로 위치
            <input
              type="range"
              min="0"
              max="100"
              value={crop.x}
              onChange={event => setCrop(current => ({ ...current, x: Number(event.target.value) }))}
              className="mt-1 w-full"
            />
          </label>
          <label className="block text-[11px] font-bold text-foreground">
            세로 위치
            <input
              type="range"
              min="0"
              max="100"
              value={crop.y}
              onChange={event => setCrop(current => ({ ...current, y: Number(event.target.value) }))}
              className="mt-1 w-full"
            />
          </label>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected:

```text
no output
```

- [ ] **Step 3: Commit**

```bash
git add app/src/components/images/BannerImageInput.tsx
git commit -m "feat: add banner crop input"
```

---

### Task 6: Wire Admin Poll and Transfer Uploads

**Files:**
- Modify: `app/src/app/admin/AdminDashboard.tsx`

- [ ] **Step 1: Import the banner component**

In `app/src/app/admin/AdminDashboard.tsx`, add:

```ts
import { BannerImageInput } from '@/components/images/BannerImageInput'
```

- [ ] **Step 2: Upload admin poll representative files**

Inside `PollCreateForm.handleSubmit`, before `const result = await createPoll(fd)`, add:

```ts
      const thumbnailFile = fd.get('thumbnail_image_file') as File | null
      fd.delete('thumbnail_image_file')
      if (!String(fd.get('thumbnail_url') ?? '').trim() && thumbnailFile && thumbnailFile.size > 0) {
        const thumbnailForm = new FormData()
        thumbnailForm.set('file', thumbnailFile)
        thumbnailForm.set('folder', 'poll-thumbnails')
        thumbnailForm.set('preset', 'poll-thumbnail')
        const uploadResult = await uploadPhoto(thumbnailForm)
        if (uploadResult.error || !uploadResult.url) {
          onError(uploadResult.error ?? '대표 이미지 업로드에 실패했습니다.')
          return
        }
        fd.set('thumbnail_url', uploadResult.url)
      }
```

- [ ] **Step 3: Add the admin poll representative file input**

In `PollCreateForm`, after the `thumbnail_url` input, add:

```tsx
      <label className="block rounded-lg border border-dashed border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
        대표 이미지 첨부
        <input name="thumbnail_image_file" type="file" accept="image/*" className="mt-1 block w-full text-[11px]" />
      </label>
```

- [ ] **Step 4: Set admin free-choice option preset**

In the existing free-choice option upload block, after `uploadForm.set('folder', 'poll-options')`, add:

```ts
            uploadForm.set('preset', 'poll-option')
```

- [ ] **Step 5: Set player photo preset**

In both player photo upload blocks, after `photoForm.set('folder', 'players')`, add:

```ts
        photoForm.set('preset', 'player-photo')
```

- [ ] **Step 6: Set banner upload preset**

In both transfer banner upload blocks, after `bannerForm.set('folder', 'transfer-banners')`, add:

```ts
        bannerForm.set('preset', 'transfer-banner')
```

- [ ] **Step 7: Replace banner file labels**

Replace both transfer banner file labels with:

```tsx
                  <BannerImageInput name="banner_image_file" label="배너 이미지" />
```

- [ ] **Step 8: Run TypeScript check**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected:

```text
no output
```

- [ ] **Step 9: Commit**

```bash
git add app/src/app/admin/AdminDashboard.tsx
git commit -m "feat: wire admin webp image uploads"
```

---

### Task 7: Wire User Poll Image Uploads

**Files:**
- Modify: `app/src/components/polls/UserPollCreateForm.tsx`

- [ ] **Step 1: Import user image upload action**

In `app/src/components/polls/UserPollCreateForm.tsx`, add:

```ts
import { uploadPollImage } from '@/lib/actions/images'
```

- [ ] **Step 2: Add representative image upload before `createUserPoll`**

Inside `startTransition(async () => {`, before `const result = await createUserPoll(fd)`, add:

```ts
      const thumbnailFile = fd.get('thumbnail_image_file') as File | null
      fd.delete('thumbnail_image_file')
      if (!String(fd.get('thumbnail_url') ?? '').trim() && thumbnailFile && thumbnailFile.size > 0) {
        const thumbnailForm = new FormData()
        thumbnailForm.set('file', thumbnailFile)
        thumbnailForm.set('folder', 'poll-thumbnails')
        thumbnailForm.set('preset', 'poll-thumbnail')
        const uploadResult = await uploadPollImage(thumbnailForm)
        if (uploadResult.error || !uploadResult.url) {
          setMessage(uploadResult.error ?? '대표 이미지 업로드에 실패했습니다.')
          return
        }
        fd.set('thumbnail_url', uploadResult.url)
      }
```

- [ ] **Step 3: Add user free-choice option file upload**

In the `free_choice` branch, change the mapped option object to include an image field:

```ts
        .map((option, index) => ({
          label: option.label.trim(),
          description: option.description.trim() || null,
          image_url: option.imageUrl.trim() || null,
          imageField: `free_option_image_${index}`,
        }))
```

Then replace the existing `fd.set('options', JSON.stringify(options))` in the same branch with:

```ts
      fd.set('options', JSON.stringify(options.map(option => ({
        label: option.label,
        description: option.description,
        image_url: option.image_url,
        imageField: option.imageField,
      }))))
```

Inside `startTransition`, after the thumbnail upload block and before `createUserPoll`, add:

```ts
      if (pollType === 'free_choice') {
        const parsedOptions = JSON.parse(String(fd.get('options') ?? '[]')) as Array<{
          label: string
          description: string | null
          image_url: string | null
          imageField: string
        }>
        const uploadedOptions = []
        for (const option of parsedOptions) {
          const imageFile = fd.get(option.imageField) as File | null
          fd.delete(option.imageField)
          if (!option.image_url && imageFile && imageFile.size > 0) {
            const imageForm = new FormData()
            imageForm.set('file', imageFile)
            imageForm.set('folder', 'poll-options')
            imageForm.set('preset', 'poll-option')
            const uploadResult = await uploadPollImage(imageForm)
            if (uploadResult.error || !uploadResult.url) {
              setMessage(uploadResult.error ?? '선택지 이미지 업로드에 실패했습니다.')
              return
            }
            uploadedOptions.push({
              label: option.label,
              description: option.description,
              image_url: uploadResult.url,
            })
          } else {
            uploadedOptions.push({
              label: option.label,
              description: option.description,
              image_url: option.image_url,
            })
          }
        }
        fd.set('options', JSON.stringify(uploadedOptions))
      }
```

- [ ] **Step 4: Add user representative file input**

After the `thumbnail_url` input, add:

```tsx
          <label className="block rounded-md border border-dashed border-border px-3 py-2 text-[12px] font-semibold text-muted-foreground">
            대표 이미지 첨부
            <input name="thumbnail_image_file" type="file" accept="image/*" className="mt-1 block w-full text-[12px]" />
          </label>
```

- [ ] **Step 5: Add user free-choice option file inputs**

Inside each free-choice option block, after the image URL input, add:

```tsx
                    <label className="block rounded-md border border-dashed border-border px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                      선택지 이미지 첨부
                      <input name={`free_option_image_${index}`} type="file" accept="image/*" className="mt-1 block w-full text-[11px]" />
                    </label>
```

- [ ] **Step 6: Run TypeScript check**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected:

```text
no output
```

- [ ] **Step 7: Commit**

```bash
git add app/src/components/polls/UserPollCreateForm.tsx
git commit -m "feat: add user poll image uploads"
```

---

### Task 8: Verify End-to-End Behavior

**Files:**
- Verify only

- [ ] **Step 1: Run image tests**

Run:

```bash
cd app
npm run test:images
```

Expected:

```text
# fail 0
```

- [ ] **Step 2: Run existing focused tests**

Run:

```bash
cd app
npm run test:transfers
npm run test:rating
npm run test:vote-eligibility
```

Expected for each command:

```text
# fail 0
```

- [ ] **Step 3: Run TypeScript check**

Run:

```bash
cd app
npx tsc --noEmit
```

Expected:

```text
no output
```

- [ ] **Step 4: Start the app**

Run:

```bash
cd app
npm run dev
```

Expected:

```text
Ready
```

- [ ] **Step 5: Browser verification**

Open the local app in the in-app browser and verify:

- Admin poll creation shows representative image file upload.
- Admin free-choice option image upload still appears.
- Admin transfer banner upload shows 21:9 preview plus zoom, horizontal, and vertical sliders.
- User poll creation shows representative image upload.
- User free-choice option rows show image upload.

- [ ] **Step 6: Final commit if verification required fixes**

If Task 8 required fixes, commit only those files:

```bash
git add app/src
git commit -m "fix: polish image upload verification issues"
```

