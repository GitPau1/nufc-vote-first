import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.dirname(new URL(import.meta.url).pathname)

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

test('public Supabase query modules use Next cache for first-request TTFB', () => {
  for (const file of ['polls.ts', 'player-pick-one.ts']) {
    assert.match(source(file), /unstable_cache/, `${file} should use unstable_cache`)
  }
})
