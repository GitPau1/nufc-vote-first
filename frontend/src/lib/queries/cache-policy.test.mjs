import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

test('public Supabase query modules use Next cache for first-request TTFB', () => {
  for (const file of ['polls.ts', 'player-pick-one.ts', 'fixtures.ts', 'predictions.ts']) {
    assert.match(source(file), /unstable_cache/, `${file} should use unstable_cache`)
  }
})
