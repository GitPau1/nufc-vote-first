import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('players page maps applied Pick One rating to overall and falls back to base rating', () => {
  const file = source('app/players/page.tsx')

  assert.match(file, /unstable_cache/)
  assert.match(file, /createPublicClient/)
  assert.match(file, /base_rating/)
  assert.match(file, /player_pick_one_ratings/)
  assert.match(file, /overall: Math\.round\(player\.pick_one_rating \?\? player\.base_rating\)/)
  assert.match(file, /rank: index \+ 1/)
  assert.match(file, /\.eq\('is_active', true\)/)
  assert.match(file, /\.order\('base_rating', \{ ascending: false/)
  assert.doesNotMatch(file, /Math\.max\(70, 96 - index\)/)
})

test('players page maps season stats into Pick One seasons text', () => {
  const file = source('app/players/page.tsx')

  assert.match(file, /getPlayerSeasonsFromSquadCsv/)
  assert.match(file, /@\/lib\/players\/season-data/)
  assert.match(file, /parseSeasonEndYear/)
  assert.match(file, /formatSeasonSpell/)
  assert.match(file, /seasonSpells/)
  assert.match(file, /seasonsByPlayerId/)
  assert.match(file, /seasons: formatPlayedSeasons/)
  assert.match(file, /\[\-\/\]/)
  assert.doesNotMatch(file, /\.from\('player_season_stats'\)/)
})

test('players page keeps separate season spells for returning players', () => {
  const file = source('app/players/page.tsx')

  assert.match(file, /currentStartYear !== previousEndYear/)
  assert.match(file, /\.join\(', '\)/)
})

test('players page uses the screenshot squad csv as the season source', () => {
  const file = source('lib/players/season-data.ts')

  assert.match(file, /newcastle_squads_from_screenshots_players_positions\.csv/)
  assert.match(file, /readFileSync/)
  assert.match(file, /getSeasonsByCsvName/)
  assert.match(file, /'앨런 시어러', 'Alan Shearer'/)
  assert.match(file, /'브루노 기마랑이스', 'Bruno Guimaraes'/)
  assert.match(file, /'마르틴 두브라브카', 'Martin Dubravka'/)
  assert.match(file, /'요안 위사', 'Yoane Wissa'/)
  assert.match(file, /'앤디 캐롤', 'Andy Carroll'/)
})
