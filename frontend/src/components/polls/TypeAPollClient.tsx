'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PollDetail } from '@/lib/queries/polls'
import { submitVote } from '@/lib/actions/vote'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RadioOption } from '@/components/ui/radio'
import { StickyActionBar } from '@/components/layout/StickyActionBar'
import { ConfirmModal } from './ConfirmModal'
import { LoginModal } from './LoginModal'
import { PollPageHeader } from './PollPageHeader'

interface TypeAPollClientProps {
  poll: PollDetail
  isAuthenticated: boolean
}

export function TypeAPollClient({ poll, isAuthenticated }: TypeAPollClientProps) {
  const [selectedId, setSelectedId]   = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showLogin, setShowLogin]     = useState(false)
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()
  const router                        = useRouter()

  const selectedOption = poll.poll_options.find(o => o.id === selectedId)

  function handleSubmitClick() {
    if (!selectedId) return
    if (!isAuthenticated) { setShowLogin(true); return }
    setShowConfirm(true)
  }

  function handleConfirm() {
    if (!selectedId) return
    setErrorMsg(null)
    startTransition(async () => {
      const result = await submitVote(poll.id, selectedId)
      if ('success' in result) {
        trackEvent('vote_submitted', {
          source_page: 'poll_detail',
          poll_id: poll.id,
          poll_type: poll.type,
          poll_status: poll.status,
          creator_type: poll.created_by && poll.creator_name ? 'user' : 'admin',
          option_id: selectedId,
          is_first_vote: true,
        })
        setShowConfirm(false)
        router.refresh()
      } else {
        setShowConfirm(false)
        setErrorMsg(
          result.error === 'already_voted'
            ? '이미 참여한 투표입니다'
            : '제출에 실패했습니다. 다시 시도해주세요'
        )
      }
    })
  }

  const coverUrl = poll.thumbnail_url
    ?? poll.player?.photo_url
    ?? `https://placehold.co/480x160/0c2340/41b6e6?text=${encodeURIComponent(poll.title.slice(0, 4))}`

  const daysLeft = Math.ceil(
    (new Date(poll.closes_at).getTime() - Date.now()) / 86400000
  )

  return (
    <div className="relative flex flex-col min-h-screen">
      {/* 페이지 헤더 */}
      <PollPageHeader />

      {/* 스크롤 영역 */}
      <div className="mx-auto flex-1 w-full max-w-detail overflow-y-auto hide-scrollbar pb-[88px] animate-enter sm:flex-none sm:overflow-visible sm:pb-0">

        {/* 커버 이미지 — 칩 → 제목 순서로 오버레이 */}
        <div className="relative h-[160px] overflow-hidden">
          <img src={coverUrl} alt={poll.title} className="w-full h-full object-cover" />
          <div className="banner-text-overlay absolute inset-0" />
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
            {/* 칩 (제목 위) */}
            <div className="flex items-center gap-1.5 mb-2">
              <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm text-caption-2 font-semibold pointer-events-none">
                평가
              </Badge>
              {daysLeft > 0 ? (
                <Badge className="bg-brand-solid text-white border-0 text-caption-2 font-semibold hover:bg-brand-solid pointer-events-none">
                  D-{daysLeft} 마감
                </Badge>
              ) : (
                <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm text-caption-2 font-semibold pointer-events-none">
                  마감
                </Badge>
              )}
            </div>
            {/* 제목 */}
            <div className="flex items-end justify-between gap-3">
              <p className="min-w-0 flex-1 text-headline-2 sm:text-headline-1 font-black text-white">{poll.title}</p>
              {poll.creator_name && (
                <span className="max-w-[38%] truncate text-right text-caption-1 font-bold text-white/80">{poll.creator_name}</span>
              )}
            </div>
          </div>
        </div>

        {/* 콘텐츠 */}
        <div className="px-4 py-4 flex flex-col gap-4">

          {/* 설명 */}
          {poll.description && (
            <p className="text-label-1-reading text-neutral-muted">{poll.description}</p>
          )}

          {/* 에러 */}
          {errorMsg && (
            <p className="text-label-1-normal text-destructive font-medium">{errorMsg}</p>
          )}

          {/* 선택지 */}
          <div className="flex flex-col gap-2">
            {poll.poll_options.map(option => {
              const selected = selectedId === option.id
              return (
                <RadioOption
                  key={option.id}
                  selected={selected}
                  onClick={() => setSelectedId(option.id)}
                >
                  <span className={cn(
                    'text-body-2-normal font-semibold',
                    selected ? 'text-brand' : 'text-neutral'
                  )}>
                    {option.label}
                  </span>
                </RadioOption>
              )
            })}
          </div>

          {/* 선수 정보 카드 */}
          {poll.player && (
            <Card className="mt-1">
              <CardContent className="p-4">
                <p className="text-caption-1 font-semibold text-neutral-muted uppercase mb-3">
                  선수 정보
                </p>
                <div className="flex items-center gap-3">
                  <img
                    src={poll.player.photo_url
                      ?? `https://placehold.co/44x44/0c2340/41b6e6?text=${poll.player.squad_number}`}
                    alt={poll.player.name}
                    className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                  />
                  <div>
                    <p className="text-label-1-normal font-bold text-neutral">{poll.player.name}</p>
                    <p className="text-caption-1 text-neutral-muted mt-0.5">
                      {poll.player.position}
                      <span className="mx-1.5">·</span>
                      <span className="font-semibold text-brand">#{poll.player.squad_number}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 하단 고정 제출 버튼 */}
      <StickyActionBar>
        <Button
          className="w-full h-12 text-body-2-normal font-bold"
          disabled={!selectedId || isPending}
          onClick={handleSubmitClick}
        >
          {isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" />제출 중…</>
            : '투표하기'
          }
        </Button>
      </StickyActionBar>

      {/* 모달 */}
      {selectedOption && (
        <ConfirmModal
          open={showConfirm}
          selectedLabel={selectedOption.label}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleConfirm}
          isPending={isPending}
        />
      )}
      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        triggerAction="vote"
      />
    </div>
  )
}
