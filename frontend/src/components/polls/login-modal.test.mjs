import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const modalSource = fs.readFileSync(path.join(__dirname, 'LoginModal.tsx'), 'utf8')
const menuActionsSource = fs.readFileSync(path.join(__dirname, '../../app/menu/MenuActions.tsx'), 'utf8')

test('login modal has prompt sheet and direct centered dialog variants', () => {
  assert.match(modalSource, /intent\?: 'prompt' \| 'direct'/)
  assert.match(modalSource, /@radix-ui\/react-dialog/)
  assert.match(modalSource, /top-1\/2/)
  assert.match(modalSource, /left-1\/2/)
  assert.match(modalSource, /-translate-x-1\/2/)
  assert.match(modalSource, /-translate-y-1\/2/)
  assert.match(modalSource, /max-w-\[448px\]/)
  assert.match(modalSource, /로그인이 필요해요/)
  assert.match(modalSource, /NUFCVOTE 로그인/)
  assert.match(modalSource, /Google로 로그인/)
})

test('menu opens direct login modal instead of participation prompt', () => {
  assert.match(menuActionsSource, /intent="direct"/)
  assert.match(menuActionsSource, /triggerAction="login"/)
})
