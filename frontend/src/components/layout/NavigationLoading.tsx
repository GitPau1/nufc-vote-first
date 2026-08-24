'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const MIN_VISIBLE_MS = 350
const SHOW_DELAY_MS = 120
const ROUTE_SETTLE_MS = 450
const FALLBACK_HIDE_MS = 4000
const NAVIGATION_START_EVENT = 'nufc:navigation-start'
type LoadingVariant = 'polls' | 'predictions' | 'players' | 'menu' | 'top'
// 데스크탑에서 max-w-content(1140px)로 넓어지는 화면들 — 나머지는 max-w-shell 그대로
const WIDE_VARIANTS: LoadingVariant[] = ['polls', 'predictions']

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

function getLoadingVariant(pathname: string): LoadingVariant {
  if (pathname === '/' || pathname === '/polls') return 'polls'
  if (pathname === '/predictions') return 'predictions'
  if (pathname === '/players') return 'players'
  if (pathname === '/menu') return 'menu'
  return 'top'
}

/** router.push()처럼 링크 클릭이 아닌 이동에도 로딩을 띄운다 */
export function startNavigationLoading(href: string) {
  window.dispatchEvent(new CustomEvent(NAVIGATION_START_EVENT, { detail: href }))
}

/** useRouter() 대신 쓰면 push()가 로딩까지 같이 띄운다 (back()은 popstate로 자동 처리) */
export function useLoadingRouter() {
  const router = useRouter()
  return useMemo(
    () => ({
      ...router,
      push: (href: string) => {
        startNavigationLoading(href)
        router.push(href)
      },
    }),
    [router]
  )
}

export function NavigationLoading() {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  const [loadingVariant, setLoadingVariant] = useState<LoadingVariant>('top')
  const visibleAtRef = useRef(0)
  const targetPathRef = useRef<string | null>(null)
  const showTimerRef = useRef<number | null>(null)
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  function clearShowTimer() {
    if (!showTimerRef.current) return
    window.clearTimeout(showTimerRef.current)
    showTimerRef.current = null
  }

  function beginLoading(nextPath: string) {
    setLoadingVariant(getLoadingVariant(nextPath))
    targetPathRef.current = nextPath
    clearShowTimer()
    showTimerRef.current = window.setTimeout(() => {
      showTimerRef.current = null
      // 캐시된 뒤로가기처럼 이미 도착했으면 굳이 띄우지 않는다
      if (pathnameRef.current === nextPath) return
      visibleAtRef.current = Date.now()
      setIsLoading(true)
    }, SHOW_DELAY_MS)
  }

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return

      const anchor = (event.target as Element | null)?.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const nextUrl = new URL(anchor.href)
      if (nextUrl.origin !== window.location.origin) return

      const current = window.location.pathname + window.location.search
      const next = nextUrl.pathname + nextUrl.search
      if (next === current) return
      if (nextUrl.hash && nextUrl.pathname === window.location.pathname && nextUrl.search === window.location.search) return

      beginLoading(nextUrl.pathname)
    }

    function handlePopState() {
      beginLoading(window.location.pathname)
    }

    function handleProgrammatic(event: Event) {
      const href = (event as CustomEvent<string>).detail
      beginLoading(new URL(href, window.location.origin).pathname)
    }

    document.addEventListener('click', handleClick, true)
    window.addEventListener('popstate', handlePopState)
    window.addEventListener(NAVIGATION_START_EVENT, handleProgrammatic)
    return () => {
      clearShowTimer()
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener(NAVIGATION_START_EVENT, handleProgrammatic)
    }
  }, [])

  useEffect(() => {
    clearShowTimer()
    if (!isLoading) return
    if (targetPathRef.current !== pathname) return

    const elapsed = Date.now() - visibleAtRef.current
    const hideDelay = Math.max(MIN_VISIBLE_MS - elapsed, ROUTE_SETTLE_MS)
    const hideTimer = window.setTimeout(() => setIsLoading(false), hideDelay)
    return () => window.clearTimeout(hideTimer)
  }, [pathname, isLoading])

  useEffect(() => {
    if (!isLoading) return

    const fallbackTimer = window.setTimeout(() => setIsLoading(false), FALLBACK_HIDE_MS)
    return () => window.clearTimeout(fallbackTimer)
  }, [isLoading])

  if (!isLoading) return null

  return (
    <LoadingShell loadingVariant={loadingVariant} />
  )
}

