'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const MIN_VISIBLE_MS = 350
const SHOW_DELAY_MS = 120
const ROUTE_SETTLE_MS = 450
const FALLBACK_HIDE_MS = 4000
type LoadingVariant = 'polls' | 'players' | 'menu' | 'top'

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

function getLoadingVariant(pathname: string): LoadingVariant {
  if (pathname === '/' || pathname === '/polls') return 'polls'
  if (pathname === '/players') return 'players'
  if (pathname === '/menu') return 'menu'
  return 'top'
}

export function NavigationLoading() {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  const [loadingVariant, setLoadingVariant] = useState<LoadingVariant>('top')
  const visibleAtRef = useRef(0)
  const targetPathRef = useRef<string | null>(null)
  const showTimerRef = useRef<number | null>(null)

  function clearShowTimer() {
    if (!showTimerRef.current) return
    window.clearTimeout(showTimerRef.current)
    showTimerRef.current = null
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

      setLoadingVariant(getLoadingVariant(nextUrl.pathname))
      targetPathRef.current = nextUrl.pathname
      clearShowTimer()
      showTimerRef.current = window.setTimeout(() => {
        visibleAtRef.current = Date.now()
        setIsLoading(true)
        showTimerRef.current = null
      }, SHOW_DELAY_MS)
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      clearShowTimer()
      document.removeEventListener('click', handleClick, true)
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

  return (
    <div
      role="status"
      aria-label="페이지를 불러오는 중"
      className="pointer-events-none fixed inset-x-0 bottom-[64px] top-0 z-[100] mx-auto flex w-full max-w-[480px] flex-col bg-background/95 backdrop-blur-sm"
    >
      {renderLoadingBody(loadingVariant)}
      <span className="sr-only">페이지를 불러오는 중</span>
    </div>
  )
}

function renderLoadingBody(variant: LoadingVariant) {
  switch (variant) {
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

function PollsSkeleton() {
  return (
    <div aria-hidden="true" className="flex-1 px-5 pb-24 pt-4">
      <div className="h-[252px] overflow-hidden rounded-lg bg-surface shadow-w200">
        <div className="h-full animate-skeleton bg-disabled" />
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface p-px">
        <div className="flex px-3 pt-4">
          <div className="h-8 flex-1 border-b border-primary" />
          <div className="h-8 flex-1 border-b border-border" />
          <div className="h-8 flex-1 border-b border-border" />
        </div>

        <div className="divide-y divide-border">
          {[0, 1, 2].map(index => (
            <div key={index} className="flex h-32 items-center gap-4 py-4 pl-3 pr-5">
              <SkeletonBlock className="h-24 w-24 shrink-0 rounded-md" />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <SkeletonBlock className="h-5 w-16 rounded-pill" />
                <SkeletonBlock className="h-4 w-4/5 rounded-pill" />
                <SkeletonBlock className="h-3 w-3/5 rounded-pill" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PlayersSkeleton() {
  return (
    <div aria-hidden="true" className="flex-1 px-5 pb-24 pt-4">
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex justify-center border-b border-border px-3.5 pb-[13px] pt-3">
          <SkeletonBlock className="h-6 w-32 rounded-pill" />
        </div>
        <div className="flex justify-center px-4 pt-3">
          <SkeletonBlock className="h-4 w-36 rounded-pill" />
        </div>
        <div className="relative h-[168px] px-4 pt-5">
          <div className="grid grid-cols-2 gap-5">
            <div className="flex h-32 flex-1 flex-col items-center justify-center gap-2.5 rounded-lg bg-disabled/70 p-3">
              <SkeletonBlock className="h-14 w-14 rounded-pill" />
              <SkeletonBlock className="h-4 w-20 rounded-pill" />
              <SkeletonBlock className="h-3 w-16 rounded-pill" />
            </div>
            <div className="flex h-32 flex-1 flex-col items-center justify-center gap-2.5 rounded-lg bg-disabled/70 p-3">
              <SkeletonBlock className="h-14 w-14 rounded-pill" />
              <SkeletonBlock className="h-4 w-20 rounded-pill" />
              <SkeletonBlock className="h-3 w-16 rounded-pill" />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-3 mt-3 flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3">
        <SkeletonBlock className="h-4 w-4 rounded-pill" />
        <SkeletonBlock className="h-4 flex-1 rounded-pill" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex h-10 items-center justify-between border-b border-border px-3.5">
          <SkeletonBlock className="h-3 w-20 rounded-pill" />
          <SkeletonBlock className="h-3 w-12 rounded-pill" />
        </div>
        {[0, 1, 2, 3].map(index => (
          <div key={index} className="flex h-[68px] items-center gap-2.5 border-b border-border px-3.5 py-2.5 last:border-b-0">
            <SkeletonBlock className="h-6 w-6 shrink-0 rounded-pill" />
            <SkeletonBlock className="h-[42px] w-[42px] shrink-0 rounded-pill" />
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-32 rounded-pill" />
              <SkeletonBlock className="mt-2 h-3 w-24 rounded-pill" />
            </div>
            <SkeletonBlock className="h-5 w-8 shrink-0 rounded-pill" />
          </div>
        ))}
      </div>
    </div>
  )
}

function MenuSkeleton() {
  return (
    <div aria-hidden="true" className="flex-1 px-5 pb-24 pt-6">
      <div className="mb-5">
        <SkeletonBlock className="h-7 w-16 rounded-pill" />
        <SkeletonBlock className="mt-2 h-4 w-64 max-w-full rounded-pill" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {[0, 1, 2, 3, 4].map(index => (
          <div key={index} className="flex h-14 items-center gap-3 border-b border-border px-4 last:border-b-0">
            <SkeletonBlock className="h-8 w-8 shrink-0 rounded-md" />
            <SkeletonBlock className="h-4 flex-1 rounded-pill" />
            <SkeletonBlock className="h-4 w-4 shrink-0 rounded-pill" />
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
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] mx-auto h-1 w-full max-w-[480px] overflow-hidden bg-disabled"
    >
      <div className="h-full w-1/2 animate-[loading-bar_1s_ease-in-out_infinite] rounded-r-pill bg-primary" />
    </div>
  )
}
