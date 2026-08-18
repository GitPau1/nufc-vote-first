'use client'

import mixpanel from 'mixpanel-browser'

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>

let initialized = false

function initMixpanel(): boolean {
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN
  if (!token) return false

  if (!initialized) {
    mixpanel.init(token, {
      debug: process.env.NODE_ENV === 'development',
      persistence: 'localStorage',
    })
    initialized = true
  }

  return true
}

function getSessionProperties(): AnalyticsProperties {
  if (typeof window === 'undefined') return {}

  const sessionKey = 'nufc_vote_analytics_session'
  const firstSessionKey = 'nufc_vote_analytics_first_session'
  const hasSeenKey = 'nufc_vote_analytics_has_seen'

  if (!sessionStorage.getItem(sessionKey)) {
    const isFirstSession = !localStorage.getItem(hasSeenKey)
    sessionStorage.setItem(sessionKey, String(Date.now()))
    sessionStorage.setItem(firstSessionKey, isFirstSession ? 'true' : 'false')
    localStorage.setItem(hasSeenKey, 'true')
  }

  return {
    is_first_session: sessionStorage.getItem(firstSessionKey) === 'true',
  }
}

export function trackEvent(eventName: string, properties: AnalyticsProperties = {}) {
  if (!initMixpanel()) return

  mixpanel.track(eventName, {
    ...getSessionProperties(),
    ...properties,
  })
}

export function getSourcePage(pathname: string): string {
  if (pathname === '/') return 'home'
  if (pathname === '/polls') return 'polls'
  if (pathname.startsWith('/polls/create')) return 'create'
  if (pathname.startsWith('/polls/')) return 'poll_detail'
  if (pathname.startsWith('/players/changes')) return 'player_changes'
  if (pathname.startsWith('/players')) return 'players'
  if (pathname.startsWith('/my/feedback')) return 'feedback'
  if (pathname.startsWith('/my')) return 'my'
  if (pathname.startsWith('/menu')) return 'menu'
  return 'direct'
}
