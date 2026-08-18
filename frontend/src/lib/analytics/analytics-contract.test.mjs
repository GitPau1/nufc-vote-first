import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('analytics source page taxonomy includes current community routes', () => {
  const file = source('lib/analytics/mixpanel.ts')

  assert.match(file, /pathname\.startsWith\('\/players\/changes'\)[\s\S]{0,60}return 'player_changes'/)
  assert.match(file, /pathname\.startsWith\('\/players'\)[\s\S]{0,60}return 'players'/)
  assert.match(file, /pathname\.startsWith\('\/my\/feedback'\)[\s\S]{0,60}return 'feedback'/)
  assert.match(file, /pathname\.startsWith\('\/menu'\)[\s\S]{0,60}return 'menu'/)
})

test('app analytics separates session starts from primary tab views', () => {
  const file = source('components/analytics/AppAnalytics.tsx')

  assert.match(file, /sessionKey = 'nufc_vote_analytics_session_started'/)
  assert.match(file, /trackEvent\('session_started'/)
  assert.match(file, /trackEvent\('tab_viewed'/)
  assert.match(file, /tab: primaryTab/)
  assert.match(file, /pathname === '\/' \|\| pathname === '\/polls'/)
  assert.match(file, /pathname === '\/players'/)
  assert.match(file, /pathname === '\/menu'/)
  assert.doesNotMatch(file, /trackEvent\('app_opened'/)
  assert.doesNotMatch(file, /trackEvent\('screen_viewed'/)
})

test('poll tab analytics does not duplicate tab_viewed with poll_feed_viewed', () => {
  const file = source('components/analytics/AppAnalytics.tsx')
  const pollList = source('components/polls/PollListClient.tsx')

  assert.doesNotMatch(file, /PollFeedAnalytics/)
  assert.doesNotMatch(file, /trackEvent\('poll_feed_viewed'/)
  assert.doesNotMatch(pollList, /PollFeedAnalytics/)
})

test('players page tracks the Pick One participation and reward loop', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.doesNotMatch(file, /trackEvent\('players_viewed'/)
  assert.match(file, /trackEvent\('pick_one_viewed'/)
  assert.match(file, /trackEvent\('pick_one_submitted'/)
  assert.match(file, /trackEvent\('pick_one_next_clicked'/)
  assert.match(file, /trackEvent\('player_rating_changes_clicked'/)
  assert.match(file, /trackEvent\('player_pick_one_auth_required'/)
})

test('player rating changes and feedback pages track community reward and high-intent feedback', () => {
  const changesAnalytics = source('components/players/PlayerRatingChangesAnalytics.tsx')
  const feedbackForm = source('components/my/MyFeedbackForm.tsx')

  assert.match(changesAnalytics, /trackEvent\('player_rating_changes_viewed'/)
  assert.match(feedbackForm, /trackEvent\('feedback_submitted'/)
})
