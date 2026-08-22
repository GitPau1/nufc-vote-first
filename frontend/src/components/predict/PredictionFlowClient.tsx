'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LoginModal } from '@/components/polls/LoginModal'
import { PlayerPickModal } from './PlayerPickModal'
import { PredictionDone } from './PredictionDone'
import { PlayerPhoto, Silhouette, TeamBadge } from './shared'
import { StepHero, StepTrack, StepTrackVertical, type StepKey } from './steps'
import { POSITIONS, POSITION_LABEL, type Candidate, type Position } from '@/lib/predictions/candidates'
import { submitPrediction, type SubmitPredictionResult } from '@/lib/actions/predictions'
import { NUFC_LABEL, NUFC_TEAM_ID, teamLogoUrl, type MatchSession } from '@/lib/predictions/week'
import type { MyPrediction } from '@/lib/queries/predictions'
import type { PickCandidates } from '@/lib/queries/squads'
import { cn } from '@/lib/utils'

type Picks = Partial<Record<Position, Candidate>>

type SubmitError = Extract<SubmitPredictionResult, { error: string }>['error']

const ERROR_MESSAGE: Record<SubmitError, string> = {
  unauthenticated: '로그인이 필요해요',
  already_submitted: '이미 제출한 경기예요. 제출한 예측은 수정할 수 없어요.',
  closed: '예측이 마감된 경기예요',
  incomplete: '스코어와 선수 픽을 모두 채워주세요',
  invalid_score: '스코어는 0~20 사이로 입력해주세요',
  duplicate_picks: '포지션마다 서로 다른 선수를 골라주세요',
  unknown_player: '고를 수 없는 선수예요. 새로고침 후 다시 시도해주세요.',
  setup_required: '예측 제출 준비가 아직 끝나지 않았어요',
  failed: '제출에 실패했어요. 잠시 후 다시 시도해주세요.',
}

/**
 * 예측 세션 하나 = 경기(fixture) 하나. 더블 매치위크의 두 경기는 각각 이 플로우를 따로 밟는다.
 * 제출 후에는 수정할 수 없어서(DB UNIQUE + UPDATE 정책 없음) 완료 화면으로 고정된다.
 */
export function PredictionFlowClient({
  match,
  candidates,
  submitted,
}: {
  match: MatchSession
  candidates: PickCandidates
  /** 이미 제출한 경기면 내 제출 내역(스코어 + 픽) */
  submitted?: MyPrediction
}) {
  const router = useRouter()
  const [step, setStep] = useState<StepKey>('score')
  // [우리, 상대] 예측 스코어.
  const [score, setScore] = useState<[number, number]>([0, 0])
  const [picks, setPicks] = useState<Picks>({})
  const [pickPosition, setPickPosition] = useState<Position | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const allPicked = POSITIONS.every(position => picks[position])
  const goBackToList = () => router.push('/predictions')

  function changeScore(side: 0 | 1, delta: number) {
    setScore(prev => {
      const next: [number, number] = [prev[0], prev[1]]
      next[side] = Math.max(0, next[side] + delta)
      return next
    })
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await submitPrediction(match.id, {
        ourScore: score[0],
        theirScore: score[1],
        picks: {
          DEF: picks.DEF?.id,
          MID: picks.MID?.id,
          FWD: picks.FWD?.id,
        },
      })

      if ('success' in result) {
        // 제출 내역은 서버가 다시 읽는다(revalidate) — 새로고침하면 완료 화면으로 들어온다.
        router.refresh()
        return
      }
      if (result.error === 'unauthenticated') {
        setLoginOpen(true)
        return
      }
      setError(ERROR_MESSAGE[result.error])
    })
  }

  if (submitted) {
    return <PredictionDone match={match} prediction={submitted} candidates={candidates} />
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
              <div>
                <MatchMeta match={match} />
                <div className="mt-5 flex items-center justify-center gap-5">
                  <TeamColumn logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
                  <ScoreStepper value={score[0]} onChange={delta => changeScore(0, delta)} />
                  <ScoreStepper value={score[1]} onChange={delta => changeScore(1, delta)} />
                  <TeamColumn logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
                </div>
              </div>
            )}

            {step === 'pick' && <PositionRow picks={picks} onOpen={setPickPosition} />}

            {step === 'confirm' && (
              <>
                <SectionHead title="경기 예측" onEdit={() => setStep('score')} />
                <div className="flex items-center justify-center gap-2 sm:gap-6">
                  <ConfirmTeam logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
                  <span className="text-title-2 font-black">
                    {score[0]} – {score[1]}
                  </span>
                  <ConfirmTeam logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
                </div>
                <div className="mt-6">
                  <SectionHead title="선수 픽" onEdit={() => setStep('pick')} />
                </div>
                <PositionRow picks={picks} onOpen={setPickPosition} />
                <p className="mt-4 text-center text-caption-1 text-gray-3">
                  제출한 예측은 수정할 수 없어요
                </p>
              </>
            )}
          </div>

          {error && (
            <p role="alert" className="mt-3 text-center text-label-2 font-bold text-negative">
              {error}
            </p>
          )}

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
              <Button size="lg" className="w-full sm:w-[200px]" disabled={pending} onClick={handleSubmit}>
                {pending ? '제출 중…' : '이대로 제출하기'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <PlayerPickModal
        open={pickPosition !== null}
        onOpenChange={open => !open && setPickPosition(null)}
        positionLabel={pickPosition ? POSITION_LABEL[pickPosition] : ''}
        players={pickPosition ? candidates[pickPosition] : []}
        selectedPlayerId={pickPosition ? picks[pickPosition]?.id ?? null : null}
        onSelect={player => {
          if (!pickPosition) return
          const picked = candidates[pickPosition].find(candidate => candidate.id === player.id)
          if (picked) setPicks(prev => ({ ...prev, [pickPosition]: picked }))
          setPickPosition(null)
        }}
      />

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        triggerAction="vote"
      />
    </div>
  )
}

function MatchMeta({ match }: { match: MatchSession }) {
  return (
    <div className="text-center">
      <p className="mb-1 text-label-2 font-extrabold text-gray-2">
        {match.competition} · {match.weekNo}라운드
      </p>
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
