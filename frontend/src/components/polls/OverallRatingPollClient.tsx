'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { PollDetail } from '@/lib/queries/polls'
import type { PlayerRow, Position } from '@/types/database'
import { sortPlayersForRating } from '@/lib/polls/rating'
import { submitRatingVotes } from '@/lib/actions/ratings'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoginModal } from './LoginModal'
import { PollPageHeader } from './PollPageHeader'

type RatingState = Record<string, { score: number | null; comment: string }>

const SCORE_OPTIONS = [
  { score: 0, grade: 'F' },
  { score: 1, grade: 'D' },
  { score: 2, grade: 'C' },
  { score: 3, grade: 'B' },
  { score: 4, grade: 'A' },
  { score: 5, grade: 'S' },
]

const POSITION_LABELS: Record<Position, string> = {
  GK: '골키퍼',
  DEF: '수비수',
  MID: '미드필더',
  FWD: '공격수',
  MGR: '감독',
}

interface OverallRatingPollClientProps {
  poll: PollDetail
  isAuthenticated: boolean
}

export function OverallRatingPollClient({ poll, isAuthenticated }: OverallRatingPollClientProps) {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [showLogin, setShowLogin] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const players = useMemo(() => {
    const items = poll.poll_options
      .map(option => option.player_id && poll.option_players ? poll.option_players[option.player_id] : null)
      .filter((player): player is PlayerRow => !!player)
    return sortPlayersForRating(items)
  }, [poll.option_players, poll.poll_options])

  const [ratings, setRatings] = useState<RatingState>(() => Object.fromEntries(
    players.map(player => [player.id, { score: null, comment: '' }])
  ))

  const grouped = useMemo(() => {
    const positions: Position[] = ['GK', 'DEF', 'MID', 'FWD', 'MGR']
    return positions
      .map(position => ({
        position,
        players: players.filter(player => player.position === position),
      }))
      .filter(group => group.players.length > 0)
  }, [players])

  const currentGroup = grouped[stepIndex]
  const isLastStep = stepIndex === grouped.length - 1
  const totalRequired = players.length
  const completedCount = players.filter(player => ratings[player.id]?.score !== null).length
  const currentComplete = currentGroup?.players.every(player => ratings[player.id]?.score !== null) ?? false

  function setScore(playerId: string, score: number) {
    setRatings(prev => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? { comment: '' }), score },
    }))
  }

  function setComment(playerId: string, comment: string) {
    setRatings(prev => ({
      ...prev,
      [playerId]: { ...(prev[playerId] ?? { score: null }), comment },
    }))
  }

  function handleNext() {
    if (!currentComplete) return
    if (!isLastStep) setStepIndex(index => index + 1)
  }

  function handleSubmit() {
    if (!isAuthenticated) { setShowLogin(true); return }
    if (completedCount !== totalRequired) {
      setErrorMsg('모든 선수를 평가해주세요.')
      return
    }

    setErrorMsg(null)
    startTransition(async () => {
      const result = await submitRatingVotes(poll.id, players.map(player => ({
        playerId: player.id,
        score: ratings[player.id].score ?? 0,
        comment: ratings[player.id].comment,
      })))

      if ('success' in result) {
        router.refresh()
      } else {
        setErrorMsg(
          result.error === 'already_voted'
            ? '이미 참여한 평가입니다'
            : result.error === 'incomplete'
              ? '모든 선수를 평가해주세요'
              : result.error === 'setup_required'
                ? '전체 평가 DB 마이그레이션이 필요합니다'
                : '제출에 실패했습니다. 다시 시도해주세요'
        )
      }
    })
  }

  const coverUrl = poll.thumbnail_url
    ?? `https://placehold.co/480x160/0c2340/41b6e6?text=${encodeURIComponent(poll.title.slice(0, 4))}`

  return (
    <div className="relative flex min-h-screen flex-col">
      <PollPageHeader />

      <div className="flex-1 overflow-y-auto pb-[92px] animate-enter">
        <div className="relative h-[160px] overflow-hidden">
          <img src={coverUrl} alt={poll.title} className="h-full w-full object-cover" />
          <div className="banner-text-overlay absolute inset-0" />
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Badge className="border-0 bg-white/20 text-caption-2 font-semibold text-white backdrop-blur-sm pointer-events-none">전체 평가</Badge>
              <Badge className="border-0 bg-primary text-caption-2 font-semibold text-white hover:bg-primary pointer-events-none">{completedCount}/{totalRequired} 완료</Badge>
            </div>
            <h1 className="text-headline-1 font-black text-white">{poll.title}</h1>
          </div>
        </div>

        <div className="space-y-4 px-4 py-4">
          {poll.description && (
            <p className="text-label-1-reading text-muted-foreground">{poll.description}</p>
          )}
          {errorMsg && (
            <p className="text-label-1-normal font-medium text-destructive">{errorMsg}</p>
          )}

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {grouped.map((group, index) => (
              <button
                key={group.position}
                type="button"
                onClick={() => index <= stepIndex && setStepIndex(index)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-caption-1 font-bold whitespace-nowrap',
                  index === stepIndex ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                )}
              >
                {POSITION_LABELS[group.position]}
              </button>
            ))}
          </div>

          {currentGroup && (
            <section className="space-y-3">
              <div>
                <p className="text-caption-2 font-bold uppercase text-primary">
                  {POSITION_LABELS[currentGroup.position]}
                </p>
                <p className="mt-0.5 text-label-2 text-muted-foreground">
                  각 선수에게 0~5점 등급을 선택해주세요. 코멘트는 선택입니다.
                </p>
              </div>

              {currentGroup.players.map(player => {
                const rating = ratings[player.id] ?? { score: null, comment: '' }
                const stats = poll.current_season_stats?.[player.id]
                return (
                  <Card key={player.id}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={player.photo_url ?? `https://placehold.co/48x48/0c2340/41b6e6?text=${player.squad_number ?? player.name.slice(0, 1)}`}
                          alt={player.name}
                          className="h-12 w-12 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-label-1-normal font-black text-foreground">{player.name}</p>
                          <p className="text-caption-1 text-muted-foreground">{player.position} · #{player.squad_number ?? '-'}</p>
                          <p className="mt-1 text-caption-2 font-semibold text-muted-foreground">
                            출장 {stats?.appearances ?? 0} · 득점 {stats?.goals ?? 0} · 어시스트 {stats?.assists ?? 0}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-6 gap-1.5">
                        {SCORE_OPTIONS.map(option => {
                          const selected = rating.score === option.score
                          return (
                            <button
                              key={option.score}
                              type="button"
                              onClick={() => setScore(player.id, option.score)}
                              className={cn(
                                'rounded-lg border py-2 text-center text-caption-1 font-black transition-colors',
                                selected ? 'border-primary bg-primary text-white' : 'border-border bg-white text-foreground'
                              )}
                            >
                              <span className="block text-label-2">{option.grade}</span>
                            </button>
                          )
                        })}
                      </div>

                      <textarea
                        value={rating.comment}
                        onChange={event => setComment(player.id, event.target.value)}
                        maxLength={500}
                        rows={2}
                        className="input-field resize-none"
                        placeholder={`${player.name}에 대한 코멘트(선택)`}
                      />
                    </CardContent>
                  </Card>
                )
              })}
            </section>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 border-t bg-white/95 p-4 backdrop-blur">
        {isLastStep ? (
          <Button className="h-12 w-full rounded-lg text-label-1-normal font-bold" disabled={isPending || completedCount !== totalRequired} onClick={handleSubmit}>
            {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />제출 중...</> : '전체 평가 제출'}
          </Button>
        ) : (
          <Button className="h-12 w-full rounded-lg text-label-1-normal font-bold" disabled={!currentComplete} onClick={handleNext}>
            다음 포지션 평가
          </Button>
        )}
      </div>

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} triggerAction="vote" />
    </div>
  )
}
