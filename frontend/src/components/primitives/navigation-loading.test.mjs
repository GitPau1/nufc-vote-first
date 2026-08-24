import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const componentFile = readFileSync(new URL('./navigation-loading.tsx', import.meta.url), 'utf8')
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
  assert.match(componentFile, /setLoadingVariant\(getLoadingVariant\(nextPath\)\)/)
  assert.match(componentFile, /beginLoading\(nextUrl\.pathname\)/)
  assert.match(componentFile, /fromPathRef/)
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
  assert.match(componentFile, /pathname === '\/predictions'/)
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

test('navigation loading hides after leaving the origin path (redirect arrivals included)', () => {
  // 도착 판정은 '예측 경로 일치'가 아니라 '출발 pathname에서 벗어남' —
  // 서버 리다이렉트로 다른 곳에 도착해도 4초 fallback까지 방치되지 않는다
  assert.match(componentFile, /if \(pathname === fromPathRef\.current\) return/)
  assert.match(componentFile, /Math\.max\(MIN_VISIBLE_MS - elapsed, ROUTE_SETTLE_MS\)/)
})

test('navigation loading also covers back/forward and programmatic pushes', () => {
  assert.match(componentFile, /window\.addEventListener\('popstate', handlePopState\)/)
  assert.match(componentFile, /beginLoading\(window\.location\.pathname\)/)
  assert.match(componentFile, /export function startNavigationLoading/)
  assert.match(componentFile, /export function useLoadingRouter/)
  assert.match(componentFile, /window\.removeEventListener\('popstate', handlePopState\)/)
  assert.match(componentFile, /window\.removeEventListener\(NAVIGATION_START_EVENT, handleProgrammatic\)/)
})

test('already-arrived navigations skip the skeleton', () => {
  assert.match(componentFile, /if \(pathnameRef\.current === nextPath\) return/)
  // 리다이렉트로 예측과 다른 곳에 이미 도착한 경우도 띄우지 않는다
  assert.match(componentFile, /if \(pathnameRef\.current !== fromPathRef\.current\) return/)
})

test('pathname guard is synced during render, not in a passive effect', () => {
  // 커밋이 긴 이동(캐시 히트 + 무거운 페이지)에서 show 타이머가 passive effect보다
  // 먼저 실행되면 옛 pathname을 보고 이미 그려진 화면 위에 스켈레톤을 띄운다 —
  // 렌더 중 갱신이면 커밋 안에서 항상 최신이 된다
  assert.match(componentFile, /pathnameRef\.current = pathname/)
  assert.doesNotMatch(componentFile, /useEffect\(\(\) => \{\s*pathnameRef\.current = pathname/)
})

test('programmatic navigation call sites use the loading-aware router', () => {
  for (const file of [
    '../../app/menu/MenuLogoutButton.tsx',
    '../composition/auth/RequireAuthModal.tsx',
    '../composition/polls/UserPollCreateForm.tsx',
    '../composition/predict/PredictionFlowClient.tsx',
    '../composition/predict/PredictListClient.tsx',
  ]) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /useLoadingRouter\(\)/, file)
    assert.doesNotMatch(source, /useRouter\(\)/, file)
  }
})

test('loading overlay follows the desktop layout of each route', () => {
  // 데스크탑에서 넓어지는 화면(polls·predictions)만 max-w-content로 같이 넓어진다
  assert.match(componentFile, /const WIDE_VARIANTS: LoadingVariant\[\] = \['polls', 'predictions'\]/)
  assert.match(componentFile, /WIDE_VARIANTS\.includes\(loadingVariant\) \? 'sm:max-w-content'/)
  // BottomNav가 데스크탑에서 사라지므로 하단 64px도 비워두지 않는다
  assert.match(componentFile, /bottom-\[64px\][^"`]*sm:bottom-0/)
  // AppHeader(62px) 아래부터 덮어야 스켈레톤이 실제 화면과 세로로 맞는다
  assert.match(componentFile, /top-\[62px\]/)
  // 상단 진행바는 데스크탑에서 폭이 잘리지 않아야 한다
  assert.doesNotMatch(componentFile, /h-1 w-full max-w-shell/)
  // 투표 목록 스켈레톤은 데스크탑 카드 그리드를 따라간다
  assert.match(componentFile, /divide-y divide-neutral-weak sm:hidden/)
  assert.match(componentFile, /hidden sm:grid sm:grid-cols-2 sm:gap-4 sm:pt-4 lg:grid-cols-3/)
  // 예측 스켈레톤은 데스크탑 2단(경기 리스트 : 랭킹) 구성을 따라간다
  assert.match(componentFile, /sm:grid-cols-\[2fr_1fr\]/)
})
