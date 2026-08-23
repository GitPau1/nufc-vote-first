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

/** 마지막으로 identify한 유저 — 같은 유저로 중복 호출하지 않게 기억한다. */
let identifiedUserId: string | null = null

/**
 * 로그인한 유저를 Supabase user.id로 식별한다.
 *
 * 서버 이벤트(`trackServerEvent`)가 distinct_id로 user.id를 쓰기 때문에, 여기서 같은 값으로
 * identify해야 클라이언트 이벤트와 서버 이벤트가 한 사람으로 합쳐진다. 이게 없으면 유저 단위
 * 리텐션(연속 N주 참여율)을 계산할 수 없다 — 디바이스마다 다른 사람으로 잡힌다.
 */
export function identifyUser(userId: string) {
  if (!initMixpanel()) return
  if (identifiedUserId === userId) return

  mixpanel.identify(userId)
  identifiedUserId = userId
}

/**
 * 로그아웃 시 익명 ID로 되돌린다.
 *
 * identify한 적이 없으면 아무것도 하지 않는다 — 비로그인 상태에서 reset을 부르면 익명
 * 디바이스 ID가 매번 새로 발급되어 비로그인 퍼널이 끊긴다.
 */
export function resetIdentity() {
  if (!initMixpanel()) return
  if (identifiedUserId === null) return

  mixpanel.reset()
  identifiedUserId = null
}

export function getSourcePage(pathname: string): string {
  if (pathname === '/') return 'home'
  if (pathname === '/polls') return 'polls'
  if (pathname.startsWith('/polls/create')) return 'create'
  if (pathname.startsWith('/polls/')) return 'poll_detail'
  if (pathname === '/predictions') return 'predictions'
  if (pathname.startsWith('/predictions/')) return 'prediction_week'
  if (pathname.startsWith('/players/changes')) return 'player_changes'
  if (pathname.startsWith('/players')) return 'players'
  if (pathname.startsWith('/my/feedback')) return 'feedback'
  if (pathname.startsWith('/my')) return 'my'
  if (pathname.startsWith('/menu')) return 'menu'
  return 'direct'
}
