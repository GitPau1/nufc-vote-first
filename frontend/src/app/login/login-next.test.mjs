import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('login page respects next parameter for mock and OAuth redirects', () => {
  const file = source('app/login/LoginPageClient.tsx')

  assert.match(file, /useSearchParams/)
  assert.match(file, /const next = searchParams\.get\('next'\) \?\? '\/'/)
  assert.match(file, /router\.push\(next\)/)
  assert.match(file, /auth\/callback\?next=\$\{encodeURIComponent\(next\)\}/)
})
