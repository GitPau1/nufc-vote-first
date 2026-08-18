import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('admin route exists and links to remaining poll admin workflows', () => {
  const file = source('app/admin/page.tsx')

  assert.match(file, /getHeaderAuth/)
  assert.match(file, /redirect\('\/login'\)/)
  assert.match(file, /redirect\('\/'\)/)
  assert.match(file, /href="\/polls\/create"/)
  assert.match(file, /href="\/polls"/)
  assert.doesNotMatch(file, /AdminDashboard/)
  assert.doesNotMatch(file, /farewells|transfers|club_status/)
})
