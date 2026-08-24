import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = import.meta.dirname
const source = fs.readFileSync(path.join(__dirname, 'middleware.ts'), 'utf8')

test('middleware only performs auth lookups for protected routes', () => {
  assert.match(source, /PROTECTED_PREFIXES/)
  assert.match(source, /ADMIN_PREFIXES/)
  assert.match(source, /requiresAuth/)
  assert.match(source, /if \(!requiresAuth && !requiresAdmin\)/)
  assert.match(source, /'\/my\/:path\*'/)
  assert.match(source, /'\/admin\/:path\*'/)
  assert.doesNotMatch(source, /'\/menu\/:path\*'/)
  assert.doesNotMatch(source, /\/\(\(\?!_next\/static/)
})
