// app/src/lib/admin.ts

/**
 * 주어진 이메일이 관리자인지 확인한다.
 * ADMIN_EMAILS 환경변수에 쉼표로 구분된 이메일 목록을 설정한다.
 * 예: ADMIN_EMAILS=geonhaa@gmail.com,other@example.com
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return adminEmails.includes(email.toLowerCase())
}
