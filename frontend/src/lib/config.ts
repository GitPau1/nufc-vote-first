/**
 * Supabase 환경 변수가 없거나 placeholder 값이면 목 모드로 동작.
 * 배포 시 .env.local에 실제 NEXT_PUBLIC_SUPABASE_URL을 설정하면 자동으로 실제 DB 사용.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

/**
 * 이미지 URL 조립용 프로젝트 주소. mock 모드에서는 빈 문자열이라, 조립하는 쪽에서
 * falsy 검사로 null을 내고 컴포넌트 폴백(이니셜 원형 / 실루엣)에 맡긴다.
 */
export const SUPABASE_URL = url

export const IS_MOCK =
  !url ||
  url.trim() === '' ||
  !url.startsWith('http')

export const ENABLE_DEV_MOCK_AUTH =
  IS_MOCK ||
  (process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_MOCK_AUTH === 'true')
