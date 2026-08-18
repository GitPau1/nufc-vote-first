import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('root route renders the poll tab without redirecting away from /', () => {
  const file = source('app/page.tsx')

  assert.doesNotMatch(file, /redirect\('\/polls'\)/)
  assert.match(file, /import\s+PollsPage\s+from\s+'@\/app\/polls\/page'/)
  assert.match(file, /<PollsPage\s*\/>/)
})
