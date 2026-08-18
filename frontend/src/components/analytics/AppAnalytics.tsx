'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getSourcePage, trackEvent } from '@/lib/analytics/mixpanel'

const RETURN_WINDOW_MS = 30 * 60 * 1000
type PrimaryTab = 'poll' | 'players' | 'menu'

function getPrimaryTab(pathname: string): PrimaryTab | null {
  if (pathname === '/' || pathname === '/polls') return 'poll'
  if (pathname === '/players') return 'players'
  if (pathname === '/menu') return 'menu'
  return null
}

export function AppAnalytics() {
  const pathname = usePathname()

  useEffect(() => {
    const sourcePage = getSourcePage(pathname)
    const sessionKey = 'nufc_vote_analytics_session_started'
    const lastSeenKey = 'nufc_vote_analytics_last_seen'
    const lastSeen = Number(localStorage.getItem(lastSeenKey) ?? 0)
    const now = Date.now()
    const isReturningSession = lastSeen > 0 && now - lastSeen > RETURN_WINDOW_MS
    const isNewSession = !sessionStorage.getItem(sessionKey) || isReturningSession

    if (isNewSession) {
      trackEvent('session_started', { source_page: sourcePage })
      sessionStorage.setItem(sessionKey, String(now))
    }

    const primaryTab = getPrimaryTab(pathname)
    if (primaryTab) {
      trackEvent('tab_viewed', {
        source_page: sourcePage,
        tab: primaryTab,
      })
    }

    if (isReturningSession) {
      trackEvent('return_visit', {
        source_page: sourcePage,
        hours_since_last_seen: Math.round((now - lastSeen) / 36_000) / 100,
      })
    }

    localStorage.setItem(lastSeenKey, String(now))
  }, [pathname])

  return null
}
