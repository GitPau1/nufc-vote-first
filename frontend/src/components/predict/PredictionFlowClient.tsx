'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useLoadingRouter } from '@/components/layout/NavigationLoading'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { Button } from '@/components/ui/button'
import { StickyActionBar } from '@/components/layout/StickyActionBar'
import { LoginModal } from '@/components/polls/LoginModal'
import { PlayerPickModal } from './PlayerPickModal'
import { PredictionDone } from './PredictionDone'
import { PlayerPhoto, TeamBadge } from './shared'
import { StepHero, StepTrack, StepTrackVertical, type StepKey } from './steps'
import { POSITIONS, POSITION_LABEL, type Candidate, type Position } from '@/lib/predictions/candidates'
import { MAX_SCORE } from '@/lib/predictions/submit'
import { submitWeekPrediction, type SubmitPredictionResult } from '@/lib/actions/predictions'
import {
  NUFC_LABEL,
  NUFC_TEAM_ID,
  teamLogoUrl,
  type MatchView,
  type WeekPrediction,
  type WeekSession,
} from '@/lib/predictions/week'
import type { PickCandidates } from '@/lib/queries/squads'
import { cn } from '@/lib/utils'

/** fixture_id → 그 경기의 포지션별 픽. 픽은 경기별로 따로 고른다(2026-08-23 확정). */
type Picks = Record<string, Partial<Record<Position, Candidate>>>
/** fixture_id → [우리, 상대] */
type Scores = Record<string, [number, number]>

type SubmitError = Extract<SubmitPredictionResult, { error: string }>['error']

const ERROR_MESSAGE: Record<SubmitError, string> = {
  unauthenticated: '로그인이 필요해요',
  already_submitted: '이미 제출한 주차예요. 제출한 예측은 수정할 수 없어요.',
  closed: '예측이 마감된 주차예요',
  incomplete: '스코어와 선수 픽을 모두 채워주세요',
  invalid_score: '스코어는 0~20 사이로 입력해주세요',
  duplicate_picks: '포지션마다 서로 다른 선수를 골라주세요',
  unknown_player: '고를 수 없는 선수예요. 새로고침 후 다시 시도해주세요.',
  setup_required: '예측 제출 준비가 아직 끝나지 않았어요',
  failed: '제출에 실패했어요. 잠시 후 다시 시도해주세요.',
}

/**
 * 예측 세션 하나 = 주차 하나. 더블 매치위크면 아직 킥오프이 안 지난 경기의 스코어와 선수 픽을
 * 경기마다 각각 입력한 뒤 한 번에 제출한다(2026-08-23 확정 — 픽도 경기별).
 * 첫 경기가 끝난 뒤 들어오면 `pending`에 남은 경기만 담겨 온다 — 그 경기들만 예측한다.
 * 제출 후에는 수정할 수 없어서(DB UNIQUE + UPDATE 정책 없음) 완료 화면으로 고정된다.
 */
