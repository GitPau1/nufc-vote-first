import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const repoRoot = path.resolve(root, '..', '..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function repoSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8')
}

test('players page reads applied pick one ratings before falling back to base rating', () => {
  const file = source('app/players/page.tsx')

  assert.match(file, /player_pick_one_ratings/)
  assert.match(file, /overall: Math\.round\(player\.pick_one_rating \?\? player\.base_rating\)/)
})

test('players Pick One submits weekly choices and links to weekly changes', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /submitPickOneChoice/)
  assert.match(file, /이번주 변경 내역/)
  assert.match(file, /href="\/players\/changes"/)
})

test('weekly changes page renders latest applied rating changes', () => {
  const file = source('app/players/changes/page.tsx')

  assert.doesNotMatch(file, /dynamic = 'force-dynamic'/)
  assert.match(file, /revalidate = 3600/)
  assert.match(file, /getLatestPickOneRatingChanges/)
  assert.match(file, /이전 오버롤/)
  assert.match(file, /이후 오버롤/)
})

test('pick one action stores one weekly choice per user and unordered pair', () => {
  const file = source('lib/actions/player-pick-one.ts')

  assert.match(file, /submitPickOneChoice/)
  assert.match(file, /getKstWeekStart/)
  assert.match(file, /player_a_id/)
  assert.match(file, /player_b_id/)
  assert.match(file, /duplicate/)
})

test('pick one action limits each user to five choices per KST day', () => {
  const file = source('lib/actions/player-pick-one.ts')

  assert.match(file, /PICK_ONE_DAILY_CHOICE_LIMIT = 5/)
  assert.match(file, /getPickOneDailyChoiceStatus/)
  assert.match(file, /remaining: Math\.max\(0, PICK_ONE_DAILY_CHOICE_LIMIT - \(count \?\? 0\)\)/)
  assert.match(file, /duplicate: true, remaining/)
  assert.match(file, /getKstDayRange/)
  assert.match(file, /\.gte\('created_at', dayStart\.toISOString\(\)\)/)
  assert.match(file, /\.lt\('created_at', dayEnd\.toISOString\(\)\)/)
  assert.match(file, /\{ count: 'exact', head: true \}/)
  assert.match(file, /daily_limit/)
})

test('migration creates weekly pick one tables and Sunday KST cron', () => {
  const migration = repoSource('supabase/migrations/20260617130000_add_player_pick_one_weekly_ratings.sql')

  assert.match(migration, /CREATE TABLE public\.player_pick_one_choices/)
  assert.match(migration, /CREATE TABLE public\.player_pick_one_ratings/)
  assert.match(migration, /CREATE TABLE public\.player_pick_one_weekly_runs/)
  assert.match(migration, /CREATE TABLE public\.player_pick_one_rating_changes/)
  assert.match(migration, /apply_player_pick_one_week/)
  assert.match(migration, /0 15 \* \* 6/)
})

test('pick one weekly apply migration avoids run_id variable ambiguity', () => {
  const migration = repoSource('supabase/migrations/20260624120000_fix_player_pick_one_weekly_run_id.sql')

  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.apply_player_pick_one_week/)
  assert.match(migration, /current_run_id uuid/)
  assert.doesNotMatch(migration, /\brun_id uuid/)
  assert.doesNotMatch(migration, /WHERE id = run_id/)
})

test('weekly apply revalidates player cache after a successful batch', () => {
  const route = source('app/api/revalidate/route.ts')
  const migration = repoSource('supabase/migrations/20260624123000_revalidate_player_pick_one_cache.sql')

  assert.match(route, /revalidatePath\('\/players'\)/)
  assert.match(route, /revalidatePath\('\/players\/changes'\)/)
  assert.match(route, /REVALIDATE_SECRET/)
  assert.match(route, /request\.headers\.get\('authorization'\)/)
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS pg_net/)
  assert.match(migration, /player_pick_one_revalidation_config/)
  assert.match(migration, /net\.http_post/)
  assert.match(migration, /\/api\/revalidate/)
  assert.match(migration, /current_run_id/)
})

test('weekly rating application caps each player raw rating movement to two points', () => {
  const migration = repoSource('supabase/migrations/20260624124500_cap_pick_one_weekly_rating_delta.sql')

  assert.match(migration, /PICK One weekly rating movement cap/i)
  assert.match(migration, /least\(player_pick_one_rating_changes\.previous_rating \+ 2/)
  assert.match(migration, /greatest\(player_pick_one_rating_changes\.previous_rating - 2/)
  assert.match(migration, /new_overall = public\.pick_one_overall\(capped_rating\)/)
  assert.match(migration, /delta = public\.pick_one_overall\(capped_rating\) - previous_overall/)
})
