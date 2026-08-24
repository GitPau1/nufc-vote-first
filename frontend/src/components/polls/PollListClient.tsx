'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { PollCard } from './PollCard'
import { loadMorePolls } from '@/lib/actions/polls'
import { getEffectivePollStatus } from '@/lib/polls/status'
import type { PollListItem } from '@/lib/queries/polls'
import { PAGE_SIZE } from '@/lib/constants'

interface PollListClientProps {
  initialPolls: PollListItem[]
  headerRight?: React.ReactNode
}

type PollTab = 'all' | 'active' | 'scheduled' | 'closed'

function Spinner() {
  return (
    <div className="flex justify-center py-6">
      <div className="w-5 h-5 rounded-full border-2 border-muted border-t-primary animate-spin" />
    </div>
  )
}

export function PollListClient({ initialPolls, headerRight }: PollListClientProps) {
  const [polls, setPolls]     = useState<PollListItem[]>(initialPolls)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(initialPolls.length === PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<PollTab>('all')
  const [now, setNow] = useState(() => Date.now())
  const sentinelRef           = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const next = await loadMorePolls(page)
      if (next.length < PAGE_SIZE) setHasMore(false)
      setPolls(prev => [...prev, ...next])
      setPage(p => p + 1)
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, page])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const effectivePolls = polls.map(poll => ({
    ...poll,
    status: getEffectivePollStatus(poll, new Date(now)),
  }))
  const active    = effectivePolls.filter(p => p.status === 'active')
  const scheduled = effectivePolls.filter(p => p.status === 'scheduled')
  const closed    = effectivePolls.filter(p => p.status === 'closed')
  const visiblePolls = activeTab === 'all' ? effectivePolls
    : activeTab === 'active' ? active
    : activeTab === 'scheduled' ? scheduled
    : closed
  const listPolls = visiblePolls

  const tabCounts = { activeCount: active.length, scheduledCount: scheduled.length, closedCount: closed.length }

  if (polls.length === 0 && !loading) {
    return (
      <div className="px-5 pt-4 animate-enter">
        <div className="mb-4 flex items-center justify-between gap-3">
          <PollTabs activeTab={activeTab} activeCount={0} scheduledCount={0} closedCount={0} onChange={setActiveTab} />
          {headerRight}
        </div>
        <div className="flex flex-col items-center justify-center py-24 gap-2">
          <p className="text-label-1-normal font-semibold text-foreground">투표가 없습니다</p>
          <p className="text-caption-1 text-muted-foreground">곧 새로운 투표가 공개될 예정입니다</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-content px-5 pt-4 pb-10 animate-enter">
      {listPolls.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-surface p-px sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
          <div className="px-3 pt-4 sm:px-0 sm:pt-0">
            <PollTabs activeTab={activeTab} {...tabCounts} onChange={setActiveTab} />
          </div>
          {/* 모바일: 세로로 쌓이는 한 줄짜리 리스트 — 카드는 horizontal(썸네일 좌측) */}
          <div className="divide-y divide-border sm:hidden">
            {listPolls.map(p => <PollCard key={p.id} poll={p} />)}
          </div>
          {/* 데스크탑(≥640px): 2단, 넓어지면(≥1024px) 3단 그리드 — 카드는 vertical(썸네일 상단) */}
          <div className="hidden sm:grid sm:grid-cols-2 sm:gap-4 sm:pt-4 lg:grid-cols-3">
            {listPolls.map(p => <PollCard key={p.id} poll={p} variant="vertical" />)}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface p-px">
          <div className="px-3 pt-4">
            <PollTabs activeTab={activeTab} {...tabCounts} onChange={setActiveTab} />
          </div>
          <div className="flex flex-col items-center justify-center gap-2 py-20">
            <p className="text-label-1-normal font-semibold text-foreground">
              {activeTab === 'all' ? '투표가 없습니다'
                : activeTab === 'active' ? '진행 중인 투표가 없습니다'
                : activeTab === 'scheduled' ? '예정된 투표가 없습니다'
                : '종료된 투표가 없습니다'}
            </p>
          </div>
        </div>
      )}

      <div ref={sentinelRef} />
      {loading && <Spinner />}
    </div>
  )
}

function PollTabs({
  activeTab,
  activeCount,
  scheduledCount,
  closedCount,
  onChange,
}: {
  activeTab: PollTab
  activeCount: number
  scheduledCount: number
  closedCount: number
  onChange: (tab: PollTab) => void
}) {
  const tabs = [
    { id: 'all' as const, label: '전체' },
    { id: 'active' as const, label: '진행중', count: activeCount },
    { id: 'scheduled' as const, label: '예정', count: scheduledCount },
    { id: 'closed' as const, label: '종료', count: closedCount },
  ]

  return (
    <div className="flex w-full">
      {tabs.map(tab => {
        const selected = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`h-8 flex-1 border-b px-2.5 pb-3 text-center text-label-2 font-bold transition-colors ${selected ? 'border-brand-solid text-brand' : 'border-border text-neutral-subtle hover:text-muted-foreground'}`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
