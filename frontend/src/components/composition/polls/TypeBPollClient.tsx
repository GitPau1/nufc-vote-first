'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { PollDetail } from '@/lib/queries/polls'
import type { PlayerRow, PollOptionRow } from '@/types/database'
import { submitVote } from '@/lib/actions/vote'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/primitives/badge'
import { Button } from '@/components/primitives/button'
import { RadioOption } from '@/components/primitives/radio'
import { StickyActionBar } from '@/components/primitives/sticky-action-bar'
import { Modal } from '@/components/primitives/modal/Modal'
import { ConfirmContent } from '@/components/primitives/modal/contents/Confirm'
import { LoginContent } from '@/components/primitives/modal/contents/Login'
import { PollPageHeader } from './PollPageHeader'
import { getStatusLabel, getStatusTone } from './PollCard'
import { formatPollDate, getOptionThumb } from './ResultView'

interface TypeBPollClientProps {
  poll: PollDetail
  isAuthenticated: boolean
}

/** 라벨 아래 보조 줄. 선수면 포지션·등번호, 자유 선택지면 설명. */
function getOptionSubLabel(option: PollOptionRow, optionPlayers?: Record<string, PlayerRow>) {
  const player = option.player_id ? optionPlayers?.[option.player_id] ?? null : null
  if (player) {
    return player.squad_number != null
      ? `${player.position} · #${player.squad_number}`
      : player.position
  }
  return option.description ?? null
}

