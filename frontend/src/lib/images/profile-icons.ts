import { unstable_cache } from 'next/cache'
import { IS_MOCK, SUPABASE_URL } from '@/lib/config'

/** 시즌 누적 점수(total_points)에 따른 등급 아이콘이 모여 있는 공개 버킷.
 *  파일명 자체가 "이 점수 이상부터 적용" 임계값이다 — `{숫자}.webp` (예: 0.webp, 500.webp, 2000.webp).
 *  신규 등급을 추가하려면 이 버킷에 파일만 올리면 되고 코드 변경은 필요 없다. */
export const PROFILE_ICONS_BUCKET = 'profile-icons'

const THRESHOLD_FILENAME = /^(\d+)\.webp$/

/**
 * `profile-icons` 버킷을 나열해 "{숫자}.webp" 파일명만 파싱, 오름차순 정렬한 임계점수 배열로 반환.
 * 반드시 서비스 롤 클라이언트로만 `.list()`한다 — anon이 버킷 파일을 나열(enumerate)할 수 있는
 * SELECT/LIST 정책은 만들지 않는다(supabase/migrations/20260830160000_drop_player_photos_list_policy.sql
 * 에서 의도적으로 닫은 구멍을 재현하지 않기 위함, lib/actions/images.ts와 같은 서비스 롤 패턴 재사용).
 * mock 모드에서는 버킷 자체가 없으므로 `.list()`를 호출하지 않고 빈 배열을 반환한다 —
 * resolveProfileIconUrl이 결과적으로 null을 돌려줘 기존 아바타 폴백(이니셜)으로 떨어진다
 * (lib/predictions/week.ts의 teamLogoUrl mock 분기와 동일한 패턴).
 */
async function getProfileIconThresholdsUncached(): Promise<number[]> {
  if (IS_MOCK) return []

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await serviceSupabase.storage.from(PROFILE_ICONS_BUCKET).list()
  // 조회 실패는 던진다 — unstable_cache가 실패 결과를 캐시하지 않게 한다(다음 요청서 재시도).
  if (error) throw error

  const thresholds: number[] = []
  for (const file of data ?? []) {
    const match = THRESHOLD_FILENAME.exec(file.name)
    if (match) thresholds.push(Number(match[1]))
  }
  thresholds.sort((a, b) => a - b)
  return thresholds
}

/** squads.ts의 getPickCandidatesCached와 동일 패턴: 자산(버킷 파일 목록) 갱신이 드물어 TTL 1시간. */
export const getProfileIconThresholds = unstable_cache(
  getProfileIconThresholdsUncached,
  ['profile-icon-thresholds'],
  { revalidate: 3600 },
)

/**
 * 순수 함수 — I/O 없음. `thresholds` 중 `totalPoints` 이하인 것 중 최댓값을 골라 공개 URL을 조립한다.
 * thresholds가 비어있거나 totalPoints보다 작거나 같은 threshold가 하나도 없으면 null
 * (호출부는 null을 기존 아바타 폴백 UI로 처리한다).
 */
export function resolveProfileIconUrl(totalPoints: number, thresholds: number[]): string | null {
  let matched: number | null = null
  for (const threshold of thresholds) {
    if (threshold <= totalPoints && (matched === null || threshold > matched)) {
      matched = threshold
    }
  }
  if (matched === null) return null

  return `${SUPABASE_URL}/storage/v1/object/public/${PROFILE_ICONS_BUCKET}/${matched}.webp`
}

/**
 * getProfileIconThresholds()의 안전 래퍼 — Storage 조회 실패(getProfileIconThresholdsUncached의
 * 의도된 throw)를 여기서 흡수해 빈 배열로 되돌린다. 등급 아이콘은 부가 기능이라 이 조회 하나가
 * 실패했다고 헤더/댓글/마이페이지 등 무관한 화면 전체가 죽으면 안 된다 — 빈 배열이 들어가면
 * resolveProfileIconUrl이 null을 반환해 기존 아바타 폴백(이니셜)으로 자연스럽게 떨어진다.
 */
export async function getProfileIconThresholdsSafe(): Promise<number[]> {
  try {
    return await getProfileIconThresholds()
  } catch (error) {
    console.error('getProfileIconThresholds error:', error)
    return []
  }
}

/** 위 두 개를 합친 편의 함수 — 대부분의 호출부는 이것만 쓰면 됨. */
export async function getProfileIconUrl(totalPoints: number): Promise<string | null> {
  const thresholds = await getProfileIconThresholdsSafe()
  return resolveProfileIconUrl(totalPoints, thresholds)
}
