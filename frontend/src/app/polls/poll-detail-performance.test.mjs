import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = import.meta.dirname

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
}

test('poll detail starts auth and poll fetch before awaiting either result', () => {
  const page = source('[id]/page.tsx')

  assert.match(page, /const pollPromise = getPollById\(id\)/)
  assert.match(page, /const userPromise = getCurrentUser\(\)/)
  // canEdit은 위에서 이미 얻은 user로 계산한다(isAdmin(user?.email)) — 별도 auth fetch
  // (getHeaderAuth) 없이 그대로 2-promise 병렬 구조.
  assert.match(page, /const \[user, poll\] = await Promise\.all\(\[userPromise, pollPromise\]\)/)
})
