import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..')
const migrationsDir = path.join(root, 'supabase/migrations')

function allMigrations() {
  return fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .map(file => fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
    .join('\n')
}

test('hot poll and Pick One read paths have supporting indexes', () => {
  const sql = allMigrations()

  for (const indexName of [
    'votes_poll_id_idx',
    'votes_poll_id_user_id_idx',
    'comments_visible_poll_created_at_idx',
    'comment_likes_user_comment_idx',
    'rating_votes_poll_id_idx',
    'rating_votes_poll_user_idx',
    'rating_vote_likes_user_vote_idx',
    'player_pick_one_weekly_runs_applied_week_end_idx',
    'player_pick_one_rating_changes_run_delta_idx',
  ]) {
    assert.match(sql, new RegExp(`CREATE INDEX IF NOT EXISTS ${indexName}\\b`))
  }
})
