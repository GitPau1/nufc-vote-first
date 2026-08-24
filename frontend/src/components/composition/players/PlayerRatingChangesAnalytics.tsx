'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/analytics/mixpanel'

type PlayerRatingChangesAnalyticsProps = {
  hasAppliedWeek: boolean
  changedPlayerCount: number
}

export function PlayerRatingChangesAnalytics({
  hasAppliedWeek,
  changedPlayerCount,
}: PlayerRatingChangesAnalyticsProps) {
  useEffect(() => {
    trackEvent('player_rating_changes_viewed', {
      source_page: 'player_changes',
      has_applied_week: hasAppliedWeek,
      changed_player_count: changedPlayerCount,
    })
  }, [hasAppliedWeek, changedPlayerCount])

  return null
}
