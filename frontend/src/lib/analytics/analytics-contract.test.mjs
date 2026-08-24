import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

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

test('analytics source page taxonomy separates the prediction list from a week session', () => {
  const file = source('lib/analytics/mixpanel.ts')

  assert.match(file, /pathname === '\/predictions'[\s\S]{0,60}return 'predictions'/)
  assert.match(file, /pathname\.startsWith\('\/predictions\/'\)[\s\S]{0,60}return 'prediction_week'/)
})

test('analytics stitches client identity to the supabase user id used by server events', () => {
  const file = source('lib/analytics/mixpanel.ts')

  assert.match(file, /export function identifyUser\(userId: string\)/)
  assert.match(file, /mixpanel\.identify\(userId\)/)
  assert.match(file, /export function resetIdentity\(\)/)
  assert.match(file, /mixpanel\.reset\(\)/)
  // 같은 유저 중복 identify, 비로그인 상태 reset은 건너뛴다
  assert.match(file, /if \(identifiedUserId === userId\) return/)
  assert.match(file, /if \(identifiedUserId === null\) return/)
})

test('app analytics binds identity once via supabase auth state, not per navigation', () => {
  const file = source('components/composition/common/AppAnalytics.tsx')

  assert.match(file, /onAuthStateChange/)
  assert.match(file, /identifyUser\(session\.user\.id\)/)
  assert.match(file, /event === 'SIGNED_OUT'[\s\S]{0,40}resetIdentity\(\)/)
  assert.match(file, /if \(IS_MOCK\) return/)
  // identity 바인딩은 pathname에 의존하지 않는 1회성 effect여야 한다
  assert.match(file, /unsubscribe\?\.\(\)[\s\S]{0,20}\}[\s\S]{0,20}\}, \[\]\)/)
})

test('app analytics separates session starts from primary tab views', () => {
  const file = source('components/composition/common/AppAnalytics.tsx')

  assert.match(file, /sessionKey = 'nufc_vote_analytics_session_started'/)
  assert.match(file, /trackEvent\('session_started'/)
  assert.match(file, /trackEvent\('tab_viewed'/)
  assert.match(file, /tab: primaryTab/)
  assert.match(file, /pathname === '\/' \|\| pathname === '\/polls'/)
  assert.match(file, /pathname === '\/predictions'[\s\S]{0,40}return 'predictions'/)
  assert.match(file, /pathname === '\/players'/)
  assert.match(file, /pathname === '\/menu'/)
  assert.doesNotMatch(file, /trackEvent\('app_opened'/)
  assert.doesNotMatch(file, /trackEvent\('screen_viewed'/)
})

test('poll tab analytics does not duplicate tab_viewed with poll_feed_viewed', () => {
  const file = source('components/composition/common/AppAnalytics.tsx')
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

test('app level events carry the app-defined KST week key, not mixpanel default bucketing', () => {
  const file = source('components/composition/common/AppAnalytics.tsx')

  assert.match(file, /import \{ currentWeekKey \} from '@\/lib\/predictions\/week'/)
  assert.match(file, /const weekKey = currentWeekKey\(\)/)
  assert.match(file, /trackEvent\('session_started'[\s\S]{0,80}week_key: weekKey/)
  assert.match(file, /trackEvent\('tab_viewed'[\s\S]{0,120}week_key: weekKey/)
  assert.match(file, /trackEvent\('return_visit'[\s\S]{0,120}week_key: weekKey/)
})

test('prediction submit is tracked server side so the retention metric survives adblock', () => {
  const file = source('lib/actions/predictions.ts')

  assert.match(file, /import \{ trackServerEvent \} from '@\/lib\/analytics\/server'/)
  assert.match(file, /trackServerEvent\('prediction_submitted', user\.id/)
  assert.match(file, /week_key: weekKey/)
  assert.match(file, /match_count: built\.rows\.length/)
  // CST-006(부분 참여자 집계 미확정)을 소급 재분석할 수 있게 분모를 함께 남긴다
  assert.match(file, /week_match_count: week\.matches\.length/)
  assert.match(file, /is_partial: built\.rows\.length < week\.matches\.length/)
})

test('prediction result view closes the return-visit funnel with the submit week key', () => {
  const file = source('components/predict/PredictionResult.tsx')

  assert.match(file, /trackEvent\('prediction_result_viewed'/)
  assert.match(file, /week_key: week\.weekKey/)
  assert.match(file, /participated,/)
  assert.match(file, /total_entries: ranking\.length/)
})

test('prediction week click carries the screen-routing basis, not the copied CTA text', () => {
  const file = source('components/predict/PredictListClient.tsx')

  assert.match(file, /trackEvent\('prediction_week_clicked'/)
  assert.match(file, /week_status: week\.status/)
  assert.match(file, /has_pending: week\.hasPending/)
  // WeekAction의 문구를 복사하지 않는다 — 문구가 바뀌어도 이벤트가 어긋나지 않게
  assert.doesNotMatch(file, /예측하기|결과보기|제출완료/)
})

test('prediction flow tracks the funnel entry and per-step completion', () => {
  const file = source('components/predict/PredictionFlowClient.tsx')

  assert.match(file, /trackEvent\('prediction_flow_viewed'/)
  assert.match(file, /if \(submitted\) return/)
  assert.match(file, /trackEvent\('prediction_step_completed'/)
  assert.match(file, /onClick=\{\(\) => completeStep\('score', 'pick'\)\}/)
  assert.match(file, /onClick=\{\(\) => completeStep\('pick', 'confirm'\)\}/)
  // 스코어는 0-0 초기값이라 "미입력"이 없다 — 손대지 않은 경기 수로 대체
  assert.match(file, /untouched_score_count/)
  assert.match(file, /used_copy_picks: copyUsedRef\.current/)
})

test('prediction submit failures split the login wall from real errors', () => {
  const file = source('components/predict/PredictionFlowClient.tsx')

  assert.match(file, /trackEvent\('prediction_auth_required'/)
  assert.match(file, /trackEvent\('prediction_submit_failed'[\s\S]{0,120}error: result\.error/)
  // 성공은 서버가 보낸다 — 클라이언트에서 중복 발사하지 않는다
  assert.doesNotMatch(file, /trackEvent\('prediction_submitted'/)
})

test('prediction done view closes the client funnel without duplicating the server metric', () => {
  const file = source('components/predict/PredictionDone.tsx')

  assert.match(file, /trackEvent\('prediction_done_viewed'/)
  assert.match(file, /submitted_match_count: submittedMatches\.length/)
  assert.match(file, /missed_match_count: missedMatches\.length/)
  assert.doesNotMatch(file, /trackEvent\('prediction_submitted'/)
})

test('player rating changes and feedback pages track community reward and high-intent feedback', () => {
  const changesAnalytics = source('components/players/PlayerRatingChangesAnalytics.tsx')
  const feedbackForm = source('components/my/MyFeedbackForm.tsx')

  assert.match(changesAnalytics, /trackEvent\('player_rating_changes_viewed'/)
  assert.match(feedbackForm, /trackEvent\('feedback_submitted'/)
})
