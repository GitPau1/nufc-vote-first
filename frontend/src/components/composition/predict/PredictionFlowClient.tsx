'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useLoadingRouter } from '@/components/primitives/navigation-loading'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { Button } from '@/components/primitives/button'
import { StickyActionBar } from '@/components/primitives/sticky-action-bar'
import { Modal } from '@/components/primitives/modal/Modal'
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/primitives/modal/sheet'
import { ConfirmContent } from '@/components/primitives/modal/contents/Confirm'
import { LoginContent } from '@/components/primitives/modal/contents/Login'
import { PlayerPickContent } from '@/components/primitives/modal/contents/PlayerPick'
import { PredictionDone } from './PredictionDone'
import { PlayerPhoto, TeamBadge, ToonCost, BudgetBar } from './shared'
import { StepHero, StepTrack, StepTrackVertical, type StepKey } from './steps'
import { POSITIONS, POSITION_LABEL, type Candidate, type Position } from '@/lib/predictions/candidates'
import { MAX_SCORE, BUDGET } from '@/lib/predictions/submit'
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
  over_budget: '한 경기 선수 3명의 비용 합이 5툰을 넘을 수 없어요',
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
  /** "돌아가기" 확인 모달(AI-004) — 입력한 스코어·픽이 저장 없이 사라진다는 걸 확인받는다. */
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  /** 제출 확인 모달(AI-005) — 로그인 벽을 만나 리다이렉트 없이 데모 로그인에 성공하면
   * 이 모달이 다시 열린 상태로 돌아온다(onLoginSuccess). 자동 제출은 하지 않는다. */
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false)
  const [submitting, startTransition] = useTransition()
  /** "그대로 적용"을 한 번이라도 썼는지 — 픽 단계 완료 이벤트에만 실어보낸다. */
  const copyUsedRef = useRef(false)
  /** 뒤로가기 히스토리 가드(AI-004)에서 "그만두기"를 확정한 뒤 세우는 재진입 플래그 —
   * 이 순간부터는 popstate가 와도 이탈 확인 모달을 다시 띄우지 않는다(진짜 이탈이 진행 중이라서). */
  const leavingRef = useRef(false)

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
  /** 히스토리 가드(AI-004)를 걸지 판단하는 기준 — 스코어를 한 번이라도 건드렸거나(0-0에서
   * 벗어났거나) 픽을 하나라도 골랐으면 참이다. 스코어 쪽은 completeStep의 untouched_score_count와
   * 같은 신호(0-0인 채인지)를 그대로 재사용한다 — 둘 다 "만졌는지"를 값으로만 판단한다. */
  const hasScoreInput = pending.some(match => {
    const [our, their] = scores[match.id] ?? [0, 0]
    return our !== 0 || their !== 0
  })
  const hasPickInput = Object.values(picks).some(matchPicks =>
    Object.values(matchPicks ?? {}).some(Boolean),
  )
  const hasInput = hasScoreInput || hasPickInput
  /** "돌아가기"는 바로 나가지 않고 확인 모달을 먼저 띄운다 — 실제 이탈은 confirmLeave가 한다. */
  const requestLeave = () => setLeaveConfirmOpen(true)
  const confirmLeave = () => {
    setLeaveConfirmOpen(false)
    leavingRef.current = true
    router.push('/predictions')
  }

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

  /**
   * AI-004: 뒤로가기 히스토리 가드. 공유 헤더(AppHeader mobileBack)의 router.back()이
   * 이탈 확인 모달을 우회하는 문제를, 헤더를 고치지 않고 여기서 막는다.
   * 입력이 하나도 없으면(둘러보는 중) 가드를 걸지 않고, 제출 완료 화면(submitted)에서도 걸지 않는다.
   */
  useEffect(() => {
    if (submitted || !hasInput) return

    // 미끼 엔트리를 하나 쌓는다 — 이후 popstate 한 번은 이걸 소비할 뿐 실제 페이지 이탈이 아니다.
    window.history.pushState({ predictLeaveGuard: true }, '', window.location.href)

    function handlePopState() {
      // confirmLeave가 이미 이탈을 확정했다면(재진입 플래그) 더 이상 가로채지 않는다.
      if (leavingRef.current) return
      setLeaveConfirmOpen(true)
      // 확인 모달을 띄운 뒤에도 같은 자리에 머물러야 하므로 가드를 다시 쌓는다.
      window.history.pushState({ predictLeaveGuard: true }, '', window.location.href)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [hasInput, submitted])

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
        setSubmitConfirmOpen(false)
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
        // 제출 확인 모달 위에 로그인 모달을 겹치지 않고 교체한다 — 데모 로그인 성공 시
        // LoginContent의 onLoginSuccess가 이 모달을 다시 연다(자동 제출은 하지 않는다).
        setSubmitConfirmOpen(false)
        setLoginOpen(true)
        return
      }
      setSubmitConfirmOpen(false)
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
        onClick={requestLeave}
        className="hidden text-label-1-normal font-medium text-neutral-muted sm:mb-7 sm:inline-flex sm:items-center sm:gap-1.5"
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
                          className="text-label-2 font-medium text-brand"
                        >
                          그대로 적용
                        </button>
                      )}
                    </div>
                  )}
                  <BudgetBar
                    spent={POSITIONS.reduce(
                      (sum, position) => sum + (picks[match.id]?.[position]?.cost ?? 0),
                      0,
                    )}
                  />
                  <div className="mt-2.5">
                    <PositionRow
                      picks={picks[match.id] ?? {}}
                      onOpen={position => setPickTarget({ matchId: match.id, position })}
                    />
                  </div>
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
                        <span className="text-title-2 font-semibold">
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
            <p role="alert" className="mt-3 text-center text-label-2 font-medium text-critical">
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
                onClick={() => setSubmitConfirmOpen(true)}
              >
                {submitting ? '제출 중…' : '이대로 제출하기'}
              </Button>
            )}
          </StickyActionBar>
        </div>
      </div>

      {/* 껍데기가 아니라 목록만 스크롤한다(타이틀·드래그 핸들 고정) — 세로 flex로 높이를 나눠주고
          스크롤은 PlayerPickContent 내부 목록이 맡는다. */}
      <Modal
        open={pickTarget !== null}
        onOpenChange={open => !open && setPickTarget(null)}
        className="flex max-h-[78vh] flex-col overflow-hidden sm:max-h-[80vh]"
      >
        <PlayerPickContent
          positionLabel={pickTarget ? POSITION_LABEL[pickTarget.position] : ''}
          players={pickTarget ? candidates[pickTarget.position] : []}
          remainingBudget={
            pickTarget
              ? BUDGET -
                POSITIONS.filter(position => position !== pickTarget.position).reduce(
                  (sum, position) => sum + (picks[pickTarget.matchId]?.[position]?.cost ?? 0),
                  0,
                )
              : BUDGET
          }
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
      </Modal>

      {/* AI-004: "돌아가기"는 바로 나가지 않고 여기서 한 번 더 확인한다 — 입력한 스코어·픽이
          저장 없이 사라지기 때문. ConfirmContent는 "제출 후 변경 불가" 문구가 고정돼 있어(그 모달이
          존재하는 이유) 이탈 확인에는 맞지 않는다 — 그래서 같은 Sheet 조각으로 직접 구성한다. */}
      <Modal open={leaveConfirmOpen} onOpenChange={o => { if (!o) setLeaveConfirmOpen(false) }}>
        <SheetHeader className="mb-5 text-left">
          <SheetTitle className="text-headline-1">예측을 그만두시겠어요?</SheetTitle>
          <SheetDescription>지금까지 입력한 스코어와 선수 픽이 저장되지 않고 사라집니다.</SheetDescription>
        </SheetHeader>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setLeaveConfirmOpen(false)}>
            취소
          </Button>
          <Button className="flex-[2]" onClick={confirmLeave}>
            그만두기
          </Button>
        </div>
      </Modal>

      {/* AI-005: 제출 확인 모달. 확인을 눌러야 실제 submitWeekPrediction이 실행된다.
          비로그인이면 handleSubmit이 이 모달을 닫고 로그인 모달을 연다 — 데모 로그인 성공 시
          LoginContent의 onLoginSuccess가 이 모달을 다시 연 상태로 돌려보낸다(자동 재제출 아님). */}
      <Modal open={submitConfirmOpen} onOpenChange={o => { if (!o) setSubmitConfirmOpen(false) }}>
        <ConfirmContent
          title="이대로 제출할까요?"
          selectedLabel={`${pending.length}경기 예측`}
          summaryCaption="내 예측"
          onCancel={() => setSubmitConfirmOpen(false)}
          onConfirm={handleSubmit}
          isPending={submitting}
        />
      </Modal>

      <Modal open={loginOpen} onOpenChange={o => { if (!o) setLoginOpen(false) }} form="default">
        <LoginContent
          triggerAction="predict"
          onClose={() => setLoginOpen(false)}
          onLoginSuccess={() => setSubmitConfirmOpen(true)}
        />
      </Modal>
    </div>
  )
}

