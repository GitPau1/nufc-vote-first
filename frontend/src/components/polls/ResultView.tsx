'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Users } from 'lucide-react'
import type { PollDetail, VoteCountMap } from '@/lib/queries/polls'
import type { CommentItem } from '@/lib/queries/comments'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { CommentsSection } from './CommentsSection'
import { IS_MOCK } from '@/lib/config'
import { cn } from '@/lib/utils'
import type { PlayerRow, PollOptionRow } from '@/types/database'

interface ResultViewProps {
  poll: PollDetail
  voteCounts: VoteCountMap
  myOptionId: string | null
  comments: CommentItem[]
}

function buildResultItems(poll: PollDetail, voteCounts: VoteCountMap) {
  const total = poll.poll_options.reduce((sum, option) => sum + (voteCounts[option.id] ?? 0), 0)

  return poll.poll_options
    .map((option) => {
      const count = voteCounts[option.id] ?? 0
      return {
        option,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0,
      }
    })
    .sort((a, b) => b.count - a.count || a.option.display_order - b.option.display_order)
}

function formatPollDate(dateStr?: string | null): string | null {
  if (!dateStr) return null
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateStr))
}

function getOptionThumb(option: PollOptionRow, optionPlayers?: Record<string, PlayerRow>) {
  const player = option.player_id ? optionPlayers?.[option.player_id] ?? null : null
  if (option.image_url) {
    return { url: option.image_url, label: option.label, fallback: option.label.slice(0, 1) }
  }
  if (player) {
    return { url: player.photo_url, label: player.name, fallback: player.name.slice(0, 1) }
  }
  return null
}

export function ResultView({ poll, voteCounts, myOptionId, comments }: ResultViewProps) {
  const router = useRouter()
  const options  = poll.poll_options
  const counts   = options.map(o => voteCounts[o.id] ?? 0)
  const total    = counts.reduce((a, b) => a + b, 0)
  const isClosed = poll.status === 'closed'
  const resultItems = buildResultItems(poll, voteCounts)
  const pollDate = formatPollDate(poll.created_at ?? poll.scheduled_at ?? poll.closes_at)

  useEffect(() => {
    trackEvent('poll_result_viewed', {
      source_page: 'poll_detail',
      poll_id: poll.id,
      poll_type: poll.type,
      poll_status: poll.status,
      creator_type: poll.created_by && poll.creator_name ? 'user' : 'admin',
      has_voted: Boolean(myOptionId),
      total_votes: total,
    })
  }, [myOptionId, poll.created_by, poll.creator_name, poll.id, poll.status, poll.type, total])

  const coverUrl = poll.thumbnail_url
    ?? poll.player?.photo_url
    ?? `https://placehold.co/480x252/0c2340/41b6e6?text=${encodeURIComponent(poll.title.slice(0, 4))}`

  // 현재 유저의 투표 항목 레이블
  const myVotedOptionLabel = myOptionId
    ? (options.find(o => o.id === myOptionId)?.label ?? null)
    : null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 overflow-y-auto hide-scrollbar animate-enter">
        <div className="bg-white">
          <header className="mx-auto flex h-[62px] w-full max-w-[480px] items-center px-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-label-1-normal font-semibold text-muted-foreground transition-opacity active:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              돌아가기
            </button>
          </header>
        </div>

        <main className="mx-auto flex w-full max-w-[480px] flex-col gap-3 px-4 pb-8 pt-4">
          <section className="overflow-hidden rounded-lg border border-border bg-surface">
            <img
              src={coverUrl}
              alt={poll.title}
              className="h-[252px] w-full object-cover"
            />

            <div className="px-4 pb-6 pt-2">
              <div className="flex flex-col items-center gap-1 pt-4 text-center">
                <h1 className="break-keep text-heading-2 font-bold text-foreground">
                  {poll.title}
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-caption-1 text-muted-foreground">
                  {pollDate && <span>{pollDate}</span>}
                  <span>{poll.creator_name ?? 'Admin'}</span>
                </div>
              </div>
            </div>

            <div className="mx-4 h-px bg-border" />

            <div className="flex flex-col items-center gap-5 py-5">
              <p className="text-center text-label-2 font-semibold text-gray-1">
                {isClosed ? '최종 결과' : '현재 결과'}
              </p>

              {total === 0 ? (
                <div className="mx-4 w-[calc(100%-32px)] rounded-lg bg-disabled p-5 text-center text-label-1-normal font-medium text-muted-foreground">
                  아직 집계된 투표가 없습니다
                </div>
              ) : (
                <div className="flex w-full flex-col gap-2 px-4">
                  {resultItems.map((item, index) => {
                    const thumb = getOptionThumb(item.option, poll.option_players)

                    return (
                      <div
                        key={item.option.id}
                        className="relative min-h-[50px] overflow-hidden rounded-pill border border-border bg-surface"
                      >
                        <div
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-l-pill',
                            index === 0 ? 'bg-primary-dim' : 'bg-disabled'
                          )}
                          style={{ width: `${item.percent}%` }}
                        />
                        <div
                          className={cn(
                            'relative flex min-h-[48px] items-center justify-between gap-3 py-[4px] pr-[17px]',
                            thumb ? 'pl-[5px]' : 'pl-[17px]'
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {thumb ? (
                              <div className="flex size-[40px] flex-shrink-0 items-center justify-center overflow-hidden rounded-pill bg-primary-dark text-caption-1 font-bold text-white">
                                {thumb.url ? (
                                  <img
                                    src={thumb.url}
                                    alt={thumb.label}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span>{thumb.fallback}</span>
                                )}
                              </div>
                            ) : null}
                            <p
                              className={cn(
                                'min-w-0 truncate break-keep text-caption-1',
                                index === 0 ? 'font-semibold text-primary-dark' : 'font-medium text-muted-foreground'
                              )}
                            >
                              {item.option.label}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'flex-shrink-0 text-caption-1 tabular-nums',
                              index === 0 ? 'font-semibold text-primary-dark' : 'font-medium text-muted-foreground'
                            )}
                          >
                            {item.percent}%
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center justify-center gap-1 text-caption-1 text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{total.toLocaleString()}명 참여</span>
              </div>
            </div>
          </section>

          <CommentsSection
            pollId={poll.id}
            pollType={poll.type}
            pollStatus={poll.status}
            creatorType={poll.created_by && poll.creator_name ? 'user' : 'admin'}
            initialComments={comments}
            isMockMode={IS_MOCK}
            myVotedOptionLabel={myVotedOptionLabel}
          />
        </main>
      </div>
    </div>
  )
}
