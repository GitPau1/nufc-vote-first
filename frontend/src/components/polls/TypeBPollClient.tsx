'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import type { PollDetail } from '@/lib/queries/polls'
import type { PlayerRow } from '@/types/database'
import { submitVote } from '@/lib/actions/vote'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from './ConfirmModal'
import { LoginModal } from './LoginModal'
import { PollPageHeader } from './PollPageHeader'

interface TypeBPollClientProps {
  poll: PollDetail
  isAuthenticated: boolean
}

const CARD_W  = 200  // 센터 카드 px
const SIDE_SCALE = 0.83
const PLAYER_INFO_H = 62
const FREE_INFO_H = 92

export function TypeBPollClient({ poll, isAuthenticated }: TypeBPollClientProps) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showLogin, setShowLogin]     = useState(false)
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()
  const [touchStartX, setTouchStartX] = useState<number | null>(null)
  const router                        = useRouter()

  const options = poll.poll_options
  const selectedOption = options[selectedIdx]
  const isFreeChoice = poll.type === 'free_choice'
  const cardH = CARD_W + (isFreeChoice ? FREE_INFO_H : PLAYER_INFO_H)
  const selectedPlayer: PlayerRow | null =
    selectedOption?.player_id && poll.option_players
      ? poll.option_players[selectedOption.player_id] ?? null
      : null

  function prev() { setSelectedIdx(i => Math.max(0, i - 1)) }
  function next() { setSelectedIdx(i => Math.min(options.length - 1, i + 1)) }

  function handleSubmit() {
    if (!isAuthenticated) { setShowLogin(true); return }
    setShowConfirm(true)
  }

  function handleConfirm() {
    setErrorMsg(null)
    startTransition(async () => {
      const result = await submitVote(poll.id, selectedOption.id)
      if ('success' in result) {
        trackEvent('vote_submitted', {
          source_page: 'poll_detail',
          poll_id: poll.id,
          poll_type: poll.type,
          poll_status: poll.status,
          creator_type: poll.created_by && poll.creator_name ? 'user' : 'admin',
          option_id: selectedOption.id,
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

  const daysLeft = Math.ceil(
    (new Date(poll.closes_at).getTime() - Date.now()) / 86400000
  )

  const coverUrl = poll.thumbnail_url
    ?? poll.player?.photo_url
    ?? `https://placehold.co/480x160/0c2340/41b6e6?text=${encodeURIComponent(poll.title.slice(0, 4))}`

  return (
    <div className="relative flex flex-col min-h-screen">
      {/* 페이지 헤더 */}
      <PollPageHeader />

      <div className="flex-1 overflow-y-auto hide-scrollbar pb-[88px] animate-enter">

        {/* 커버 이미지 — 칩 → 제목 순서로 오버레이 */}
        <div className="relative h-[160px] overflow-hidden">
          <img src={coverUrl} alt={poll.title} className="w-full h-full object-cover" />
          <div className="banner-text-overlay absolute inset-0" />
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm text-caption-2 font-semibold pointer-events-none">
                선택
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
            <div className="flex items-end justify-between gap-3">
              <h1 className="min-w-0 flex-1 text-headline-1 font-black text-white">{poll.title}</h1>
              {poll.creator_name && (
                <span className="max-w-[38%] truncate text-right text-caption-1 font-bold text-white/80">{poll.creator_name}</span>
              )}
            </div>
          </div>
        </div>

        {/* 설명 + 에러 */}
        {(poll.description || errorMsg) && (
          <div className="px-4 pt-4 pb-0 flex flex-col gap-2">
            {poll.description && (
              <p className="text-label-1-reading text-muted-foreground">{poll.description}</p>
            )}
            {errorMsg && (
              <p className="text-label-1-normal text-destructive font-medium">{errorMsg}</p>
            )}
          </div>
        )}

        {/* 캐러셀 */}
        <div
          className="relative overflow-hidden mt-4"
          style={{ height: cardH + 8 }}
          onTouchStart={e => setTouchStartX(e.touches[0].clientX)}
          onTouchEnd={e => {
            if (touchStartX === null) return
            const dx = e.changedTouches[0].clientX - touchStartX
            if (dx > 50) prev()
            else if (dx < -50) next()
            setTouchStartX(null)
          }}
        >
          {options.map((option, i) => {
            const pos      = i - selectedIdx
            const isCenter = pos === 0
            const absPOS   = Math.abs(pos)

            // ±2 까지 렌더 유지 (팝인 방지), 그 이상은 제거
            if (absPOS > 2) return null

            const gap  = 16
            const step = CARD_W * ((1 + SIDE_SCALE) / 2) + gap
            const x    = pos * step
            const player: PlayerRow | null =
              option.player_id && poll.option_players
                ? poll.option_players[option.player_id] ?? null
                : null

            const thumbUrl = option.image_url
              ?? player?.photo_url
              ?? null
            const fallbackText = isFreeChoice
              ? option.label.slice(0, 2)
              : player?.name.slice(0, 2) ?? option.label.slice(0, 2)

            // ±2 카드는 투명하게 대기 (위치는 유지해 transition smooth)
            const opacity      = absPOS >= 2 ? 0 : isCenter ? 1 : 0.5
            const zIdx         = isCenter ? 10 : absPOS === 1 ? 5 : 1
            const isInteractive = isCenter || absPOS === 1

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => !isCenter && isInteractive && setSelectedIdx(i)}
                className={cn(
                  'absolute top-0 overflow-hidden rounded-lg border border-border bg-surface text-left shadow-g200',
                  'transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isCenter && 'border-primary shadow-w200',
                  isCenter ? 'cursor-default' : 'cursor-pointer'
                )}
                style={{
                  width:         CARD_W,
                  height:        cardH,
                  left:          `calc(50% - ${CARD_W / 2}px + ${x}px)`,
                  transform:     `scale(${isCenter ? 1 : SIDE_SCALE})`,
                  opacity,
                  zIndex:        zIdx,
                  pointerEvents: isInteractive ? 'auto' : 'none',
                }}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-primary-dark">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={option.label}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/30 to-primary-dark text-title-1 font-black text-white">
                      {fallbackText}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/35 to-transparent" />
                  {player?.squad_number != null && (
                    <span className="absolute left-2.5 top-2.5 rounded-pill bg-white/95 px-2.5 py-1 text-caption-1 font-black text-foreground shadow-g100">
                      #{player.squad_number}
                    </span>
                  )}
                  {isCenter && (
                    <div className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary shadow-w200">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>

                <div className={cn('bg-surface px-3 py-2.5', isFreeChoice ? 'min-h-[92px]' : 'min-h-[62px]')}>
                  <p className={cn(
                    'text-body-2-normal font-black text-foreground',
                    isFreeChoice ? 'line-clamp-2' : 'line-clamp-1'
                  )}>
                    {option.label}
                  </p>
                  {isFreeChoice && option.description && (
                    <p className="mt-1.5 line-clamp-2 text-caption-1 font-medium text-muted-foreground">
                      {option.description}
                    </p>
                  )}
                  {!isFreeChoice && player && (
                    <p className="mt-0.5 text-caption-1 font-bold text-muted-foreground">
                      {player.position}
                    </p>
                  )}
                </div>
                {isCenter && (
                  <div className="absolute inset-0 rounded-lg ring-4 ring-inset ring-primary pointer-events-none" />
                )}
              </button>
            )
          })}
        </div>

        {/* 네비게이션 컨트롤 */}
        <div className="flex items-center justify-center gap-4 mt-4 px-4">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={prev}
            disabled={selectedIdx === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* 도트 인디케이터 */}
          <div className="flex items-center gap-1.5">
            {options.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelectedIdx(i)}
                className={cn(
                  'rounded-full transition-all duration-200',
                  i === selectedIdx
                    ? 'w-5 h-2 bg-primary'
                    : 'w-2 h-2 bg-muted-foreground/30'
                )}
              />
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={next}
            disabled={selectedIdx === options.length - 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* 선택된 선수 요약 */}
        <div className="mx-4 mt-4 rounded-md bg-disabled px-4 py-3">
          <p className="text-caption-1 text-muted-foreground mb-0.5">현재 선택</p>
          <p className="text-label-1-normal font-bold text-foreground">{selectedOption?.label}</p>
          {!isFreeChoice && selectedPlayer && (
            <p className="mt-1 text-caption-1 text-muted-foreground">{selectedPlayer.position}</p>
          )}
          {isFreeChoice && selectedOption?.description && (
            <p className="mt-1 text-caption-1 text-muted-foreground">{selectedOption.description}</p>
          )}
        </div>
      </div>

      {/* 하단 고정 제출 버튼 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 bg-white/95 backdrop-blur border-t z-30">
        <Button
          className="w-full h-12 text-label-1-normal font-bold"
          disabled={isPending}
          onClick={handleSubmit}
        >
          {isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" />제출 중…</>
            : '투표하기'
          }
        </Button>
      </div>

      <ConfirmModal
        open={showConfirm}
        selectedLabel={selectedOption?.label ?? ''}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        isPending={isPending}
      />
      <LoginModal
        open={showLogin}
        onClose={() => setShowLogin(false)}
        triggerAction="vote"
      />
    </div>
  )
}
