import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const componentFile = readFileSync(new URL('./NavigationLoading.tsx', import.meta.url), 'utf8')
const layoutFile = readFileSync(new URL('../../app/layout.tsx', import.meta.url), 'utf8')

test('root layout includes a client-side navigation loading indicator', () => {
  assert.match(layoutFile, /import \{ NavigationLoading \}/)
  assert.match(layoutFile, /<NavigationLoading \/>/)
})

test('navigation loading indicator reacts to internal link clicks', () => {
  assert.match(componentFile, /'use client'/)
  assert.match(componentFile, /const SHOW_DELAY_MS = 120/)
  assert.match(componentFile, /const ROUTE_SETTLE_MS = 450/)
  assert.match(componentFile, /document\.addEventListener\('click'/)
  assert.match(componentFile, /closest\('a\[href\]'\)/)
  assert.match(componentFile, /setIsLoading\(true\)/)
  assert.match(componentFile, /setLoadingVariant\(getLoadingVariant\(nextUrl\.pathname\)\)/)
  assert.match(componentFile, /targetPathRef/)
  assert.match(componentFile, /showTimerRef/)
  assert.match(componentFile, /window\.setTimeout\(\(\) => \{/)
  assert.match(componentFile, /clearShowTimer\(\)/)
  assert.match(componentFile, /usePathname\(\)/)
  assert.match(componentFile, /role="status"/)
  assert.match(componentFile, /z-\[100\]/)
  assert.match(componentFile, /bottom-\[64px\]/)
  assert.match(componentFile, /페이지를 불러오는 중/)
  assert.match(componentFile, /aria-hidden="true"/)
  assert.match(componentFile, /animate-skeleton/)
  assert.match(componentFile, /PollsSkeleton/)
  assert.match(componentFile, /PlayersSkeleton/)
  assert.match(componentFile, /MenuSkeleton/)
  assert.match(componentFile, /TopBarOnly/)
  assert.match(componentFile, /case 'players'/)
  assert.match(componentFile, /case 'menu'/)
  assert.match(componentFile, /case 'top'/)
  assert.doesNotMatch(componentFile, /animate-spin/)
})

test('navigation loading indicator maps primary routes to matching skeletons', () => {
  assert.match(componentFile, /function getLoadingVariant\(pathname: string\)/)
  assert.match(componentFile, /pathname === '\/' \|\| pathname === '\/polls'/)
  assert.match(componentFile, /pathname === '\/players'/)
  assert.match(componentFile, /pathname === '\/menu'/)
  assert.match(componentFile, /return 'top'/)
  assert.doesNotMatch(componentFile, /pathname\.startsWith\('\/players'\)/)
})

test('skeleton routes do not render the top progress bar', () => {
  assert.match(componentFile, /function LoadingShell/)
  assert.match(componentFile, /if \(loadingVariant === 'top'\)/)
  assert.match(componentFile, /return <TopBarOnly \/>/)
  assert.match(componentFile, /return \(/)
  assert.match(componentFile, /renderLoadingBody\(loadingVariant\)/)
})

test('navigation loading remains covered briefly after the target path arrives', () => {
  assert.match(componentFile, /if \(targetPathRef\.current !== pathname\) return/)
  assert.match(componentFile, /Math\.max\(MIN_VISIBLE_MS - elapsed, ROUTE_SETTLE_MS\)/)
})
