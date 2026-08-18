import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function assertLinkDisablesPrefetch(relativePath, hrefPattern) {
  const file = source(relativePath)
  const linkPattern = new RegExp(`<Link[\\s\\S]{0,300}href=\\{?${hrefPattern}[\\s\\S]{0,300}prefetch=\\{false\\}`)
  assert.match(file, linkPattern, `${relativePath} should disable prefetch for ${hrefPattern}`)
}

test('expensive public navigation and repeated detail links do not prefetch RSC payloads', () => {
  assertLinkDisablesPrefetch('components/layout/BottomNav.tsx', 'href')
  assertLinkDisablesPrefetch('components/polls/PollCard.tsx', '`/polls/\\$\\{poll\\.id\\}`')
})
