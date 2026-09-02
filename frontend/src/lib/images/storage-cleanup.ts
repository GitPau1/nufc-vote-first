import { SUPABASE_URL } from '@/lib/config'

/** 공개 URL이 우리 버킷의 객체 URL이면 스토리지 경로를 돌려주고, 아니면 null.
 *  사용자가 thumbnail_url에 외부 URL을 직접 입력할 수 있으므로(UserPollCreateForm.tsx의
 *  텍스트 입력 필드) 반드시 이 판별을 거친 뒤에만 삭제 대상으로 취급한다.
 *  `allowedFolders`가 주어지면 그 폴더 아래 경로만 허용한다 — 같은 버킷에 선수 사진(players/)·
 *  팀 로고(team-logos/)도 들어 있어, poll 썸네일 자리에 그 URL이 붙었을 수 있는 경우를 막는다. */
export function getStorageObjectPath(
  url: string | null | undefined,
  bucket: string,
  allowedFolders?: string[]
): string | null {
  if (!url || !SUPABASE_URL) return null
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/`
  if (!url.startsWith(prefix)) return null
  const path = url.slice(prefix.length)
  if (!path) return null
  if (allowedFolders && !allowedFolders.some(folder => path.startsWith(`${folder}/`))) return null
  return path
}

/** 옛 썸네일을 지워도 되는지 최종 판별(DB 교차 참조 확인은 별도 — 이 함수는 순수 판별만).
 *  - 옛 URL이 없으면 지울 게 없음
 *  - 새 URL과 옛 URL이 같으면(사용자가 그대로 둠) 지우면 안 됨
 *  - 우리 버킷 URL이 아니거나 허용 폴더 밖이면 지우면 안 됨 */
export function resolveOldThumbnailToDelete(
  oldUrl: string | null | undefined,
  newUrl: string | null | undefined,
  bucket: string,
  allowedFolders?: string[]
): { path: string } | null {
  if (!oldUrl) return null
  if (oldUrl === newUrl) return null
  const path = getStorageObjectPath(oldUrl, bucket, allowedFolders)
  return path ? { path } : null
}
