'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PollEditLink } from './PollEditLink'
import { Loader2 } from 'lucide-react'
import type { PollDetail } from '@/lib/queries/polls'
import type { PlayerRow, PollOptionRow } from '@/types/database'
import { submitVote } from '@/lib/actions/vote'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/primitives/badge'
import { Button } from '@/components/primitives/button'
import { Card, CardContent } from '@/components/primitives/card'
import { RadioOption } from '@/components/primitives/radio'
import { StickyActionBar } from '@/components/primitives/sticky-action-bar'
import { Modal } from '@/components/primitives/modal/Modal'
import { ConfirmContent } from '@/components/primitives/modal/contents/Confirm'
import { LoginContent } from '@/components/primitives/modal/contents/Login'
import { PollPageHeader } from './PollPageHeader'
import { getStatusLabel, getStatusTone } from './PollCard'
import { formatPollDate, getOptionThumb } from './ResultView'

interface PollClientProps {
  poll: PollDetail
  isAuthenticated: boolean
  canEdit: boolean
}

/** 라벨 아래 보조 줄. 선수면 포지션·등번호, 자유 선택지면 설명. (구 TypeBPollClient) */
function getOptionSubLabel(option: PollOptionRow, optionPlayers?: Record<string, PlayerRow>) {
  const player = option.player_id ? optionPlayers?.[option.player_id] ?? null : null
  if (player) {
    return player.squad_number != null ? `${player.position} · #${player.squad_number}` : player.position
  }
  return option.description ?? null
}

