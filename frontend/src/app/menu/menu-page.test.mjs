import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('menu page renders auth-aware actions', () => {
  const file = source('app/menu/page.tsx')
  const actions = source('app/menu/MenuActions.tsx')
  const logoutButton = source('app/menu/MenuLogoutButton.tsx')

  assert.match(file, /getHeaderAuth/)
  assert.match(file, /<AppHeader\s+showAuth=\{false\}/)
  assert.doesNotMatch(file, /<Card/)
  assert.doesNotMatch(file, /Avatar/)
  assert.doesNotMatch(file, /mailto:/)
  assert.match(actions, /피드백 남기기/)
  assert.match(actions, /href="\/my\/feedback"/)
  assert.match(actions, /내 정보/)
  assert.doesNotMatch(actions, /마이페이지/)
  assert.match(actions, /LoginModal/)
  assert.match(actions, /setLoginOpen\(true\)/)
  assert.match(logoutButton, /로그아웃/)
  assert.match(logoutButton, /router\.refresh\(\)/)
  assert.match(actions, /로그인하기/)
  assert.doesNotMatch(actions, /href="\/login/)
  assert.match(actions, /isAdmin/)
  assert.match(actions, /href="\/admin"/)
})

test('menu page applies the mobile layout foundation', () => {
  const file = source('app/menu/page.tsx')
  const actions = source('app/menu/MenuActions.tsx')

  assert.match(file, /bg-background px-5 pt-6 pb-24/)
  assert.match(actions, /flex flex-col gap-2/)
  assert.match(actions, /className="h-12 justify-start"/)
  assert.doesNotMatch(file, /bg-\[#f4f4f5\]/)
})