/** 더블 매치위크에서 이 블록이 어느 경기인지 — 예측/확인/완료/결과 화면이 같은 모양을 쓴다. */
function MatchLabel({ index, opponent }: { index: number; opponent: string }) {
  return (
    <p className="mb-2 text-label-2 font-medium text-neutral-muted">
      경기 {index + 1} · {NUFC_LABEL} vs {opponent}
    </p>
  )
}

function MatchMeta({ weekNo, match }: { weekNo: number; match: MatchView }) {
  return (
    <div className="text-center">
      <p className="mb-1 text-label-2 font-medium text-neutral-muted">
        {match.competition} · {weekNo}라운드
      </p>
      <p className="text-label-2 text-neutral-muted">
        {match.kickoff} ({match.isHome ? '홈' : '원정'}) {match.kickoffTime}
      </p>
    </div>
  )
}

function TeamColumn({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  return (
    <div className="flex w-[88px] flex-col items-center gap-2">
      <TeamBadge logoUrl={logoUrl} name={name} />
      <span className="text-center text-label-1-normal font-medium">{name}</span>
    </div>
  )
}

function ConfirmTeam({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  return (
    <div className="flex w-[88px] shrink-0 flex-col items-center gap-1.5">
      <TeamBadge logoUrl={logoUrl} name={name} />
      <span className="text-label-2 font-medium text-neutral-muted">{name}</span>
    </div>
  )
}

/**
 * +/− 가능·불가능은 **면을 채우지 않고 기호 색으로만** 말한다 — 누를 수 있으면
 * `text-neutral-muted`, 한계에 닿아 못 누르면 `text-disabled`(한 단계 밝다). 전에는 누를 수 있는
 * 쪽을 `bg-brand-solid`로 채웠는데, 스코어 입력은 브랜드 CTA가 아니라 값을 미세조정하는 컨트롤이라
 * 카드 안에서 제출 버튼보다 더 강하게 튀었다. 면은 `bg-surface` 하나로 두고 구분은 경계선이 한다.
 */
const SCORE_STEP_BUTTON_CLASS =
  'flex h-[34px] w-full items-center justify-center bg-surface text-body-1-normal text-neutral-muted transition-[opacity,background-color] duration-micro hover:opacity-70 active:bg-neutral-weak disabled:pointer-events-none disabled:text-disabled'

function ScoreStepper({ value, onChange }: { value: number; onChange: (delta: number) => void }) {
  return (
    <div className="w-16 overflow-hidden rounded-md border border-neutral-weak bg-surface">
      <button
        type="button"
        aria-label="점수 증가"
        disabled={value >= MAX_SCORE}
        onClick={() => onChange(1)}
        className={SCORE_STEP_BUTTON_CLASS}
      >
        +
      </button>
      <div className="flex h-[52px] items-center justify-center border-y border-neutral-weak text-title-3 font-semibold">
        {value}
      </div>
      <button
        type="button"
        aria-label="점수 감소"
        disabled={value <= 0}
        onClick={() => onChange(-1)}
        className={SCORE_STEP_BUTTON_CLASS}
      >
        −
      </button>
    </div>
  )
}

function SectionHead({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <span className="text-body-2-normal font-semibold">{title}</span>
      <button type="button" onClick={onEdit} className="text-label-2 font-medium text-brand">
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
            <span className="text-caption-1 font-medium text-neutral-muted">{POSITION_LABEL[position]}</span>
            <div className="my-2.5 h-px bg-neutral-weak" />
            {picked ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1">
                <PlayerPhoto url={picked.photoUrl} />
                <p className="mt-0.5 text-center text-label-2 font-medium">{picked.name}</p>
                <ToonCost cost={picked.cost} />
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2">
                {/* 손으로 조립한 실루엣 원 대신 PlayerPhoto의 폴백을 그대로 쓴다 — 폴백 톤이 한 곳에서만 정해진다. */}
                <PlayerPhoto url={null} size={40} />
                <span className="text-center text-caption-2 font-medium text-neutral-muted">
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