function LoadingShell({ loadingVariant }: { loadingVariant: LoadingVariant }) {
  if (loadingVariant === 'top') {
    return <TopBarOnly />
  }

  // AppHeader(62px)는 라우팅 중에도 그대로 남아 있고 모든 화면에서 같은 모습이라 덮지 않는다 —
  // 덮으면 스켈레톤이 헤더 자리부터 그려져 실제 화면과 62px 어긋난다.
  // BottomNav는 데스크탑에서 헤더 GNB로 대체되어 사라지므로 하단 64px도 같이 없앤다
  return (
    <div
      role="status"
      aria-label="페이지를 불러오는 중"
      className={`pointer-events-none fixed inset-x-0 bottom-[64px] top-[62px] z-[100] mx-auto flex w-full max-w-shell flex-col bg-page/95 backdrop-blur-sm sm:bottom-0 ${
        WIDE_VARIANTS.includes(loadingVariant) ? 'sm:max-w-content' : ''
      }`}
    >
      {renderLoadingBody(loadingVariant)}
      <span className="sr-only">페이지를 불러오는 중</span>
    </div>
  )
}

function renderLoadingBody(variant: LoadingVariant) {
  switch (variant) {
    case 'predictions':
      return <PredictionsSkeleton />
    case 'players':
      return <PlayersSkeleton />
    case 'menu':
      return <MenuSkeleton />
    case 'top':
      return <TopBarOnly />
    default:
      return <PollsSkeleton />
  }
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div className={`overflow-hidden bg-disabled ${className}`}>
      <div className="h-full w-full animate-skeleton" />
    </div>
  )
}

/** PollCard(h-32, pl-3 pr-5 py-4) 실측 */
function PollRowSkeleton() {
  return (
    <div className="flex h-32 items-center gap-4 py-4 pl-3 pr-5">
      <SkeletonBlock className="h-24 w-24 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <SkeletonBlock className="h-[21px] w-16 rounded-xs" />
        <SkeletonBlock className="h-4 w-4/5 rounded-xs" />
        <SkeletonBlock className="h-3.5 w-3/5 rounded-xs" />
      </div>
    </div>
  )
}

/** PollTabs(h-8 flex-1 border-b, 첫 탭 활성) 실측 */
function PollTabsSkeleton() {
  return (
    <div className="flex w-full">
      {[0, 1, 2].map(index => (
        <div
          key={index}
          className={`flex h-8 flex-1 justify-center border-b ${index === 0 ? 'border-brand-solid' : 'border-neutral-weak'}`}
        >
          <SkeletonBlock className="h-[18px] w-9 rounded-xs" />
        </div>
      ))}
    </div>
  )
}

