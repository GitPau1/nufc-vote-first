import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('bottom nav exposes poll, prediction, players, and menu tabs only', () => {
  const file = source('components/layout/BottomNav.tsx')

  assert.match(file, /href:\s*'\/'[\s\S]{0,80}label:\s*'투표'/)
  assert.match(file, /href:\s*'\/predictions'[\s\S]{0,80}label:\s*'예측'/)
  assert.match(file, /href:\s*'\/players'[\s\S]{0,80}label:\s*'역대 선수'/)
  assert.match(file, /href:\s*'\/menu'[\s\S]{0,80}label:\s*'메뉴'/)

  assert.doesNotMatch(file, /label:\s*'홈'/)
  assert.doesNotMatch(file, /label:\s*'내 정보'/)
})

test('bottom nav is visible on the four tab routes', () => {
  const file = source('components/layout/BottomNav.tsx')

  assert.match(file, /pathname !== '\/'/)
  assert.match(file, /pathname !== '\/polls'/)
  assert.match(file, /pathname !== '\/predictions'/)
  assert.match(file, /pathname !== '\/players'/)
  assert.match(file, /pathname !== '\/menu'/)
})
