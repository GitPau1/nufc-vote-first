'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PlayerPickModal } from './PlayerPickModal'
import { PlayerPhoto, Silhouette, TeamBadge } from './shared'
import { StepHero, StepTrack, StepTrackVertical, type StepKey } from './steps'
import { CANDIDATES, POSITIONS, POSITION_LABEL, type Candidate, type Position } from '@/lib/predictions/candidates'
import { NUFC_LABEL, NUFC_TEAM_ID, teamLogoUrl, type MatchView, type WeekGroup } from '@/lib/predictions/week'
import { cn } from '@/lib/utils'

type Picks = Partial<Record<Position, Candidate>>

/**
 * 예측 세션 하나 = 주(week) 하나. 더블 매치위크면 경기별 스코어를 각각 받지만
 * 선수 픽은 주 단위로 한 세트만 받는다(프로토타입 기준).
 */
export function PredictionFlowClient({ week }: { week: WeekGroup }) {
  const router = useRouter()
  const [step, setStep] = useState<StepKey>('score')
  // matches와 같은 순서·개수. 각 원소가 [우리, 상대] 예측 스코어.
  const [scores, setScores] = useState<Array<[number, number]>>(week.matches.map(() => [0, 0]))
  const [picks, setPicks] = useState<Picks>({})
  const [pickPosition, setPickPosition] = useState<Position | null>(null)

  const allPicked = POSITIONS.every(position => picks[position])
  const goBackToList = () => router.push('/predictions')

  function changeScore(matchIndex: number, side: 0 | 1, delta: number) {
    setScores(prev =>
      prev.map((score, i) => {
        if (i !== matchIndex) return score
        const next: [number, number] = [score[0], score[1]]
        next[side] = Math.max(0, next[side] + delta)
        return next
      }),
    )
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-32 pt-4 sm:max-w-content sm:px-10 sm:pb-16 sm:pt-6">
      <button
        type="button"
        onClick={goBackToList}
        className="hidden text-label-1-normal font-bold text-gray-2 sm:mb-7 sm:inline-flex sm:items-center sm:gap-1.5"
      >
        ‹ 목록으로
      </button>

      <div className="sm:grid sm:grid-cols-[200px_1fr] sm:gap-x-10">
        <div className="mb-7 sm:mb-0">
          <div className="sm:hidden">
            <StepTrack current={step} />
            <StepHero current={step} />
          </div>
          <div className="hidden sm:block">
            <StepTrackVertical current={step} />
          </div>
        </div>

        <div>
          <div className="rounded-lg border border-border bg-surface px-4 py-5">
            {step === 'score' && (
              <div className="flex flex-col gap-7">
                {week.matches.map((match, i) => (
                  <div key={match.id}>
                    <MatchMeta match={match} />
                    <div className="mt-5 flex items-center justify-center gap-5">
                      <TeamColumn logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
                      <ScoreStepper value={scores[i][0]} onChange={delta => changeScore(i, 0, delta)} />
                      <ScoreStepper value={scores[i][1]} onChange={delta => changeScore(i, 1, delta)} />
                      <TeamColumn logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 'pick' && <PositionRow picks={picks} onOpen={setPickPosition} />}

            {step === 'confirm' && (
              <>
                <SectionHead title="경기 예측" onEdit={() => setStep('score')} />
                <div className="flex flex-col gap-4">
                  {week.matches.map((match, i) => (
                    <div key={match.id} className="flex items-center justify-center gap-2 sm:gap-6">
                      <ConfirmTeam logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
                      <span className="text-title-2 font-black">
                        {scores[i][0]} – {scores[i][1]}
                      </span>
                      <ConfirmTeam logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <SectionHead title="선수 픽" onEdit={() => setStep('pick')} />
                </div>
                <PositionRow picks={picks} onOpen={setPickPosition} />
              </>
            )}
          </div>

          <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-shell -translate-x-1/2 border-t border-border bg-white/95 p-4 backdrop-blur sm:static sm:mx-auto sm:mt-8 sm:flex sm:max-w-[560px] sm:translate-x-0 sm:justify-center sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
            {step === 'score' && (
              <Button size="lg" className="w-full sm:w-[200px]" onClick={() => setStep('pick')}>
                다음
              </Button>
            )}
            {step === 'pick' && (
              <Button size="lg" className="w-full sm:w-[200px]" disabled={!allPicked} onClick={() => setStep('confirm')}>
                다음
              </Button>
            )}
            {step === 'confirm' && (
              <Button
                size="lg"
                className="w-full sm:w-[200px]"
                // ponytail: 제출 서버액션(predictions 테이블, 주 단위 세션)과 완료 화면은 다음 단계 작업이다.
                onClick={() => window.alert('제출 기능은 아직 준비 중이에요')}
              >
                이대로 제출하기
              </Button>
            )}
          </div>
        </div>
      </div>

      <PlayerPickModal
        open={pickPosition !== null}
        onOpenChange={open => !open && setPickPosition(null)}
        positionLabel={pickPosition ? POSITION_LABEL[pickPosition] : ''}
        players={pickPosition ? CANDIDATES[pickPosition] : []}
        selectedPlayerId={pickPosition ? picks[pickPosition]?.id ?? null : null}
        onSelect={player => {
          if (!pickPosition) return
          const picked = CANDIDATES[pickPosition].find(candidate => candidate.id === player.id)
          if (picked) setPicks(prev => ({ ...prev, [pickPosition]: picked }))
          setPickPosition(null)
        }}
      />
    </div>
  )
}

function MatchMeta({ match }: { match: MatchView }) {
  return (
    <div className="text-center">
      <p className="mb-1 text-label-2 font-extrabold text-gray-2">{match.competition}</p>
      <p className="text-label-2 text-gray-3">
        {match.kickoff} ({match.isHome ? '홈' : '원정'}) {match.kickoffTime}
      </p>
    </div>
  )
}

function TeamColumn({ logoUrl, name }: { logoUrl: string; name: string }) {
  return (
    <div className="flex w-[88px] flex-col items-center gap-2">
      <TeamBadge logoUrl={logoUrl} name={name} />
      <span className="text-center text-label-1-normal font-extrabold">{name}</span>
    </div>
  )
}

function ConfirmTeam({ logoUrl, name }: { logoUrl: string; name: string }) {
  return (
    <div className="flex w-[88px] shrink-0 flex-col items-center gap-1.5">
      <TeamBadge logoUrl={logoUrl} name={name} />
      <span className="text-label-2 font-bold text-gray-2">{name}</span>
    </div>
  )
}

function ScoreStepper({ value, onChange }: { value: number; onChange: (delta: number) => void }) {
  return (
    <div className="w-16 overflow-hidden rounded-md border border-border bg-surface">
      <button
        type="button"
        aria-label="점수 증가"
        onClick={() => onChange(1)}
        className="flex h-[34px] w-full items-center justify-center bg-primary text-body-1-normal text-white transition-colors hover:bg-primary-dark"
      >
        +
      </button>
      <div className="flex h-[52px] items-center justify-center border-y border-border text-title-3 font-black">
        {value}
      </div>
      <button
        type="button"
        aria-label="점수 감소"
        disabled={value <= 0}
        onClick={() => onChange(-1)}
        className="flex h-[34px] w-full items-center justify-center bg-primary text-body-1-normal text-white transition-colors hover:bg-primary-dark disabled:bg-surface disabled:text-gray-3"
      >
        −
      </button>
    </div>
  )
}

function SectionHead({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <span className="text-body-2-normal font-bold">{title}</span>
      <button type="button" onClick={onEdit} className="text-label-2 font-bold text-primary">
        수정
      </button>
    </div>
  )
}

function PositionRow({ picks, onOpen }: { picks: Picks; onOpen: (position: Position) => void }) {
  return (
    <div className="flex gap-2.5">
      {POSITIONS.map(position => {
        const picked = picks[position]
        return (
          <button
            key={position}
            type="button"
            onClick={() => onOpen(position)}
            className={cn(
              'flex min-h-[196px] min-w-0 flex-1 flex-col rounded-lg border border-border p-3 text-left transition-colors hover:border-primary',
              picked ? 'bg-surface' : 'bg-background',
            )}
          >
            <span className="text-caption-1 font-extrabold text-gray-2">{POSITION_LABEL[position]}</span>
            <div className="my-2.5 h-px bg-border" />
            {picked ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1">
                <PlayerPhoto url={picked.photoUrl} />
                <p className="mt-0.5 text-center text-label-2 font-extrabold">{picked.name}</p>
                <span className="text-caption-1 font-bold text-primary-dark">×{picked.multiplier.toFixed(1)}</span>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-disabled text-gray-3">
                  <Silhouette />
                </span>
                <span className="text-center text-caption-2 font-bold text-gray-3">
                  선수를
                  <br />
                  선택해요
                </span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
