'use client'

import { useState, useTransition } from 'react'
import { PollEditLink } from './PollEditLink'
import { Heart } from 'lucide-react'
import type { PollDetail, RatingResultItem } from '@/lib/queries/polls'
import { toggleRatingCommentLike } from '@/lib/actions/ratings'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/primitives/badge'
import { Button } from '@/components/primitives/button'
import { Card } from '@/components/primitives/card'
import { PollPageHeader } from './PollPageHeader'

const POSITION_GROUPS = [
  { value: 'GK', label: '골키퍼' },
  { value: 'DEF', label: '수비수' },
  { value: 'MID', label: '미드필더' },
  { value: 'FWD', label: '공격수' },
  { value: 'MGR', label: '감독' },
] as const

interface OverallRatingResultViewProps {
  poll: PollDetail
  results: RatingResultItem[]
  hasVoted: boolean
  canEdit: boolean
}

export function OverallRatingResultView({ poll, results, hasVoted, canEdit }: OverallRatingResultViewProps) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const coverUrl = poll.thumbnail_url
    ?? `https://placehold.co/480x252/0c2340/41b6e6?text=${encodeURIComponent(poll.title.slice(0, 4))}`
  const groupedResults = POSITION_GROUPS
    .map(group => ({
      ...group,
      results: results.filter(result => result.player.position === group.value),
    }))
    .filter(group => group.results.length > 0)

  return (
    <div className="flex min-h-screen flex-col bg-page">
      {/* 페이지 헤더 — 모바일 전용 진입(AppHeader 모바일 레이어에서만 렌더됨) */}
      <PollPageHeader
        action={canEdit && <PollEditLink pollId={poll.id} />}
      />
      <div className="flex-1 overflow-y-auto hide-scrollbar animate-enter">
        {/* 셸은 결과 화면 컨벤션(ResultView 선례)과 동일하다 — mx-auto max-w-[860px] + 단일
            Card(p-5 sm:p-7). 커버는 Card 밖 독립 블록(overflow-hidden rounded-lg bg-disabled)으로
            두고, 제목/배지는 이미지 오버레이 대신 Card 안으로 내린다 — 이 화면만 예외로 이미지 위
            흰 글씨를 얹을 이유가 없다(TypeBPollClient가 같은 이유로 오버레이를 뺀 선례). */}
        <main className="mx-auto flex w-full max-w-[860px] flex-col gap-3 px-4 pb-8 pt-4 sm:px-6 sm:pt-8">
          <div className="overflow-hidden rounded-lg bg-disabled">
            <img src={coverUrl} alt={poll.title} className="h-[252px] w-full object-cover" />
          </div>

          <Card className="p-5 sm:p-7">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="mb-1 flex items-center gap-1.5">
                <Badge className="pointer-events-none">전체 평가</Badge>
                {hasVoted && (
                  <Badge className="border-0 bg-brand-solid text-caption-2 font-medium text-on-solid hover:bg-brand-solid pointer-events-none">평가 완료</Badge>
                )}
              </div>
              <h1 className="break-keep text-heading-2 sm:text-heading-1 font-semibold text-neutral">
                {poll.title}
              </h1>
              {poll.description && (
                <p className="text-label-1-reading text-neutral-muted">{poll.description}</p>
              )}
            </div>

            {/* 수정 진입 — 데스크탑 전용(모바일은 헤더에서 렌더됨) */}
            {canEdit && (
              <div className="hidden justify-end sm:flex">
                <PollEditLink pollId={poll.id} />
              </div>
            )}

            <div className="my-5 h-px bg-neutral-weak" />

            <div className="flex flex-col gap-5">
              {groupedResults.map(group => (
                // 포지션 그룹 하나 = 카드 안 회색 패널(bg-page). PredictionResult의 경기별 패널과
                // 같은 관계 — 흰 Card 보더 안에 또 보더 카드를 만들지 않는다(이중 프레임 방지).
                <section key={group.value} className="rounded-lg bg-page px-4 py-5">
                  <div className="mb-3 flex items-end justify-between">
                    <div>
                      <p className="text-caption-1 font-medium uppercase text-brand">
                        {group.value}
                      </p>
                      <p className="text-body-2-normal font-semibold text-neutral">{group.label}</p>
                    </div>
                    <p className="text-caption-1 font-medium text-neutral-muted">
                      {group.results.length}명
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {group.results.map(result => {
                      const visibleComments = expandedPlayerId === result.player.id
                        ? result.top_comments
                        : result.top_comments.slice(0, 3)

                      return (
                        // 회색 패널 위의 흰 표면 — 패널이 이미 경계를 주므로 보더 없는 bg-surface만 얹는다.
                        <div key={result.player.id} className="flex flex-col gap-4 rounded-lg bg-surface p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={result.player.photo_url ?? `https://placehold.co/52x52/0c2340/41b6e6?text=${result.player.squad_number ?? result.player.name.slice(0, 1)}`}
                              alt={result.player.name}
                              className="h-[52px] w-[52px] rounded-md object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-label-1-normal font-medium text-neutral">{result.player.name}</p>
                              <p className="text-caption-1 text-neutral-muted">{result.player.position} · #{result.player.squad_number ?? '-'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-body-1-normal font-semibold text-brand">{result.grade}</p>
                              <p className="text-caption-2 font-medium text-neutral-muted">
                                평균 {result.average_score.toFixed(1)} · {result.vote_count}명
                              </p>
                            </div>
                          </div>

                          {visibleComments.length > 0 && (
                            <div className="flex flex-col gap-2">
                              <p className="text-caption-1 font-medium uppercase text-brand">팬 코멘트</p>
                              {visibleComments.map(comment => (
                                <div key={comment.id} className="rounded-md bg-disabled/70 px-3 py-2">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <span className="text-caption-2 font-medium text-neutral-muted">
                                      {comment.user.display_name ?? '뉴캐슬 팬'} · {comment.grade}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={isPending}
                                      onClick={() => startTransition(async () => {
                                        await toggleRatingCommentLike(comment.id, poll.id)
                                      })}
                                      className={cn(
                                        'flex items-center gap-1 text-caption-2 font-medium',
                                        comment.is_liked ? 'text-brand' : 'text-neutral-muted'
                                      )}
                                    >
                                      <Heart className={cn('h-3.5 w-3.5', comment.is_liked && 'fill-current')} />
                                      {comment.like_count}
                                    </button>
                                  </div>
                                  <p className="text-label-1-reading text-neutral">{comment.comment}</p>
                                </div>
                              ))}
                              {result.top_comments.length > 3 && expandedPlayerId !== result.player.id && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => setExpandedPlayerId(result.player.id)}
                                >
                                  전체 코멘트 보기
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </Card>
        </main>
      </div>
    </div>
  )
}