export function PredictionFlowClient({
  week,
  pending,
  candidates,
  submitted,
}: {
  week: WeekSession
  /** 이번에 제출할 경기 — 그 주에서 아직 안 잠기고 미제출인 것들 */
  pending: MatchView[]
  candidates: PickCandidates
  /** 남은 경기를 다 제출했으면 내 제출 내역(경기별 스코어 + 주 단위 픽) */
  submitted?: WeekPrediction
}) {
  const router = useLoadingRouter()
  const [step, setStep] = useState<StepKey>('score')
  const [scores, setScores] = useState<Scores>(() =>
    Object.fromEntries(pending.map(match => [match.id, [0, 0] as [number, number]])),
  )
  const [picks, setPicks] = useState<Picks>({})
  /** 열려 있는 픽 모달이 어느 경기의 어느 포지션인지 */
  const [pickTarget, setPickTarget] = useState<{ matchId: string; position: Position } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [submitting, startTransition] = useTransition()
  /** "그대로 적용"을 한 번이라도 썼는지 — 픽 단계 완료 이벤트에만 실어보낸다. */
  const copyUsedRef = useRef(false)

  // 경기마다 3포지션이 다 채워져야 다음 단계로 넘어갈 수 있다.
  const allPicked = pending.every(match => POSITIONS.every(position => picks[match.id]?.[position]))

  /**
   * 버튼 상한 가드와 changeScore 클램프를 뚫고 범위 밖 값이 들어온 경우까지 화면에서 막는 안전망.
   * 서버 왕복 후 invalid_score를 받는 대신 그 자리에서 알리고, 넘어가기·제출을 함께 잠근다.
   * 판정 기준은 서버(buildPredictionRows)와 같은 "0~MAX_SCORE 사이 정수"다.
   */
  const scoreRangeError = pending.some(match => {
    const [our, their] = scores[match.id] ?? [0, 0]
    return ![our, their].every(
      value => Number.isInteger(value) && value >= 0 && value <= MAX_SCORE,
    )
  })
    ? `스코어는 0~${MAX_SCORE} 사이로 입력해주세요`
    : null
  /** 범위 오류는 제출 실패 메시지보다 먼저 보여준다 — 지금 당장 고칠 수 있는 문제라서. */
  const visibleError = scoreRangeError ?? error
  // 더블 매치위크 = 이번에 제출할 경기가 2개 이상 — 스코어 입력이 경기별로 쌓이므로 안내 문구가 갈린다.
  const isMulti = pending.length > 1
  const goBackToList = () => router.push('/predictions')

  // 퍼널 A의 시작점. submitted면 아래에서 PredictionDone으로 갈리므로 플로우를 본 게 아니다
  // — 그 경우는 PredictionDone이 자기 마운트 이벤트를 쏜다.
  useEffect(() => {
    if (submitted) return
    trackEvent('prediction_flow_viewed', {
      week_key: week.weekKey,
      pending_match_count: pending.length,
      total_match_count: week.matches.length,
      // 그 주 경기 일부가 이미 킥오프돼서 남은 경기만 예측하는 상태(부분 제출)
      is_partial: pending.length < week.matches.length,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.weekKey])

  /** 스텝 완료 — 스코어 +/− 클릭마다 심으면 노이즈라 전환 시점에 스냅샷만 남긴다. */
  function completeStep(from: Extract<StepKey, 'score' | 'pick'>, next: StepKey) {
    trackEvent('prediction_step_completed', {
      week_key: week.weekKey,
      step: from,
      match_count: pending.length,
      is_multi: isMulti,
      ...(from === 'score'
        // 스코어는 전부 0-0으로 초기화돼 있어 "미입력" 상태가 없다. 대신 0-0을 그대로 넘긴
        // 경기 수를 본다 — 스테퍼를 아예 만지지 않고 통과하는 비율이 드러난다.
        ? {
            untouched_score_count: pending.filter(
              match => (scores[match.id]?.[0] ?? 0) === 0 && (scores[match.id]?.[1] ?? 0) === 0,
            ).length,
          }
        : { used_copy_picks: copyUsedRef.current }),
    })
    setStep(next)
  }

  function changeScore(fixtureId: string, side: 0 | 1, delta: number) {
    setScores(prev => {
      const current = prev[fixtureId] ?? [0, 0]
      const next: [number, number] = [current[0], current[1]]
      // 하한·상한 양쪽을 여기서 막는다. 상한은 서버 검증과 같은 MAX_SCORE를 쓴다 —
      // 예전에는 하한만 클램프해서 +를 21번 누르면 서버 왕복 후 invalid_score를 받았다.
      next[side] = Math.min(MAX_SCORE, Math.max(0, next[side] + delta))
      return { ...prev, [fixtureId]: next }
    })
  }

  /** "그대로 적용" — 첫 경기 픽을 다른 경기에 복사한다. 경기끼리 같은 선수를 골라도 제약에 걸리지 않는다. */
  function copyPicks(fromMatchId: string, toMatchId: string) {
    copyUsedRef.current = true
    setPicks(prev => ({ ...prev, [toMatchId]: { ...prev[fromMatchId] } }))
  }

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await submitWeekPrediction(week.weekKey, {
        scores,
        picks: Object.fromEntries(
          pending.map(match => [
            match.id,
            {
              DEF: picks[match.id]?.DEF?.id,
              MID: picks[match.id]?.MID?.id,
              FWD: picks[match.id]?.FWD?.id,
            },
          ]),
        ),
      })

      if ('success' in result) {
        // 성공 이벤트(prediction_submitted)는 서버 액션이 보낸다 — 애드블록에 막히지 않게.
        // 퍼널 종료 지점은 아래 refresh로 마운트되는 PredictionDone이 맡는다.
        // 제출 내역은 서버가 다시 읽는다(revalidate) — 새로고침하면 완료 화면으로 들어온다.
        router.refresh()
        return
      }
      if (result.error === 'unauthenticated') {
        // 퍼널 C: 비로그인 유저가 3스텝을 다 채운 뒤에야 만나는 로그인 벽.
        // 여기서 login_completed로 넘어가는 비율이 낮으면 로그인 요구를 앞으로 당겨야 한다.
        trackEvent('prediction_auth_required', {
          week_key: week.weekKey,
          match_count: pending.length,
        })
        setLoginOpen(true)
        return
      }
      trackEvent('prediction_submit_failed', {
        week_key: week.weekKey,
        error: result.error,
        match_count: pending.length,
      })
      setError(ERROR_MESSAGE[result.error])
    })
  }

  if (submitted) {
    return <PredictionDone week={week} prediction={submitted} candidates={candidates} />
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-32 pt-4 sm:max-w-content sm:px-10 sm:pb-16 sm:pt-6">
      <button
        type="button"
        onClick={goBackToList}
        className="hidden text-label-1-normal font-bold text-neutral-muted sm:mb-7 sm:inline-flex sm:items-center sm:gap-1.5"
      >
        ‹ 목록으로
      </button>

      <div className="sm:grid sm:grid-cols-[200px_1fr] sm:gap-x-10">
        <div className="mb-7 sm:mb-0">
          <div className="sm:hidden">
            <StepTrack current={step} />
            <StepHero current={step} multi={isMulti} />
          </div>
          <div className="hidden sm:block">
            <StepTrackVertical current={step} multi={isMulti} />
          </div>
        </div>

        <div>
          {step !== 'confirm' && (
          <div className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
            {step === 'score' && (
              // 더블 매치위크는 경기별 입력 블록이 세로로 쌓인다 — 픽은 주 단위라 다음 스텝에서 한 번만.
              <div className="flex flex-col gap-7">
                {pending.map((match, i) => (
                  <div key={match.id}>
                    {isMulti && <MatchLabel index={i} opponent={match.opponent} />}
                    <MatchMeta weekNo={week.weekNo} match={match} />
                    <div className="mt-5 flex items-center justify-center gap-5">
                      <TeamColumn logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
                      <ScoreStepper
                        value={scores[match.id]?.[0] ?? 0}
                        onChange={delta => changeScore(match.id, 0, delta)}
                      />
                      <ScoreStepper
                        value={scores[match.id]?.[1] ?? 0}
                        onChange={delta => changeScore(match.id, 1, delta)}
                      />
                      <TeamColumn logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {step === 'pick' &&
              // 경기마다 포지션 3장씩 따로 고른다. 두 번째 경기부터는 첫 경기 픽을 그대로 복사할 수 있다.
              pending.map((match, i) => (
                <div key={match.id} className={cn(i > 0 && 'mt-7')}>
                  {isMulti && (
                    <div className="mb-2 flex items-center justify-between">
                      <MatchLabel index={i} opponent={match.opponent} />
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => copyPicks(pending[0].id, match.id)}
                          className="text-label-2 font-bold text-brand"
                        >
                          그대로 적용
                        </button>
                      )}
                    </div>
                  )}
                  <PositionRow
                    picks={picks[match.id] ?? {}}
                    onOpen={position => setPickTarget({ matchId: match.id, position })}
                  />
                </div>
              ))}
          </div>
          )}

          {step === 'confirm' && (
              <>
                {/* 더블 매치위크는 경기마다 별도 카드로 나눈다(퍼블리싱 확인 — 한 컨테이너에 합치지 않음).
                    선수 픽은 주 단위 1세트라 마지막 카드 아래에 한 번만 붙는다. */}
                {pending.map((match, i) => (
                  <div key={match.id} className={cn(i > 0 && 'mt-5')}>
                    {isMulti && <MatchLabel index={i} opponent={match.opponent} />}
                    <div className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
                      <SectionHead title="경기 예측" onEdit={() => setStep('score')} />
                      <div className="flex items-center justify-center gap-2 sm:gap-6">
                        <ConfirmTeam logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
                        <span className="text-title-2 font-black">
                          {scores[match.id]?.[0] ?? 0} – {scores[match.id]?.[1] ?? 0}
                        </span>
                        <ConfirmTeam logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
                      </div>

                      <div className="mt-6">
                        <SectionHead title="선수 픽" onEdit={() => setStep('pick')} />
                      </div>
                      <PositionRow
                        picks={picks[match.id] ?? {}}
                        onOpen={position => setPickTarget({ matchId: match.id, position })}
                      />
                    </div>
                  </div>
                ))}

                <p className="mt-4 text-center text-caption-1 text-neutral-muted">
                  제출한 예측은 수정할 수 없어요
                </p>
              </>
          )}

          {visibleError && (
            <p role="alert" className="mt-3 text-center text-label-2 font-bold text-critical">
              {visibleError}
            </p>
          )}

          {/* 하단 제출 바는 투표 화면과 같은 StickyActionBar를 쓴다 — 예측 플로우는 폭이 더 좁고
              (모바일 shell / 데스크탑 560) 데스크탑에서 버튼을 가운데 고정폭으로 두는 차이만 override. */}
          <StickyActionBar className="max-w-shell border-neutral-weak sm:mt-8 sm:flex sm:max-w-[560px] sm:justify-center sm:pb-0">
            {step === 'score' && (
              <Button
                size="lg"
                className="w-full sm:w-[200px]"
                disabled={!!scoreRangeError}
                onClick={() => completeStep('score', 'pick')}
              >
                다음
              </Button>
            )}
            {step === 'pick' && (
              <Button size="lg" className="w-full sm:w-[200px]" disabled={!allPicked} onClick={() => completeStep('pick', 'confirm')}>
                다음
              </Button>
            )}
            {step === 'confirm' && (
              <Button
                size="lg"
                className="w-full sm:w-[200px]"
                disabled={submitting || !!scoreRangeError}
                onClick={handleSubmit}
              >
                {submitting ? '제출 중…' : '이대로 제출하기'}
              </Button>
            )}
          </StickyActionBar>
        </div>
      </div>

      <PlayerPickModal
        open={pickTarget !== null}
        onOpenChange={open => !open && setPickTarget(null)}
        positionLabel={pickTarget ? POSITION_LABEL[pickTarget.position] : ''}
        players={pickTarget ? candidates[pickTarget.position] : []}
        selectedPlayerId={pickTarget ? picks[pickTarget.matchId]?.[pickTarget.position]?.id ?? null : null}
        onSelect={player => {
          if (!pickTarget) return
          const { matchId, position } = pickTarget
          const picked = candidates[position].find(candidate => candidate.id === player.id)
          if (picked) {
            setPicks(prev => ({ ...prev, [matchId]: { ...prev[matchId], [position]: picked } }))
          }
          setPickTarget(null)
        }}
      />

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        triggerAction="predict"
      />
    </div>
  )
}

/** 더블 매치위크에서 이 블록이 어느 경기인지 — 예측/확인/완료/결과 화면이 같은 모양을 쓴다. */
function MatchLabel({ index, opponent }: { index: number; opponent: string }) {
  return (
    <p className="mb-2 text-label-2 font-extrabold text-neutral-muted">
      경기 {index + 1} · {NUFC_LABEL} vs {opponent}
    </p>
  )
}

function MatchMeta({ weekNo, match }: { weekNo: number; match: MatchView }) {
  return (
    <div className="text-center">
      <p className="mb-1 text-label-2 font-extrabold text-neutral-muted">
        {match.competition} · {weekNo}라운드
      </p>
      <p className="text-label-2 text-neutral-muted">
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
      <span className="text-label-2 font-bold text-neutral-muted">{name}</span>
    </div>
  )
}

function ScoreStepper({ value, onChange }: { value: number; onChange: (delta: number) => void }) {
  return (
    <div className="w-16 overflow-hidden rounded-md border border-neutral-weak bg-surface">
      <button
        type="button"
        aria-label="점수 증가"
        disabled={value >= MAX_SCORE}
        onClick={() => onChange(1)}
        className="flex h-[34px] w-full items-center justify-center bg-brand-solid text-body-1-normal text-on-solid transition-[opacity,background-color] duration-micro hover:opacity-70 active:bg-brand-solid-pressed disabled:pointer-events-none disabled:bg-disabled disabled:text-disabled disabled:opacity-100"
      >
        +
      </button>
      <div className="flex h-[52px] items-center justify-center border-y border-neutral-weak text-title-3 font-black">
        {value}
      </div>
      <button
        type="button"
        aria-label="점수 감소"
        disabled={value <= 0}
        onClick={() => onChange(-1)}
        className="flex h-[34px] w-full items-center justify-center bg-brand-solid text-body-1-normal text-on-solid transition-[opacity,background-color] duration-micro hover:opacity-70 active:bg-brand-solid-pressed disabled:pointer-events-none disabled:bg-disabled disabled:text-disabled disabled:opacity-100"
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
      <button type="button" onClick={onEdit} className="text-label-2 font-bold text-brand">
        수정
      </button>
    </div>
  )
}

function PositionRow({
  picks,
  onOpen,
}: {
  /** 경기 하나의 픽 — 상위에서 picks[matchId]를 넘긴다 */
  picks: Partial<Record<Position, Candidate>>
  onOpen: (position: Position) => void
}) {
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
              'flex min-h-[196px] min-w-0 flex-1 flex-col rounded-lg border border-neutral-weak p-3 text-left transition-colors duration-micro hover:border-neutral-strong',
              picked ? 'bg-surface' : 'bg-page',
            )}
          >
            <span className="text-caption-1 font-extrabold text-neutral-muted">{POSITION_LABEL[position]}</span>
            <div className="my-2.5 h-px bg-neutral-weak" />
            {picked ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1">
                <PlayerPhoto url={picked.photoUrl} />
                <p className="mt-0.5 text-center text-label-2 font-extrabold">{picked.name}</p>
                <span className="text-caption-1 font-bold text-brand">×{picked.multiplier.toFixed(1)}</span>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2">
                {/* 손으로 조립한 실루엣 원 대신 PlayerPhoto의 폴백을 그대로 쓴다 — 폴백 톤이 한 곳에서만 정해진다. */}
                <PlayerPhoto url={null} size={40} />
                <span className="text-center text-caption-2 font-bold text-neutral-muted">
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