export function TypeBPollClient({ poll, isAuthenticated }: TypeBPollClientProps) {
  // 무선택으로 시작한다. 예전에는 useState(0)이라 진입 즉시 1번 선택지가 골라진 상태였는데,
  // 미리 선택된 옵션은 그 자체가 강한 제안으로 작동해 응답을 왜곡한다(NN/g). 평가형(TypeA)도
  // 무선택에서 시작하고 CTA를 막는다 — 두 화면의 동작을 맞췄다.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showLogin, setShowLogin]     = useState(false)
  const [errorMsg, setErrorMsg]       = useState<string | null>(null)
  const [isPending, startTransition]  = useTransition()
  const router                        = useRouter()

  const options        = poll.poll_options
  const selectedOption = options.find(option => option.id === selectedId)

  // 한 투표 안에 사진이 하나라도 있으면 모든 행이 썸네일 슬롯을 예약해 텍스트 시작선을 맞춘다.
  // 사진이 없는 행은 ResultProgress와 같은 방식으로 이름 첫 글자를 채운다.
  // 아무 행에도 사진이 없는 투표(free_choice)는 슬롯 자체를 만들지 않는다.
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
    ?? `https://placehold.co/680x252/0c2340/41b6e6?text=${encodeURIComponent(poll.title.slice(0, 4))}`

  const pollDate = formatPollDate(poll.created_at ?? poll.scheduled_at ?? poll.closes_at)

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <PollPageHeader />

      {/* 폭은 max-w-detail(680px)로 둔다. 결과 화면(ResultView)은 제출 화면 컨벤션에 맞춰
          max-w-[860px]로 바뀌어 더 이상 이 폭과 같지 않다 — 여기서 맞추는 건 커버 이미지 처리
          (overflow-hidden rounded-lg bg-disabled)뿐이다: 참여 전후로 커버 톤이 갈리면 안 된다. */}
      <main className="mx-auto w-full max-w-detail px-4 pb-[88px] pt-4 animate-enter sm:pb-10">
        {/* 모바일·데스크탑 모두 한 컬럼. 읽는 덩어리 → 고르는 덩어리 순서로 세로로 쌓는다. */}
        <div className="flex flex-col gap-6">

          {/* 읽는 자리 */}
          <div className="flex flex-col gap-3">
            {/* 이미지는 단독으로 둔다. 글은 아래 컨테이너가 전부 받는다.
                예전에는 화면 폭 전체를 쓰는 풀블리드 커버 위에 제목을 오버레이했는데, 그건
                이 리포에서 투표 상세 화면들에만 있던 예외였다 — 나머지 이미지는 전부 라운드
                컨테이너 안에 들어간다(PollHeroCard·PollCard·ResultView). */}
            <div className="overflow-hidden rounded-lg bg-disabled">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt={poll.title} className="h-[252px] w-full object-cover" />
            </div>

            {/* 글 컨테이너 — 타이틀 · 세부 정보 · 본문 */}
            <section className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
              <h1 className="break-keep text-heading-2 sm:text-heading-1 font-semibold text-neutral">
                {poll.title}
              </h1>

              {/* 유형 배지('선택')는 없앴다 — 선택지 UI를 보면 자명하다.
                  마감 표기는 PollCard와 같은 Badge variant를 쓴다(색을 직접 박지 않는다). */}
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption-1 text-neutral-muted">
                <Badge
                  variant={getStatusTone(poll)}
                  className="pointer-events-none whitespace-nowrap"
                >
                  {getStatusLabel(poll)}
                </Badge>
                {pollDate && <span>{pollDate}</span>}
                <span>{poll.creator_name ?? 'Admin'}</span>
              </div>

              {poll.description && (
                <>
                  <div className="my-4 h-px bg-neutral-weak" />
                  {/* 이 화면의 핵심 액션이 "읽고 나서 투표"라 본문 역할 토큰을 쓴다.
                      label-1-reading(14px, "라벨 크기의 긴 안내 문구")이 아니라
                      body-1-reading(16px/26px, "줄이 길어지는 텍스트"). 색도 메타색이 아닌 본문색. */}
                  <p className="text-body-1-reading text-neutral">
                    {poll.description}
                  </p>
                </>
              )}
            </section>
          </div>

          {/* 고르는 자리 */}
          <div className="flex flex-col gap-3">
            <p className="text-label-2 font-medium text-neutral-strong">
              선택지 {options.length}개 · 하나만 고를 수 있어요
            </p>

            {errorMsg && (
              <p role="alert" className="text-label-1-normal font-medium text-critical">
                {errorMsg}
              </p>
            )}

            <div className="flex flex-col gap-2" role="radiogroup" aria-label="투표 선택지">
              {options.map(option => {
                const selected = selectedId === option.id
                const thumb    = getOptionThumb(option, poll.option_players)
                const sub      = getOptionSubLabel(option, poll.option_players)

                return (
                  <RadioOption
                    key={option.id}
                    selected={selected}
                    onClick={() => setSelectedId(option.id)}
                  >
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
                      {/* 선택지 이름은 잘리면 고를 수가 없다 — truncate 대신 line-clamp-2. */}
                      <span className={cn(
                        'block break-keep line-clamp-2 text-body-2-normal font-semibold',
                        selected ? 'text-brand' : 'text-neutral'
                      )}>
                        {option.label}
                      </span>
                      {sub && (
                        <span className="mt-0.5 block truncate text-caption-1 font-medium text-neutral-muted">
                          {sub}
                        </span>
                      )}
                    </span>
                  </RadioOption>
                )
              })}
            </div>

            {/* StickyActionBar의 데스크탑 기본값이 sm:max-w-detail이라 본문 폭과 그대로 맞는다. */}
            <StickyActionBar className="sm:mt-2 sm:pb-0">
              <Button
                size="lg"
                className="w-full"
                disabled={!selectedId || isPending}
                onClick={handleSubmitClick}
              >
                {isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" />제출 중…</>
                  : '투표하기'
                }
              </Button>
            </StickyActionBar>
          </div>
        </div>
      </main>

      {/* 모달 */}
      {selectedOption && (
        <Modal open={showConfirm} onOpenChange={o => { if (!o) setShowConfirm(false) }}>
          <ConfirmContent
            selectedLabel={selectedOption.label}
            onCancel={() => setShowConfirm(false)}
            onConfirm={handleConfirm}
            isPending={isPending}
          />
        </Modal>
      )}
      <Modal open={showLogin} onOpenChange={o => { if (!o) setShowLogin(false) }} form="default">
        <LoginContent triggerAction="vote" onClose={() => setShowLogin(false)} />
      </Modal>
    </div>
  )
}
