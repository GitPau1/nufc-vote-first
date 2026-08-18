'use client'

import { useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { getSourcePage, trackEvent } from '@/lib/analytics/mixpanel'

/**
 * 어느 페이지에 `?code=` 파라미터가 붙어 돌아오든 세션 교환을 처리한다.
 * Supabase OAuth는 Site URL로 리다이렉트하므로 /auth/callback 대신 /에 코드가 오는 경우가 있음.
 */
export function AuthCodeHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const code = searchParams.get('code')

  useEffect(() => {
    if (!code) return

    async function exchange() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code!)
      if (!error) {
        trackEvent('login_completed', {
          source_page: getSourcePage(pathname),
          method: 'google',
        })
        // 코드 파라미터 제거 후 서버 컴포넌트 재렌더링
        router.replace(pathname)
        router.refresh()
      } else {
        console.error('[AuthCodeHandler] exchange failed:', error.message)
        router.replace(pathname)
      }
    }

    exchange()
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
