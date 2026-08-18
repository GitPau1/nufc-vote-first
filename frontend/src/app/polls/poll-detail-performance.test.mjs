import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
}

test('poll detail starts auth and poll fetch before awaiting either result', () => {
  const page = source('[id]/page.tsx')

  assert.match(page, /const pollPromise = getPollById\(id\)/)
  assert.match(page, /const userPromise = getCurrentUser\(\)/)
  assert.match(page, /const \[user, poll\] = await Promise\.all\(\[userPromise, pollPromise\]\)/)
})
