import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const file = fs.readFileSync(path.join(__dirname, 'MyPageClient.tsx'), 'utf8')

test('my page is ordered as account info, participated polls, account deletion', () => {
  assert.match(file, /내 계정 정보/)
  assert.match(file, /참여한 투표/)
  assert.match(file, /회원 탈퇴/)
  assert.doesNotMatch(file, /내가 만든 투표/)
  assert.doesNotMatch(file, /createdPolls/)
  assert.ok(file.indexOf('내 계정 정보') < file.indexOf('참여한 투표'))
  assert.ok(file.indexOf('참여한 투표') < file.indexOf('회원 탈퇴'))
})
