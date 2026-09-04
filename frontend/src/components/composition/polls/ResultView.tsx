'use client'

import { useEffect } from 'react'
import { PollEditLink } from './PollEditLink'
import { Users } from 'lucide-react'
import type { PollDetail, VoteCountMap } from '@/lib/queries/polls'
import type { CommentItem } from '@/lib/queries/comments'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { Card } from '@/components/primitives/card'
import { CommentsSection } from './CommentsSection'
import { PollPageHeader } from './PollPageHeader'
import { IS_MOCK } from '@/lib/config'
import { ResultProgress } from '@/components/primitives/result-progress'
import type { PlayerRow, PollOptionRow } from '@/types/database'

interface ResultViewProps {
  poll: PollDetail
  voteCounts: VoteCountMap
  myOptionId: string | null
  comments: CommentItem[]
  canEdit: boolean
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

/** 투표 상세(PollClient)도 같은 포맷을 쓴다 — 제출 전후로 날짜 표기가 달라지지 않게. */
export function formatPollDate(dateStr?: string | null): string | null {
  if (!dateStr) return null
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Seoul',
  }).format(new Date(dateStr))
}

/**
 * 선택지 썸네일 판정. 투표 상세(PollClient)도 같은 판정을 쓴다 —
 * 투표할 때 본 썸네일과 결과에서 보는 썸네일이 어긋나면 안 되기 때문.
 */
export function getOptionThumb(option: PollOptionRow, optionPlayers?: Record<string, PlayerRow>) {
  const player = option.player_id ? optionPlayers?.[option.player_id] ?? null : null
  if (option.image_url) {
    return { url: option.image_url, label: option.label, fallback: option.label.slice(0, 1) }
  }
  if (player) {
    return { url: player.photo_url, label: player.name, fallback: player.name.slice(0, 1) }
  }
  return null
}

export function ResultView({ poll, voteCounts, myOptionId, comments, canEdit }: ResultViewProps) {
  const options  = poll.poll_options
  const counts   = options.map(o => voteCounts[o.id] ?? 0)
  const total    = counts.reduce((a, b) => a + b, 0)
  const isClosed = poll.status === 'closed'
  const resultItems = buildResultItems(poll, voteCounts)
  const pollDate = formatPollDate(poll.created_at ?? poll.closes_at)

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
    <div className="flex min-h-screen flex-col bg-page">
      {/* 페이지 헤더 — 모바일 전용 진입(AppHeader 모바일 레이어에서만 렌더됨) */}
      <PollPageHeader
        action={canEdit && <PollEditLink pollId={poll.id} />}
      />
      <div className="flex-1 overflow-y-auto hide-scrollbar animate-enter">
        {/* 컨테이너·카드 규격은 제출 화면(PredictionFlowClient)과 맞춘다 — mx-auto max-w-[860px] +
            단일 Card(p-5 sm:p-7). 커버 이미지만 Card 밖에 독립된 블록으로 둔다: 투표 화면
            (PollClient의 선택형 분기)도 커버를 카드 밖 단독 블록(overflow-hidden rounded-lg bg-disabled)으로
            두고, 그 아래 글 컨테이너를 따로 둔다 — 참여 전후로 커버 톤이 달라지지 않게 같은 처리를 쓴다. */}
        <main className="mx-auto flex w-full max-w-[860px] flex-col gap-3 px-4 pb-8 pt-4 sm:px-6 sm:pt-8">
          <div className="overflow-hidden rounded-lg bg-disabled">
            <img
              src={coverUrl}
              alt={poll.title}
              className="h-[160px] sm:h-[252px] w-full object-cover"
            />
          </div>

          <Card className="p-5 sm:p-7">
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="break-keep text-heading-2 sm:text-heading-1 font-semibold text-neutral">
                {poll.title}
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-caption-1 text-neutral-muted">
                {pollDate && <span>{pollDate}</span>}
                <span>{poll.creator_name ?? 'Admin'}</span>
              </div>
            </div>

            {/* 수정 진입 — 데스크탑 전용(모바일은 헤더에서 렌더됨) */}
            {canEdit && (
              <div className="hidden justify-end sm:flex">
                <PollEditLink pollId={poll.id} />
              </div>
            )}

            <div className="my-5 h-px bg-neutral-weak" />

            {/* 결과 패널 — 흰 Card 안이라 제출 화면 SummarySection·WeekRankCard와 같은
                "카드 안 회색 패널(bg-page)"을 쓴다. 그 안 강조 면(막대 자체)은 bg-surface. */}
            <div className="rounded-lg bg-page px-4 py-5 text-center">
              <p className="text-label-2 font-medium text-neutral-strong">
                {isClosed ? '최종 결과' : '현재 결과'}
              </p>

              {total === 0 ? (
                <div className="mt-4 rounded-lg bg-disabled p-5 text-label-1-normal font-medium text-neutral-muted">
                  아직 집계된 투표가 없습니다
                </div>
              ) : (
                <div className="mt-4 flex w-full flex-col gap-2 text-left">
                  {resultItems.map((item, index) => {
                    const thumb = getOptionThumb(item.option, poll.option_players)

                    return (
                      <ResultProgress
                        key={item.option.id}
                        percent={item.percent}
                        highlighted={index === 0}
                        thumb={thumb}
                        optionLabel={item.option.label}
                      />
                    )
                  })}
                </div>
              )}

              <div className="mt-4 flex items-center justify-center gap-1 text-caption-1 text-neutral-muted">
                <Users className="h-3.5 w-3.5" />
                <span>{total.toLocaleString()}명 참여</span>
              </div>
            </div>
          </Card>

          <CommentsSection
            pollId={poll.id}
            pollType={poll.type}
            pollStatus={poll.status}
            creatorType={poll.created_by && poll.creator_name ? 'user' : 'admin'}
            initialComments={comments}
            isMockMode={IS_MOCK}
            myVotedOptionLabel={myVotedOptionLabel}
            // 마감 여부가 아니라 참여 여부로만 판단한다 — 마감된 투표도 참여자는 댓글을 쓸 수 있다.
            canComment={!!myOptionId}
          />
        </main>
      </div>
    </div>
  )
}
