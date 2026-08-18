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
      <div className="flex-1 overflow-y-auto hide-scrollbar pb-[88px] animate-enter">

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
                <Badge className="bg-primary text-white border-0 text-caption-2 font-semibold hover:bg-primary pointer-events-none">
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
              <p className="min-w-0 flex-1 text-headline-1 font-black text-white">{poll.title}</p>
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
            <p className="text-label-1-reading text-muted-foreground">{poll.description}</p>
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
                <button
                  key={option.id}
                  onClick={() => setSelectedId(option.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-4 rounded-sm border text-left',
                    'transition-opacity duration-100 hover:opacity-70 focus:outline-none focus-visible:outline-none',
                  'active:scale-[0.98]',
                    selected
                      ? 'border-primary bg-primary-dim'
                      : 'border-border bg-surface'
                  )}
                >
                  {/* 라디오 인디케이터 */}
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
                    selected ? 'border-primary' : 'border-muted-foreground/40'
                  )}>
                    {selected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    )}
                  </div>
                  <span className={cn(
                    'text-label-1-normal font-semibold',
                    selected ? 'text-primary' : 'text-foreground'
                  )}>
                    {option.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* 선수 정보 카드 */}
          {poll.player && (
            <Card className="mt-1">
              <CardContent className="p-4">
                <p className="text-caption-1 font-semibold text-muted-foreground uppercase mb-3">
                  선수 정보
                </p>
                <div className="flex items-center gap-3">
                  <img
                    src={poll.player.photo_url
                      ?? `https://placehold.co/44x44/0c2340/41b6e6?text=${poll.player.squad_number}`}
                    alt={poll.player.name}
                    className="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-2 ring-border"
                  />
                  <div>
                    <p className="text-label-1-normal font-bold text-foreground">{poll.player.name}</p>
                    <p className="text-caption-1 text-muted-foreground mt-0.5">
                      {poll.player.position}
                      <span className="mx-1.5">·</span>
                      <span className="font-semibold text-primary">#{poll.player.squad_number}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* 하단 고정 제출 버튼 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/95 backdrop-blur border-t z-30">
        <Button
          className="w-full h-12 text-label-1-normal font-bold"
          disabled={!selectedId || isPending}
          onClick={handleSubmitClick}
        >
          {isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" />제출 중…</>
            : '투표하기'
          }
        </Button>
      </div>

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
