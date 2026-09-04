'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { CircleHelp } from 'lucide-react'
import { useLoadingRouter } from '@/components/primitives/navigation-loading'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { Button } from '@/components/primitives/button'
import { Card } from '@/components/primitives/card'
import { StickyActionBar } from '@/components/primitives/sticky-action-bar'
import { Modal } from '@/components/primitives/modal/Modal'
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/primitives/modal/sheet'
import { ConfirmContent } from '@/components/primitives/modal/contents/Confirm'
import { LoginContent } from '@/components/primitives/modal/contents/Login'
import { PlayerPickContent } from '@/components/primitives/modal/contents/PlayerPick'
import { badgeVariants } from '@/components/primitives/badge'
import { PredictionDone } from './PredictionDone'
import { PlayerPhoto, TeamBadge, ToonCost, Silhouette } from './shared'
import { STEP_META, ProgressPips, type StepKey } from './steps'
import {
  computeNextFromPick,
  computePrevStep,
  startEditFromConfirm,
  isFirstFlowStep,
  flowPipIndex,
} from './flow-cursor'
import {
  excludeDeparted,
  POSITIONS,
  POSITION_LABEL,
  type Candidate,
  type Position,
} from '@/lib/predictions/candidates'
import { MAX_SCORE, BUDGET } from '@/lib/predictions/submit'
import { competitionColorBucket, COMPETITION_BADGE } from '@/lib/predictions/competitionColor'
import {
  submitWeekPrediction,
  updateMatchPrediction,
  type SubmitPredictionResult,
} from '@/lib/actions/predictions'
import {
  NUFC_LABEL,
  NUFC_TEAM_ID,
  teamLogoUrl,
  weekLabel,
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
  already_submitted: '이미 제출한 경기예요. 완료 화면에서 수정해주세요.',
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
 * 예측 세션 하나 = 주차 하나(submit 모드) 또는 경기 하나(edit 모드). 더블 매치위크면 아직
 * 킥오프이 안 지난 경기의 스코어와 선수 픽을 경기마다 각각 입력한 뒤 한 번에 제출한다(2026-08-23
 * 확정 — 픽도 경기별). 첫 경기가 끝난 뒤 들어오면 `pending`에 남은 경기만 담겨 온다 — 그
 * 경기들만 예측한다. 승부예측은 킥오프 전까지 자유롭게 재제출(수정)할 수 있다 — `mode === 'edit'`이면
 * 이미 제출된 경기 하나만 `updateMatchPrediction`으로 고친다(완료 화면 하단 "수정하기"에서 진입).
 *
 * 레이아웃(2026-08-31 개편): 좌측 사이드바 스텝 트랙을 없애고 단일 컬럼 카드로 바꿨다.
 * 제목/설명은 카드 헤더(좌), 진행 표시는 ProgressPips(우). 데스크탑은 세 스텝을 같은 그리드
 * 칸에 겹쳐 쌓아 높이를 가장 큰 '확인' 단계에 맞춘다(스텝 전환 시 컨테이너 높이 고정). 버튼은
 * 데스크탑에서 카드 하단 푸터(우측 이전/다음·제출 + 좌측 상태), 모바일에서 StickyActionBar.
 * 더블 매치위크 입력 흐름(2026-09-04 재설계, feature-spec §9): score/pick 단계는 경기 수와
 * 무관하게 항상 `pending[matchCursor]` 하나만 보여준다 — 경기 1 스코어→픽→경기 2 스코어→픽→
 * confirm(두 경기 다 같이) 고정 순서로 `matchCursor`가 오간다. "그대로 적용"(픽 복사)은 폐기됐다.
 * confirm 단계만 예전처럼 pending 전체를 한 화면에 모아 보여주고, 제출은 한 번만 호출한다.
 */
export function PredictionFlowClient({
  week,
  pending,
  candidates,
  submitted,
  mode = 'submit',
  matchIds,
  initialValues,
}: {
  week: WeekSession
  /** 이번 세션이 다루는 정확한 경기 집합 — submit 모드는 미제출 경기, edit 모드는 수정할 경기 1개 */
  pending: MatchView[]
  candidates: PickCandidates
  /** 남은 경기를 다 제출했으면 내 제출 내역(경기별 스코어 + 주 단위 픽) */
  submitted?: WeekPrediction
  /** 'edit'이면 이미 제출된 경기 하나(pending은 항상 길이 1)의 스코어·픽을 고친다. 기본 'submit'. */
  mode?: 'submit' | 'edit'
  /** 서버로 보낼 정확한 경기 id 목록(=pending.map(id)) — 서버가 이 목록으로만 검증 대상을 좁힌다 */
  matchIds: string[]
  /** mode === 'edit'일 때 그 경기의 기존 제출값으로 스코어·픽을 초기화한다 */
  initialValues?: {
    score: [number, number]
    picks: Record<Position, { playerId: number; multiplier: number }>
  }
}) {
  const router = useLoadingRouter()
  const [step, setStep] = useState<StepKey>('score')
  const [scores, setScores] = useState<Scores>(() =>
    Object.fromEntries(
      pending.map(match => [
        match.id,
        (mode === 'edit' && initialValues ? initialValues.score : [0, 0]) as [number, number],
      ]),
    ),
  )
  const [picks, setPicks] = useState<Picks>(() => {
    if (mode !== 'edit' || !initialValues || !pending[0]) return {}
    const resolved: Partial<Record<Position, Candidate>> = {}
    for (const position of POSITIONS) {
      const { playerId } = initialValues.picks[position]
      const found = candidates[position].find(c => c.id === playerId)
      if (found) resolved[position] = found
    }
    return { [pending[0].id]: resolved }
  })
  /**
   * 지금 스코어·픽을 입력 중인 경기 인덱스(고정 순서 a-b-a-b-c, feature-spec §9). score/pick
   * 단계는 이제 pending.length와 무관하게 이 커서가 가리키는 경기 하나만 보여준다. 단일 경기
   * 세션(submit 1개, edit)에서는 항상 0이라 기존 동작과 같다.
   */
  const [matchCursor, setMatchCursor] = useState(0)
  /**
   * confirm 화면에서 경기 하나만 고치러 들어온 왕복 중인지(flow-cursor.ts 참고) — 켜져 있으면
   * pick 단계 "다음"이 나머지 경기를 거치지 않고 곧장 confirm으로 돌아간다(코드리뷰 2026-09-05
   * 버그 수정: 이 플래그가 없으면 마지막이 아닌 경기를 고칠 때 나머지 경기를 다시 다 눌러야
   * confirm으로 돌아왔다).
   */
  const [returnToConfirm, setReturnToConfirm] = useState(false)
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
  /** 뒤로가기 히스토리 가드(AI-004)에서 "그만두기"를 확정한 뒤 세우는 재진입 플래그 —
   * 이 순간부터는 popstate가 와도 이탈 확인 모달을 다시 띄우지 않는다(진짜 이탈이 진행 중이라서). */
  const leavingRef = useRef(false)

  // 경기마다 3포지션이 다 채워져야 다음 단계로 넘어갈 수 있다(제출 버튼의 최종 안전망).
  const allPicked = pending.every(match => POSITIONS.every(position => picks[match.id]?.[position]))
  /** score/pick 단계가 지금 보여주는 경기 — matchCursor가 가리키는 하나뿐이다. */
  const currentMatch = pending[matchCursor]
  /** pick 단계 "다음" 버튼은 지금 보이는 경기만 다 채워지면 눌린다(전체가 아니라). */
  const currentMatchPicked = currentMatch
    ? POSITIONS.every(position => picks[currentMatch.id]?.[position])
    : false
  /** 픽 모달 "선택 가능 목록"에만 쓴다 — 떠난 선수는 새로 고를 수 없다. 이미 고른 픽 조회(L502)는
   * candidates를 그대로 쓴다(클릭된 id는 항상 이 목록에서 나온 값이라 걸러도 무방하지만, 과거
   * 픽 이름 표시와 같은 원칙을 지키려 원본을 남겨둔다). */
  const selectableCandidates = useMemo(() => excludeDeparted(candidates), [candidates])

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
  // 이탈 확인 모달(leaveConfirmOpen)은 뒤로가기 popstate 가드(AI-004)가 직접 띄운다. 개편 전에는
  // 데스크탑 "목록으로" 버튼도 트리거였지만, 시안에서 그 버튼이 빠지며 트리거는 popstate 하나가 됐다.
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
      // 스코어는 전부 0-0으로 초기화돼 있어 "미입력" 상태가 없다. 대신 0-0을 그대로 넘긴
      // 경기 수를 본다 — 스테퍼를 아예 만지지 않고 통과하는 비율이 드러난다.
      ...(from === 'score'
        ? {
            untouched_score_count: pending.filter(
              match => (scores[match.id]?.[0] ?? 0) === 0 && (scores[match.id]?.[1] ?? 0) === 0,
            ).length,
          }
        : {}),
    })
    setStep(next)
  }

  /** flow-cursor.ts가 계산한 다음 상태를 세 React state(step/matchCursor/returnToConfirm)에 반영한다. */
  function applyCursor(next: { step: StepKey; matchCursor: number; returnToConfirm: boolean }) {
    setStep(next.step)
    setMatchCursor(next.matchCursor)
    setReturnToConfirm(next.returnToConfirm)
  }

  /**
   * pick 단계 "다음" — 고정 순서 a-b-a-b-c(feature-spec §9.1)를 여기서 진행시킨다. 아직 볼
   * 경기가 남았으면 다음 경기의 score로, 마지막 경기면 confirm으로 넘어간다. confirm에서 경기
   * 하나만 고치러 온 왕복 중(returnToConfirm)이면 몇 번째 경기든 곧장 confirm으로 돌아간다.
   */
  function goNextFromPick() {
    const next = computeNextFromPick({ step, matchCursor, returnToConfirm }, pending.length)
    completeStep('pick', next.step)
    applyCursor(next)
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

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const input = {
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
      }
      const result =
        mode === 'edit'
          ? await updateMatchPrediction(week.weekKey, matchIds[0], input)
          : await submitWeekPrediction(week.weekKey, matchIds, input)

      if ('success' in result) {
        // 성공 이벤트(prediction_submitted)는 서버 액션이 보낸다 — 애드블록에 막히지 않게.
        // updateMatchPrediction은 이번 스코프에서 서버 이벤트를 안 보낸다(§5 스킵 확정).
        setSubmitConfirmOpen(false)
        if (mode === 'edit') {
          // query(?edit=)를 지우고 완료 허브로 돌아간다 — refresh만 하면 URL이 그대로 남아
          // 같은 edit 화면이 다시 뜬다(무한 루프는 아니지만 "수정 완료" 느낌을 주지 못한다).
          router.push(`/predictions/${week.weekKey}`)
        } else {
          // 제출 내역은 서버가 다시 읽는다(revalidate) — 새로고침하면 완료 화면으로 들어온다.
          router.refresh()
        }
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

  const stepMeta = STEP_META.find(s => s.key === step)!
  const stepDesc = isMulti && stepMeta.descMulti ? stepMeta.descMulti : stepMeta.desc
  /**
   * ProgressPips 점 개수/위치 — 경기마다 (score, pick) 2단계 + 마지막 confirm 1단계(feature-spec
   * §9.2). 단일 경기 세션(pending.length 1, edit 포함)에서는 3(=STEP_META.length)이라 기존과 같다.
   */
  const totalSteps = pending.length * 2 + 1
  const currentStepIndex = flowPipIndex({ step, matchCursor, returnToConfirm }, pending.length)
  /** score 단계의 진짜 첫 화면 — "이전"이 없어 뒤로가기 히스토리 가드(popstate)만 이탈을 처리한다. */
  const isVeryFirstStep = isFirstFlowStep({ step, matchCursor, returnToConfirm })
  /**
   * "이전" — 고정 순서 a-b-a-b-c를 대칭으로 되돌린다(feature-spec §9.2). pick에서는 같은 경기의
   * score로, score에서는(첫 경기가 아니면) 이전 경기의 pick으로. confirm에서 온 왕복 중이면 다른
   * 경기로 새지 않고 곧장 confirm으로 취소한다. 단일 경기 세션(matchCursor 항상 0)에서는 기존과
   * 동일하게 score↔pick↔confirm만 오간다.
   */
  function goPrev() {
    applyCursor(computePrevStep({ step, matchCursor, returnToConfirm }))
  }

  // 지금 보이는 경기의 픽 단계 남은 툰 — score/pick 단계가 항상 경기 하나만 보여주므로
  // (feature-spec §9.2, 경기별 BudgetBar 제거) 더블 매치위크에서도 이 하나로 충분하다.
  const currentSpent = currentMatch
    ? POSITIONS.reduce((sum, position) => sum + (picks[currentMatch.id]?.[position]?.cost ?? 0), 0)
    : 0

  // 푸터 좌측(데스크탑) / 카드 하단(모바일)에 붙는 상태. 픽=남은 툰, 확인=킥오프 전까지 수정 가능 안내.
  const statusNode =
    step === 'pick' ? (
      <ToonCounter remaining={BUDGET - currentSpent} total={BUDGET} />
    ) : step === 'confirm' ? (
      <span className="text-label-2 text-neutral-muted">킥오프 전까지 다시 수정할 수 있어요</span>
    ) : null

  /** 스텝별 다음/제출 버튼 — 데스크탑 푸터와 모바일 바 양쪽에서 같은 핸들러를 쓴다. */
  function primaryButton(className: string) {
    if (step === 'score') {
      return (
        <Button size="lg" className={className} disabled={!!scoreRangeError} onClick={() => completeStep('score', 'pick')}>
          다음
        </Button>
      )
    }
    if (step === 'pick') {
      return (
        <Button size="lg" className={className} disabled={!currentMatchPicked} onClick={goNextFromPick}>
          다음
        </Button>
      )
    }
    return (
      <Button
        size="lg"
        className={className}
        // allPicked는 이제 각 경기 pick 단계의 "다음"이 이미 보장하는 조건이지만, 제출 버튼에도
        // 최종 안전망으로 남겨둔다(고정 순서를 우회해 confirm에 직접 도달하는 경우를 방어).
        disabled={submitting || !!scoreRangeError || !allPicked}
        onClick={() => setSubmitConfirmOpen(true)}
      >
        {mode === 'edit' ? (submitting ? '수정 중…' : '수정하기') : submitting ? '제출 중…' : '제출하기'}
      </Button>
    )
  }

  /**
   * 스텝별 본문 — 데스크탑에서 세 스텝을 같은 그리드 칸에 겹쳐 쌓아 높이를 최대('확인')에 맞춘다.
   * score/pick은 pending.length와 무관하게 항상 matchCursor가 가리키는 경기 하나만 보여준다
   * (더블 매치위크의 경기별 스택·BudgetBar·"그대로 적용"은 feature-spec §9로 폐기됐다 — 대신
   * 고정 순서로 경기를 하나씩 돈다). confirm만 예전처럼 pending 전체를 한 화면에 모아 보여준다.
   */
  function stepBody(key: StepKey) {
    if (key === 'score') {
      if (!currentMatch) return null
      return (
        <div>
          <MatchMeta weekNo={week.weekNo} match={currentMatch} />
          <div className="mt-6 flex items-center justify-center gap-4 sm:gap-6">
            <TeamColumn logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
            <ScoreStepper
              value={scores[currentMatch.id]?.[0] ?? 0}
              onChange={delta => changeScore(currentMatch.id, 0, delta)}
            />
            <ScoreStepper
              value={scores[currentMatch.id]?.[1] ?? 0}
              onChange={delta => changeScore(currentMatch.id, 1, delta)}
            />
            <TeamColumn logoUrl={teamLogoUrl(currentMatch.opponentId)} name={currentMatch.opponent} />
          </div>
        </div>
      )
    }
    if (key === 'pick') {
      if (!currentMatch) return null
      return (
        <PositionRow
          picks={picks[currentMatch.id] ?? {}}
          onOpen={position => setPickTarget({ matchId: currentMatch.id, position })}
        />
      )
    }
    // confirm — 경기별로 결과/선수 요약 섹션. 선수 픽은 경기별 1세트라 경기 카드 안에 그대로 붙는다.
    return (
      <div className="flex flex-col gap-4">
        {pending.map((match, i) => (
          <div key={match.id} className={cn('flex flex-col gap-4', i > 0 && 'mt-2')}>
            {isMulti && <MatchLabel index={i} opponent={match.opponent} />}
            {/* 수정 링크는 그 경기로 커서를 옮기고 returnToConfirm을 켠 채 되돌아간다 — 이걸
                안 하면 "다음"이 나머지 경기를 다시 거치게 만드는 버그였다(코드리뷰 2026-09-05,
                flow-cursor.test.mjs의 REGRESSION 테스트 참고). */}
            <SummarySection
              title="나의 결과 예측"
              onEdit={() => applyCursor(startEditFromConfirm(i, 'score'))}
            >
              <div className="flex items-center justify-center gap-4 sm:gap-8">
                <ConfirmTeam logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
                <span className="text-title-2 font-semibold">
                  {scores[match.id]?.[0] ?? 0} – {scores[match.id]?.[1] ?? 0}
                </span>
                <ConfirmTeam logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
              </div>
            </SummarySection>
            <SummarySection
              title="나의 선수 예측"
              onEdit={() => applyCursor(startEditFromConfirm(i, 'pick'))}
            >
              <PositionRow
                picks={picks[match.id] ?? {}}
                onOpen={position => setPickTarget({ matchId: match.id, position })}
              />
            </SummarySection>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[860px] px-4 pb-28 pt-4 sm:px-6 sm:pb-12 sm:pt-8">
      <Card className="flex flex-col p-5 sm:p-7">
        {/* 헤더: 제목/설명(좌) + 진행 pill(우) */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-2 font-semibold text-neutral">{stepMeta.name}</h1>
            <p className="mt-1 text-label-2 text-neutral-muted">{stepDesc}</p>
          </div>
          <ProgressPips current={step} total={totalSteps} activeIndex={currentStepIndex} />
        </div>

        {/* 모바일 선수 예측: 남은 툰을 목록 위에 둔다 — 하단 고정 바에 가려지지 않게 목록을 맨 아래로.
            (데스크탑은 아래 푸터 좌측에 있어 영향 없음.) */}
        {step === 'pick' && statusNode && <div className="pt-4 sm:hidden">{statusNode}</div>}

        {/*
          본문 — score↔pick 전환(같은 경기 안에서 왔다갔다 하는, 가장 잦은 전환)만 같은 그리드
          칸에 겹쳐 쌓아 높이를 고정한다(비활성은 자리만 차지). confirm은 이 겹쳐-쌓기에서 뺐다
          — 더블 매치위크에서는 confirm이 경기 2개를 다 보여줘 훨씬 커지는데, 그걸 score/pick과
          같이 계속 그려두면 경기 하나만 보여줘야 할 score/pick 컨테이너까지 confirm 높이로
          고정돼버린다(코드리뷰 2026-09-04). confirm은 그냥 조건부로 그 내용만 렌더해
          자기 콘텐츠 크기대로 자연스럽게 커지게 둔다. 모바일은 원래도 활성 스텝만 그렸으니 영향 없음.
        */}
        {step === 'confirm' ? (
          <div className="flex flex-1 flex-col py-6 sm:py-8">
            <div className="w-full">{stepBody('confirm')}</div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col py-6 sm:grid sm:py-8">
            {(['score', 'pick'] as const).map(key => (
              <div
                key={key}
                aria-hidden={key !== step}
                className={cn(
                  'flex-col justify-center sm:col-start-1 sm:row-start-1',
                  key === step ? 'flex' : 'hidden sm:flex sm:invisible',
                )}
              >
                <div className="w-full">{stepBody(key)}</div>
              </div>
            ))}
          </div>
        )}

        {visibleError && (
          <p role="alert" className="mb-2 text-center text-label-2 font-medium text-critical">
            {visibleError}
          </p>
        )}

        {/* 모바일 상태 텍스트(확인 단계 안내) — 데스크탑은 아래 푸터 좌측에 있다.
            선수 예측 남은 툰은 위(목록 상단)로 옮겨서 여기선 확인 단계만 처리한다. */}
        {step === 'confirm' && statusNode && <div className="pb-1 sm:hidden">{statusNode}</div>}

        {/* 데스크탑 푸터: 구분선 + 상태(좌) + 이전/다음·제출(우). 상태 높이(남은 툰 2줄)가 스텝마다
            달라 컨테이너 높이가 흔들리던 문제 → 내부 행 높이를 고정(min-h)해 스텝 간 높이를 맞춘다. */}
        <div className="mt-6 hidden border-t border-neutral-weak pt-5 sm:block">
          <div className="flex min-h-[56px] items-center justify-between gap-4">
            <div>{statusNode}</div>
            <div className="flex gap-2">
              {!isVeryFirstStep && (
                <Button variant="ghost" size="lg" className="w-[100px]" onClick={goPrev}>
                  이전
                </Button>
              )}
              {primaryButton('w-[140px]')}
            </div>
          </div>
        </div>
      </Card>

      {/* 하단 제출 바는 투표 화면과 같은 StickyActionBar를 쓴다 — 데스크탑은 카드 푸터가 대신하므로
          sm:hidden으로 모바일 전용이다(fixed→static 전환 로직은 StickyActionBar가 소유). */}
      <StickyActionBar className="border-neutral-weak sm:hidden">
        <div className="mx-auto flex max-w-shell gap-2">
          {!isVeryFirstStep && (
            <Button variant="ghost" size="lg" className="flex-1" onClick={goPrev}>
              이전
            </Button>
          )}
          {primaryButton(!isVeryFirstStep ? 'flex-[2]' : 'w-full')}
        </div>
      </StickyActionBar>

      {/* 껍데기가 아니라 목록만 스크롤한다(타이틀·드래그 핸들 고정) — 세로 flex로 높이를 나눠주고
          스크롤은 PlayerPickContent 내부 목록이 맡는다. */}
      <Modal
        open={pickTarget !== null}
        onOpenChange={open => !open && setPickTarget(null)}
        className="flex max-h-[78vh] flex-col overflow-hidden sm:max-h-[80vh]"
      >
        <PlayerPickContent
          positionLabel={pickTarget ? POSITION_LABEL[pickTarget.position] : ''}
          players={pickTarget ? selectableCandidates[pickTarget.position] : []}
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
          title={mode === 'edit' ? '이대로 수정할까요?' : '이대로 제출할까요?'}
          // 승부예측은 제출 후에도 킥오프 전까지 자유 수정 가능하다 — ConfirmContent 기본 문구
          // ("제출 후에는 변경할 수 없습니다", 투표 도메인 기준)를 그대로 두면 모순이라 덮어쓴다.
          description="킥오프 전까지 다시 수정할 수 있어요"
          selectedLabel={`${pending.length}경기 예측`}
          summaryCaption="내 예측"
          confirmLabel={mode === 'edit' ? '수정하기' : undefined}
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

// 대회명 배지(TEA-30): 100단계 배경 + 800단계 텍스트, 3색 공통. 라운드 숫자는 평문.
function MatchMeta({ weekNo, match }: { weekNo: number; match: MatchView }) {
  const bucket = competitionColorBucket(match.competition)
  return (
    <div className="text-center">
      <p className="mb-1 text-label-2 font-medium text-neutral-muted">
        {match.competition && (
          <>
            <span className={cn(badgeVariants({ variant: 'bare' }), COMPETITION_BADGE[bucket])}>
              {match.competition}
            </span>{' '}
            ·{' '}
          </>
        )}
        {weekLabel(weekNo, '라운드')}
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

/** 확인 단계의 요약 섹션(흰 카드 안의 옅은 회색 패널 — bg-page) + 우측 "수정" 링크. */
function SummarySection({
  title,
  onEdit,
  children,
}: {
  title: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg bg-page p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-label-1-normal font-medium text-neutral-muted">{title}</span>
        <button type="button" onClick={onEdit} className="text-label-2 font-medium text-brand">
          수정
        </button>
      </div>
      {children}
    </div>
  )
}

/** 채운 선수 카드의 사진 — 1:1 고정 72×72 정사각 썸네일(카드 폭이 넓어져도 늘어나지 않게). */
function PlayerThumb({ url }: { url: string | null }) {
  return (
    <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-md">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover object-top" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-disabled text-neutral-subtle">
          <Silhouette />
        </div>
      )}
    </div>
  )
}

/** 남은 툰 카운터 — 숫자(남은/총) 위, "남은 툰" + 도움말 아래(2줄). BudgetBar 대신 단일 경기 픽에서 쓴다. */
function ToonCounter({ remaining, total }: { remaining: number; total: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-1">
        <span className="text-title-3 font-semibold text-neutral">{remaining}</span>
        <span className="text-label-1-normal text-neutral-subtle">/{total}</span>
      </div>
      <div className="flex items-center gap-1 text-label-2 text-neutral-muted">
        <CircleHelp size={14} aria-hidden className="text-neutral-subtle" />
        <span>남은 툰</span>
      </div>
    </div>
  )
}

/**
 * 포지션 3장 — 빈 카드(옅은 회색 bg-page + 우측 원형 아바타) / 채운 카드(흰색 bg-surface + 72 썸네일).
 * 상단 영역 높이(h-20)와 하단 줄 높이(h-7)를 두 상태에서 고정해, 선택 여부로 카드 높이가 튀지 않게 한다.
 */
function PositionRow({
  picks,
  onOpen,
}: {
  /** 경기 하나의 픽 — 상위에서 picks[matchId]를 넘긴다 */
  picks: Partial<Record<Position, Candidate>>
  onOpen: (position: Position) => void
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
      {POSITIONS.map(position => {
        const picked = picks[position]
        return (
          <button
            key={position}
            type="button"
            onClick={() => onOpen(position)}
            className={cn(
              'flex min-h-[150px] min-w-0 flex-1 flex-col rounded-lg border border-neutral-weak p-4 text-left transition-colors duration-micro hover:border-neutral-strong',
              picked ? 'bg-surface' : 'bg-page',
            )}
          >
            <span className="text-label-2 font-medium text-neutral-muted">{POSITION_LABEL[position]}</span>
            {/* 상단 영역: 우측 세로중앙. 채운: 72 정사각 썸네일 / 빈: 72 원형 아바타 */}
            <div className="flex h-20 items-center justify-end pr-[6%]">
              {picked ? <PlayerThumb url={picked.photoUrl} /> : <PlayerPhoto url={null} size={72} />}
            </div>
            <div className="h-px bg-neutral-weak" />
            <div className="mt-3 flex h-7 items-center justify-between gap-2">
              {picked ? (
                <>
                  <span className="min-w-0 truncate text-label-1-normal font-semibold">{picked.name}</span>
                  <ToonCost cost={picked.cost} className="shrink-0" />
                </>
              ) : (
                <span className="text-label-2 text-neutral-muted">선수를 선택하세요</span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
