'use client'

import { useLoadingRouter } from '@/components/layout/NavigationLoading'
import { LoginModal } from '@/components/polls/LoginModal'

/**
 * 로그인 없이는 볼 수 없는 화면(관리자/피드백/투표 생성/온보딩/마이페이지)에서
 * `redirect('/login')` 대신 쓰는 게이트. /login 페이지 자체를 없앴으므로,
 * 화면 위에 로그인 모달을 바로 띄운다 — 별도 페이지로 이동하지 않는다.
 *
 * 로그인에 성공하면(mock) LoginModal이 onClose를 호출해 홈으로 보낸다.
 * 사용자가 그냥 닫아도 동일하게 홈으로 — 로그인 없이는 볼 컨텐츠가 없기 때문이다.
 */
export function RequireAuthModal() {
  const router = useLoadingRouter()

  return (
    <LoginModal
      open
      onClose={() => router.push('/')}
      intent="direct"
      triggerAction="login"
    />
  )
}
