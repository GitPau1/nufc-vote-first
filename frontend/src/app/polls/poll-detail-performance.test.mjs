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
  // TEA-17: canEdit 판정을 위해 getHeaderAuth()도 같은 Promise.all에 합류했다 — 세 fetch 모두
  // 어느 결과도 기다리기 전에 시작되는 병렬 패턴은 그대로다.
  assert.match(page, /const authPromise = getHeaderAuth\(\)/)
  assert.match(page, /const \[user, poll, auth\] = await Promise\.all\(\[userPromise, pollPromise, authPromise\]\)/)
})
