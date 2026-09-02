import { SUPABASE_URL } from '@/lib/config'

/** 선수 사진·팀 로고·poll 썸네일·선택지 이미지가 전부 모여 있는 단일 버킷.
 *  images.ts(업로드)·polls.ts(삭제) 양쪽이 같은 리터럴을 중복해서 갖지 않도록 여기서만 정의한다. */
export const PLAYER_PHOTOS_BUCKET = 'player-photos'

/** uploadPollImage(images.ts)가 허용하는 업로드 대상 폴더. */
export const POLL_UPLOAD_FOLDERS = ['poll-thumbnails', 'poll-options']

/** cleanupOldPollThumbnail(polls.ts)이 삭제를 허용하는 폴더 — 위 업로드 허용 목록의
 *  부분집합이다. 의도적으로 poll-thumbnails만 허용한다: poll_options.image_url
 *  (poll-options/ 폴더)에는 이 삭제 로직과 같은 교차 참조 확인·정리 경로가 따로 없어서,
 *  같이 지우면 다른 옵션이 참조 중인 파일을 실수로 지울 위험이 있다. */
export const POLL_THUMBNAIL_DELETE_FOLDERS = ['poll-thumbnails']

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

/** DB 교차 참조 확인(count 쿼리) 결과로 옛 썸네일 삭제를 진행해도 되는지 판별하는
 *  순수 함수. 조회 자체가 실패하면 count는 null로 온다 — `(count ?? 0) > 0`만 보면
 *  에러 시에도 항상 false가 되어 "참조 없음"으로 오판해 삭제를 진행해버릴 수 있다.
 *  그래서 에러도 함께 받아, 하나라도 있으면(참조 여부를 모르는 것이므로) 안전하게
 *  삭제를 건너뛴다. */
export function canDeleteOldThumbnail(refs: {
  pollRefs: number | null
  pollRefsError: unknown
  optionRefs: number | null
  optionRefsError: unknown
}): boolean {
  if (refs.pollRefsError || refs.optionRefsError) return false
  if ((refs.pollRefs ?? 0) > 0) return false
  if ((refs.optionRefs ?? 0) > 0) return false
  return true
}