function PollsSkeleton() {
  return (
    <div aria-hidden="true" className="flex-1 px-5 pt-4 pb-24 sm:pb-10">
      {/* PollHeroCard: h-[252px] rounded-lg bg-disabled */}
      <div className="h-[252px] overflow-hidden rounded-lg bg-disabled">
        <div className="h-full w-full animate-skeleton" />
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-neutral-weak bg-surface p-px sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
        <div className="px-3 pt-4 sm:px-0 sm:pt-0">
          <PollTabsSkeleton />
        </div>

        {/* 모바일: 한 줄 리스트 / 데스크탑: 카드 그리드 — PollListClient와 같은 분기 */}
        <div className="divide-y divide-border sm:hidden">
          {[0, 1, 2].map(index => (
            <PollRowSkeleton key={index} />
          ))}
        </div>
        <div className="hidden sm:grid sm:grid-cols-2 sm:gap-4 sm:pt-4 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map(index => (
            <div key={index} className="overflow-hidden rounded-lg border border-neutral-weak bg-surface">
              <PollRowSkeleton />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** MatchInfoRow의 TeamSide(w-[84px], 48px 엠블럼) 실측 */
function TeamSideSkeleton() {
  return (
    <div className="flex w-[84px] shrink-0 flex-col items-center gap-1.5">
      <SkeletonBlock className="h-12 w-12 rounded-xs" />
      <SkeletonBlock className="h-[18px] w-14 rounded-xs" />
    </div>
  )
}

function PredictionsSkeleton() {
  return (
    <div aria-hidden="true" className="flex-1 px-4 pt-4 pb-24 sm:px-10 sm:pb-10">
      <div className="sm:grid sm:grid-cols-[2fr_1fr] sm:items-start sm:gap-x-10">
        <div>
          {/* 월 네비게이션: mb-4, title-3 라벨 + h-8 w-8 원형 버튼 2개 */}
          <div className="mb-4 flex items-center justify-between">
            <SkeletonBlock className="h-8 w-16 rounded-xs" />
            <div className="flex gap-0.5">
              <SkeletonBlock className="h-8 w-8 rounded-xs" />
              <SkeletonBlock className="h-8 w-8 rounded-xs" />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {[0, 1].map(week => (
              <section key={week}>
                <SkeletonBlock className="mb-2 ml-0.5 h-5 w-14 rounded-xs" />
                <div className="overflow-hidden rounded-lg border border-neutral-weak bg-surface">
                  <div className="p-3.5">
                    <div className="mb-4 flex items-center justify-between">
                      <SkeletonBlock className="h-4 w-20 rounded-xs" />
                      <SkeletonBlock className="h-4 w-14 rounded-xs" />
                    </div>
                    <div className="flex items-center justify-center gap-4 py-1.5">
                      <TeamSideSkeleton />
                      <div className="flex min-w-16 flex-col items-center gap-0.5">
                        <SkeletonBlock className="h-3.5 w-8 rounded-xs" />
                        <SkeletonBlock className="h-[22px] w-14 rounded-xs" />
                      </div>
                      <TeamSideSkeleton />
                    </div>
                  </div>
                  {/* 상태줄: border-t p-3.5 pt-3 */}
                  <div className="flex items-center justify-between gap-2 border-t border-neutral-weak p-3.5 pt-3">
                    <SkeletonBlock className="h-5 w-12 rounded-xs" />
                    <SkeletonBlock className="h-[18px] w-16 rounded-xs" />
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* RankingCard 2개 — 데스크탑에서만, 아직 entries가 비어 제목 + 안내문만 나온다 */}
        <div className="hidden flex-col gap-4 sm:flex">
          {[0, 1].map(card => (
            <div key={card} className="rounded-lg border border-neutral-weak bg-surface p-4">
              <SkeletonBlock className="mb-3 h-[22px] w-24 rounded-xs" />
              <SkeletonBlock className="h-4 w-40 max-w-full rounded-xs" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** PickOneCard: absolute left-0 top-5, w-[calc((100%-49px)/2)], slotClass의 translate까지 그대로 */
function PickOneCardSkeleton({ translate }: { translate: string }) {
  return (
    <div
      className={`absolute left-0 top-5 flex h-32 w-[calc((100%_-_49px)/2)] flex-col items-center justify-center gap-2.5 rounded-lg bg-neutral-strong p-3 ${translate}`}
    >
      <div className="h-14 w-14 overflow-hidden rounded-pill border border-neutral-weak bg-page">
        <div className="h-full w-full animate-skeleton bg-disabled" />
      </div>
      <SkeletonBlock className="h-5 w-20 rounded-xs" />
      <SkeletonBlock className="h-3.5 w-16 rounded-xs" />
    </div>
  )
}

function PlayersSkeleton() {
  return (
    <div aria-hidden="true" className="flex-1 px-5 pt-4 pb-24 sm:pb-10">
      {/* PickOneSection */}
      <section className="mb-3 overflow-hidden rounded-lg border border-neutral-weak bg-surface">
        <div className="flex justify-center border-b border-neutral-weak px-3.5 pb-3 pt-3">
          <SkeletonBlock className="h-6 w-28 rounded-xs" />
        </div>
        <div className="flex justify-center px-4 pt-3">
          <SkeletonBlock className="h-4 w-32 rounded-xs" />
        </div>

        <div className="relative h-[168px] overflow-hidden">
          <PickOneCardSkeleton translate="translate-x-[12.5px]" />
          <div className="absolute left-1/2 top-[72px] h-6 w-6 -translate-x-1/2 rounded-xs bg-disabled" />
          <PickOneCardSkeleton translate="translate-x-[calc(100%_+_36.5px)]" />
        </div>

        <div className="flex justify-center px-4 pb-4 pt-2">
          <SkeletonBlock className="h-4 w-56 max-w-full rounded-xs" />
        </div>
        <SkeletonBlock className="mx-4 mb-4 h-10 rounded-md" />
      </section>

      {/* 검색바 — PickOneSection의 mb-3이 위 간격을 이미 만든다 */}
      <div className="mb-3 flex h-10 items-center gap-2 rounded-md border border-neutral-weak bg-surface px-3">
        <SkeletonBlock className="h-4 w-4 rounded-xs" />
        <SkeletonBlock className="h-4 w-20 rounded-xs" />
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-weak bg-surface">
        <div className="flex items-center justify-between border-b border-neutral-weak px-3.5 pb-2 pt-3">
          <div className="flex items-center gap-[66px]">
            <SkeletonBlock className="h-3.5 w-7 rounded-xs" />
            <SkeletonBlock className="h-3.5 w-7 rounded-xs" />
          </div>
          <SkeletonBlock className="h-3.5 w-9 rounded-xs" />
        </div>
        <div className="divide-y divide-border">
          {[0, 1, 2, 3, 4].map(index => (
            <div key={index} className="flex h-[68px] items-center gap-2.5 px-3.5 py-2.5">
              <SkeletonBlock className="h-6 w-6 shrink-0 rounded-xs" />
              <SkeletonBlock className="h-[42px] w-[42px] shrink-0 rounded-pill" />
              <div className="min-w-0 flex-1">
                <SkeletonBlock className="h-5 w-32 rounded-xs" />
                <SkeletonBlock className="mt-1 h-3.5 w-24 rounded-xs" />
              </div>
              <SkeletonBlock className="h-6 w-8 shrink-0 rounded-xs" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MenuSkeleton() {
  return (
    <div aria-hidden="true" className="flex-1 px-5 pt-6 pb-24 sm:pb-10">
      {/* heading-2(20/28) + mt-1 label-2(13/18) */}
      <div className="mb-5">
        <SkeletonBlock className="h-7 w-16 rounded-xs" />
        <SkeletonBlock className="mt-1 h-[18px] w-64 max-w-full rounded-xs" />
      </div>

      {/* MenuActions: flex flex-col gap-2 + h-12 justify-start 버튼들(로그인 여부에 따라 2~4개) */}
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map(index => (
          <div key={index} className="flex h-12 items-center gap-2 rounded-sm border border-neutral-weak px-4">
            <SkeletonBlock className="h-4 w-4 rounded-sm" />
            <SkeletonBlock className="h-[22px] w-28 rounded-xs" />
          </div>
        ))}
      </div>
    </div>
  )
}

function TopBarOnly() {
  return (
    <div
      role="status"
      aria-label="페이지를 불러오는 중"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1 w-full overflow-hidden bg-disabled"
    >
      <div className="h-full w-1/2 animate-[loading-bar_1s_ease-in-out_infinite] rounded-r-pill bg-brand-solid" />
    </div>
  )
}
