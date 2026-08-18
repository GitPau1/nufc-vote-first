import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const headerStatusSource = fs.readFileSync(path.join(__dirname, 'HeaderAuthStatus.tsx'), 'utf8')
const appHeaderSource = fs.readFileSync(path.join(__dirname, 'AppHeader.tsx'), 'utf8')

test('public header does not block server render on auth lookup', () => {
  assert.doesNotMatch(appHeaderSource, /async function AppHeader|getHeaderAuth\(\)/)
  assert.match(appHeaderSource, /auth\?: HeaderAuth\s*\|\s*null/)
  assert.match(appHeaderSource, /<HeaderAuthStatus auth=\{auth\}/)
  assert.match(headerStatusSource, /useEffect/)
  assert.match(headerStatusSource, /getHeaderAuth\(\)/)
  assert.match(headerStatusSource, /auth === undefined/)
  assert.match(headerStatusSource, /<LoginButton \/>/)
})

test('app header uses the home header treatment by default', () => {
  assert.match(appHeaderSource, /h-\[62px\]/)
  assert.match(appHeaderSource, /backdrop-blur/)
  assert.match(appHeaderSource, /from-white/)
  assert.match(appHeaderSource, /justify-center/)
  assert.match(appHeaderSource, /text-title-3/)
  assert.match(appHeaderSource, /border-border/)
  assert.match(appHeaderSource, /NUFCVOTE/)
})
