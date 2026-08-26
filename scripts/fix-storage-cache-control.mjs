// Supabase Storage 기존 파일의 Cache-Control 일괄 갱신.
//
// 왜: lib/actions/images.ts:30이 업로드에 cacheControl: '31536000'을 붙이지만
// 그 코드 이전에 올라간 파일에는 적용이 안 됐다. 2026-08-26 Lighthouse 4차 측정 기준
//   team-logos/*.png        Cache-Control 없음(TTL 0)  → 재방문마다 30KB 재다운로드
//   poll-thumbnails/*.webp  max-age=3600(1시간)        → 파일명에 타임스탬프가 있어 사실상 불변인데 1시간마다 재다운로드
//
// Storage에는 메타데이터만 고치는 API가 없다. 받아서 같은 경로에 다시 올리는 수밖에 없다
// (PUT = update, 경로가 같으므로 공개 URL은 그대로다).
//
// 실행 (기본은 dry-run, 아무것도 안 바꾼다):
//   node --env-file=frontend/.env.local scripts/fix-storage-cache-control.mjs
//   node --env-file=frontend/.env.local scripts/fix-storage-cache-control.mjs --apply
//
// 폴더를 지정하려면 인자로 넘긴다: ... --apply poll-options

const URL_BASE = process.env.SUPA_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPA_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'player-photos'
const TARGET = 'max-age=31536000'

if (!URL_BASE || !KEY) throw new Error('SUPA_URL / SUPA_KEY (또는 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) 필요')

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const folders = args.filter((a) => !a.startsWith('--'))
const roots = folders.length ? folders : ['team-logos', 'poll-thumbnails']

const H = { authorization: `Bearer ${KEY}`, apikey: KEY }

// list는 폴더도 같이 돌려준다(폴더는 id === null). 한 단계씩 내려가며 파일만 모은다.
async function walk(prefix) {
  const out = []
  for (let offset = 0; ; offset += 100) {
    const res = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { ...H, 'content-type': 'application/json' },
      body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    if (!res.ok) throw new Error(`list ${prefix} 실패: ${res.status} ${await res.text()}`)
    const items = await res.json()
    for (const it of items) {
      const path = prefix ? `${prefix}/${it.name}` : it.name
      if (it.id === null) out.push(...(await walk(path)))
      else out.push({ path, meta: it.metadata || {} })
    }
    if (items.length < 100) break
  }
  return out
}

let scanned = 0, skipped = 0, done = 0, failed = 0

for (const root of roots) {
  const files = await walk(root)
  console.log(`\n[${root}] 파일 ${files.length}개`)
  for (const { path, meta } of files) {
    scanned++
    const current = meta.cacheControl || '(없음)'
    if (current === TARGET) { skipped++; continue }
    const size = meta.size ? `${Math.round(meta.size / 1024)}KB` : '?'
    if (!apply) { console.log(`  DRY  ${current} → ${TARGET}  ${size}  ${path}`); continue }

    const get = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${path}`, { headers: H })
    if (!get.ok) { console.error(`  FAIL download ${get.status}  ${path}`); failed++; continue }
    const bytes = Buffer.from(await get.arrayBuffer())

    const put = await fetch(`${URL_BASE}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'PUT',
      headers: { ...H, 'content-type': meta.mimetype || 'application/octet-stream', 'cache-control': TARGET, 'x-upsert': 'true' },
      body: bytes,
    })
    if (!put.ok) { console.error(`  FAIL upload ${put.status} ${await put.text()}  ${path}`); failed++; continue }
    console.log(`  OK   ${current} → ${TARGET}  ${size}  ${path}`)
    done++
  }
}

console.log(`\n대상 ${scanned}개 / 이미 정상 ${skipped}개 / ${apply ? `갱신 ${done}개 / 실패 ${failed}개` : `갱신 예정 ${scanned - skipped}개 (dry-run — 반영하려면 --apply)`}`)