export function PollClient({ poll, isAuthenticated, canEdit }: PollClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const showSubjectPlayer = !!poll.player_id
  const options = poll.poll_options
  const selectedOption = options.find(o => o.id === selectedId)
  const hasAnyThumb = options.some(option => getOptionThumb(option, poll.option_players) !== null)

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
        setErrorMsg(result.error === 'already_voted' ? '이미 참여한 투표입니다' : '제출에 실패했습니다. 다시 시도해주세요')
      }
    })
  }

  const coverUrl = poll.thumbnail_url
    ?? poll.player?.photo_url
    ?? `https://placehold.co/680x252/0c2340/41b6e6?text=${encodeURIComponent(poll.title.slice(0, 4))}`
  const pollDate = formatPollDate(poll.created_at ?? poll.closes_at)
  const daysLeft = Math.ceil((new Date(poll.closes_at).getTime() - Date.now()) / 86400000)

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <PollPageHeader action={canEdit && <PollEditLink pollId={poll.id} />} />

      <main className="mx-auto w-full max-w-detail px-4 pb-[88px] pt-4 animate-enter sm:pb-10">
        <div className="flex flex-col gap-6">

          {showSubjectPlayer ? (
            /* 구 TypeA — 커버에 칩+제목 오버레이. '평가' 칩은 삭제됨(TEA-26). 높이는 TEA-27 반응형(Step 6). */
            <div className="relative h-[160px] overflow-hidden rounded-lg">
              <img src={coverUrl} alt={poll.title} className="w-full h-full object-cover" />
              <div className="banner-text-overlay absolute inset-0" />
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  {daysLeft > 0 ? (
                    <Badge className="bg-brand-solid text-white border-0 text-caption-2 font-medium hover:bg-brand-solid pointer-events-none">
                      D-{daysLeft} 마감
                    </Badge>
                  ) : (
                    <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm text-caption-2 font-medium pointer-events-none">
                      마감
                    </Badge>
                  )}
                </div>
                <div className="flex items-end justify-between gap-3">
                  <p className="min-w-0 flex-1 text-headline-2 sm:text-headline-1 font-semibold text-white">{poll.title}</p>
                  {poll.creator_name && (
                    <span className="max-w-[38%] truncate text-right text-caption-1 font-medium text-white/80">{poll.creator_name}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 구 TypeB — 커버 단독 블록 + 글 컨테이너 */
            <>
              <div className="overflow-hidden rounded-lg bg-disabled">
                <img src={coverUrl} alt={poll.title} className="h-[252px] w-full object-cover" />
              </div>
              <section className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
                <h1 className="break-keep text-heading-2 sm:text-heading-1 font-semibold text-neutral">{poll.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption-1 text-neutral-muted">
                  <Badge variant={getStatusTone(poll)} className="pointer-events-none whitespace-nowrap">
                    {getStatusLabel(poll)}
                  </Badge>
                  {pollDate && <span>{pollDate}</span>}
                  <span>{poll.creator_name ?? 'Admin'}</span>
                </div>
                {poll.description && (
                  <>
                    <div className="my-4 h-px bg-neutral-weak" />
                    <p className="text-body-1-reading text-neutral">{poll.description}</p>
                  </>
                )}
              </section>
            </>
          )}

          {showSubjectPlayer && poll.description && (
            <p className="text-label-1-reading text-neutral-muted">{poll.description}</p>
          )}

          {canEdit && (
            <div className="hidden justify-end sm:flex">
              <PollEditLink pollId={poll.id} />
            </div>
          )}

          <div className="flex flex-col gap-3">
            {!showSubjectPlayer && (
              <p className="text-label-2 font-medium text-neutral-strong">
                선택지 {options.length}개 · 하나만 고를 수 있어요
              </p>
            )}

            {errorMsg && (
              <p role="alert" className="text-label-1-normal font-medium text-critical">{errorMsg}</p>
            )}

            <div className="flex flex-col gap-2" role="radiogroup" aria-label="투표 선택지">
              {options.map(option => {
                const selected = selectedId === option.id
                const thumb = getOptionThumb(option, poll.option_players)
                const sub = getOptionSubLabel(option, poll.option_players)
                return (
                  <RadioOption key={option.id} selected={selected} onClick={() => setSelectedId(option.id)}>
                    {hasAnyThumb && (
                      <span className="flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-pill bg-brand-solid text-caption-1 font-medium text-white">
                        {thumb?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span>{thumb?.fallback ?? option.label.slice(0, 1)}</span>
                        )}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cn('block break-keep line-clamp-2 text-body-2-normal font-semibold', selected ? 'text-brand' : 'text-neutral')}>
                        {option.label}
                      </span>
                      {sub && <span className="mt-0.5 block truncate text-caption-1 font-medium text-neutral-muted">{sub}</span>}
                    </span>
                  </RadioOption>
                )
              })}
            </div>

            <StickyActionBar className="sm:mt-2 sm:pb-0">
              <Button size="lg" className="w-full" disabled={!selectedId || isPending} onClick={handleSubmitClick}>
                {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />제출 중…</> : '투표하기'}
              </Button>
            </StickyActionBar>
          </div>

          {showSubjectPlayer && poll.player && (
            <Card className="mt-1">
              <CardContent className="p-4">
                <p className="text-caption-1 font-medium text-neutral-muted uppercase mb-3">선수 정보</p>
                <div className="flex items-center gap-3">
                  <img
                    src={poll.player.photo_url ?? `https://placehold.co/44x44/0c2340/41b6e6?text=${poll.player.squad_number}`}
                    alt={poll.player.name}
                    className="w-11 h-11 rounded-pill object-cover flex-shrink-0"
                  />
                  <div>
                    <p className="text-label-1-normal font-medium text-neutral">{poll.player.name}</p>
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
      </main>

      {selectedOption && (
        <Modal open={showConfirm} onOpenChange={o => { if (!o) setShowConfirm(false) }}>
          <ConfirmContent selectedLabel={selectedOption.label} onCancel={() => setShowConfirm(false)} onConfirm={handleConfirm} isPending={isPending} />
        </Modal>
      )}
      <Modal open={showLogin} onOpenChange={o => { if (!o) setShowLogin(false) }} form="default">
        <LoginContent triggerAction="vote" onClose={() => setShowLogin(false)} />
      </Modal>
    </div>
  )
}
