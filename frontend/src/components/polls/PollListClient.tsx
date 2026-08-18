'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users } from 'lucide-react'
import { PollCard, formatTimeLeft, getStatusLabel, getThumbnailUrl } from './PollCard'
import { getSourcePage, trackEvent } from '@/lib/analytics/mixpanel'
import { loadMorePolls } from '@/lib/actions/polls'
import { getEffectivePollStatus } from '@/lib/polls/status'
import type { PollListItem } from '@/lib/queries/polls'
import { PAGE_SIZE } from '@/lib/constants'

interface PollListClientProps {
  initialPolls: PollListItem[]
  headerRight?: React.ReactNode
}

type PollTab = 'all' | 'ongoing' | 'closed'

const CLOSING_SOON_MS = 86_400_000

function Spinner() {
  return (
    <div className="flex justify-center py-6">
      <div className="w-5 h-5 rounded-full border-2 border-muted border-t-primary animate-spin" />
    </div>
  )
}

function getFeaturedPollCandidates(polls: PollListItem[], now: number): PollListItem[] {
  const activePolls = polls.filter(p => p.status === 'active')
  const closingSoon = activePolls.filter(p => {
    const timeLeft = new Date(p.closes_at).getTime() - now
    return timeLeft > 0 && timeLeft <= CLOSING_SOON_MS
  })
  const closedPolls = polls.filter(p => p.status === 'closed')

  if (closingSoon.length > 0) return closingSoon
  if (activePolls.length > 0) return activePolls
  return closedPolls
}

export function PollListClient({ initialPolls, headerRight }: PollListClientProps) {
  const [polls, setPolls]     = useState<PollListItem[]>(initialPolls)
  const [page, setPage]       = useState(1)
  const [hasMore, setHasMore] = useState(initialPolls.length === PAGE_SIZE)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<PollTab>('all')
  const [selectedFeaturedPollId, setSelectedFeaturedPollId] = useState<string | null>(null)
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
  const ongoing = effectivePolls.filter(p => p.status !== 'closed')
  const closed  = effectivePolls.filter(p => p.status === 'closed')
  const visiblePolls = activeTab === 'all' ? effectivePolls : activeTab === 'ongoing' ? ongoing : closed
  const featuredPollCandidates = getFeaturedPollCandidates(effectivePolls, now)
  const featuredPollCandidateIds = featuredPollCandidates.map(poll => poll.id).join('|')
  const selectedFeaturedPoll = featuredPollCandidates.find(poll => poll.id === selectedFeaturedPollId) ?? null
  const fallbackFeaturedPoll = featuredPollCandidates[0] ?? null
  const featuredPoll = selectedFeaturedPoll ?? fallbackFeaturedPoll
  const listPolls = visiblePolls

  useEffect(() => {
    const candidates = getFeaturedPollCandidates(
      polls.map(poll => ({
        ...poll,
        status: getEffectivePollStatus(poll, new Date(now)),
      })),
      now
    )
    if (candidates.length === 0) {
      setSelectedFeaturedPollId(null)
      return
    }
    if (selectedFeaturedPollId && candidates.some(poll => poll.id === selectedFeaturedPollId)) return

    const next = candidates[Math.floor(Math.random() * candidates.length)]
    setSelectedFeaturedPollId(next.id)
  }, [featuredPollCandidateIds, now, polls, selectedFeaturedPollId])

  if (polls.length === 0 && !loading) {
    return (
      <div className="px-5 pt-4 animate-enter">
        <div className="mb-4 flex items-center justify-between gap-3">
          <PollTabs activeTab={activeTab} ongoingCount={0} closedCount={0} onChange={setActiveTab} />
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
    <div className="px-5 pt-4 pb-10 animate-enter">
      {featuredPoll && <PollHeroCard poll={featuredPoll} />}

      {listPolls.length > 0 ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface p-px">
          <div className="px-3 pt-4">
            <PollTabs activeTab={activeTab} ongoingCount={ongoing.length} closedCount={closed.length} onChange={setActiveTab} />
          </div>
          <div className="divide-y divide-border">
            {listPolls.map(p => <PollCard key={p.id} poll={p} />)}
          </div>
        </div>
      ) : (
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-surface p-px">
          <div className="px-3 pt-4">
            <PollTabs activeTab={activeTab} ongoingCount={ongoing.length} closedCount={closed.length} onChange={setActiveTab} />
          </div>
          <div className="flex flex-col items-center justify-center gap-2 py-20">
            <p className="text-label-1-normal font-semibold text-foreground">
              {activeTab === 'all' ? '투표가 없습니다' : activeTab === 'ongoing' ? '진행 중인 투표가 없습니다' : '종료된 투표가 없습니다'}
            </p>
          </div>
        </div>
      )}

      <div ref={sentinelRef} />
      {loading && <Spinner />}
    </div>
  )
}

function PollHeroCard({ poll }: { poll: PollListItem }) {
  const pathname = usePathname()

  return (
    <Link
      href={`/polls/${poll.id}`}
      prefetch={false}
      onClick={() => trackEvent('poll_card_clicked', {
        source_page: getSourcePage(pathname),
        poll_id: poll.id,
        poll_type: poll.type,
        poll_status: poll.status,
        creator_type: poll.created_by && poll.creator_name ? 'user' : 'admin',
      })}
      className="relative block h-[252px] overflow-hidden rounded-lg bg-disabled"
    >
      <img src={getThumbnailUrl(poll)} alt="" className="h-full w-full object-cover" />
      <div className="banner-text-overlay absolute inset-0" />
      <div className="absolute inset-x-4 bottom-4 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-[21px] items-center rounded-pill bg-primary/55 px-[9px] text-caption-2 font-semibold text-white backdrop-blur-[2px]">
            {poll.status === 'active' ? formatTimeLeft(poll.closes_at) : getStatusLabel(poll)}
          </span>
          <span className="inline-flex items-center gap-1 text-caption-2 text-white">
            <Users className="h-3.5 w-3.5" />
            {poll.vote_count.toLocaleString()}명
          </span>
        </div>
        <p className="truncate text-headline-2 font-bold text-white">{poll.title}</p>
        {poll.description && (
          <p className="mt-1 truncate text-caption-1 text-white/75">{poll.description}</p>
        )}
      </div>
    </Link>
  )
}

function PollTabs({
  activeTab,
  ongoingCount,
  closedCount,
  onChange,
}: {
  activeTab: PollTab
  ongoingCount: number
  closedCount: number
  onChange: (tab: PollTab) => void
}) {
  const tabs = [
    { id: 'all' as const, label: '전체' },
    { id: 'ongoing' as const, label: '진행중', count: ongoingCount },
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
            className={`h-8 flex-1 border-b px-2.5 pb-3 text-center text-label-2 font-bold transition-colors ${selected ? 'border-primary text-primary' : 'border-border text-gray-3 hover:text-gray-2'}`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
