'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { IS_MOCK } from '@/lib/config'
import { getSourcePage, identifyUser, resetIdentity, trackEvent } from '@/lib/analytics/mixpanel'
import { currentWeekKey } from '@/lib/predictions/week'

const RETURN_WINDOW_MS = 30 * 60 * 1000
type PrimaryTab = 'poll' | 'predictions' | 'players' | 'menu'

function getPrimaryTab(pathname: string): PrimaryTab | null {
  if (pathname === '/' || pathname === '/polls') return 'poll'
  if (pathname === '/predictions') return 'predictions'
  if (pathname === '/players') return 'players'
  if (pathname === '/menu') return 'menu'
  return null
}

export function AppAnalytics() {
  const pathname = usePathname()

  // 로그인 상태를 Mixpanel identity에 한 곳에서 묶는다. onAuthStateChange는 구독 직후
  // INITIAL_SESSION을 한 번 흘려주므로 이미 로그인된 유저도 첫 렌더에서 식별되고,
  // 로그아웃 버튼(MenuLogoutButton·UserMenu)과 OAuth 코드 교환도 자동으로 커버된다.
  useEffect(() => {
    if (IS_MOCK) return

    let active = true
    let unsubscribe: (() => void) | null = null

    async function bindIdentity() {
      const { createClient } = await import('@/lib/supabase/client')
      const { data } = createClient().auth.onAuthStateChange((event, session) => {
        if (!active) return

        if (session?.user) {
          identifyUser(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          resetIdentity()
        }
      })

      if (!active) {
        data.subscription.unsubscribe()
        return
      }
      unsubscribe = () => data.subscription.unsubscribe()
    }

    bindIdentity()

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    const sourcePage = getSourcePage(pathname)
    const sessionKey = 'nufc_vote_analytics_session_started'
    const lastSeenKey = 'nufc_vote_analytics_last_seen'
    const lastSeen = Number(localStorage.getItem(lastSeenKey) ?? 0)
    const now = Date.now()
    const isReturningSession = lastSeen > 0 && now - lastSeen > RETURN_WINDOW_MS
    const isNewSession = !sessionStorage.getItem(sessionKey) || isReturningSession

    // 주간 지표(WAU 중 참여 비율, 경기 있는 주 vs 없는 주 접속 격차)는 전부 이 키로 묶인다.
    // Mixpanel 기본 주간 버킷은 프로젝트 타임존 기준이라 앱의 KST ISO 주차와 어긋날 수 있어
    // 앱이 쓰는 것과 같은 정의를 프로퍼티로 직접 박는다.
    const weekKey = currentWeekKey()

    if (isNewSession) {
      trackEvent('session_started', { source_page: sourcePage, week_key: weekKey })
      sessionStorage.setItem(sessionKey, String(now))
    }

    const primaryTab = getPrimaryTab(pathname)
    if (primaryTab) {
      trackEvent('tab_viewed', {
        source_page: sourcePage,
        week_key: weekKey,
        tab: primaryTab,
      })
    }

    if (isReturningSession) {
      trackEvent('return_visit', {
        source_page: sourcePage,
        week_key: weekKey,
        hours_since_last_seen: Math.round((now - lastSeen) / 36_000) / 100,
      })
    }

    localStorage.setItem(lastSeenKey, String(now))
  }, [pathname])

  return null
}
