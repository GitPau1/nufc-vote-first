'use client'

import { useEffect, useState } from 'react'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { Card } from '@/components/primitives/card'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/primitives/accordion'
import { PlayerPhoto, ShareButton, TeamBadge } from './shared'
import { WeekRankCard } from './WeekRankCard'
import { POSITIONS, POSITION_LABEL, playerPhotoUrl, type Position } from '@/lib/predictions/candidates'
import {
  aggregateWeekResult,
  matchHit,
  matchResultState,
  ourScoreOrder,
  ratingTier,
  type MatchHit,
  type MatchResultState,
  type RatingTier,
} from '@/lib/predictions/result'
import { NUFC_LABEL, NUFC_TEAM_ID, teamLogoUrl, type MatchView, type WeekSession } from '@/lib/predictions/week'
import type { MyPredictionMap, MyResult, MyResultMap, RankingRow } from '@/lib/queries/predictions'
import type { PickCandidates } from '@/lib/queries/squads'
import { cn } from '@/lib/utils'
import { badgeVariants } from '@/components/primitives/badge'

/**
 * 주차 결과 화면(퍼블리싱 `renderResult`). "판정 퍼스트" 단일 스크롤(2026-09-01 개편) —
 * ① 판정 헤드라인(맞았는지부터) → ② 경기별 비교(근거) → ③ 내 선수 픽(디테일) →
 * ④ 피날레(등수+주차 랭킹, 사회적 비교) → ⑤ 공유. 모바일·데스크탑 동일 구성, 탭/토글 없음 —
 * 과거 "첫 진입 기본 탭은 전체 결과(점수 먼저)" 확정을 이 순서가 대체한다.
 *
 * 랭킹은 참여 여부와 무관하게 공개된다 — 예측하지 않은 주차도 이 화면으로 들어와 "미참여" 안내와
 * 랭킹을 볼 수 있다(퍼블리싱 `buildLeaderboardNoParticipation`). 채점 단위는 경기지만 등수는
 * 주차 단위 하나뿐이라, 더블 매치위크는 두 경기 점수를 합산한다.
 */
export function PredictionResult({
  week,
  results,
  predictions,
  candidates,
  ranking,
}: {
  week: WeekSession
  /** fixture_id → 채점 결과 */
  results: MyResultMap
  /** fixture_id → 내 제출 내역 — 배당(제출 시점 스냅샷)은 여기서만 온다 */
  predictions: MyPredictionMap
  candidates: PickCandidates
  ranking: RankingRow[]
}) {
  const summary = aggregateWeekResult(week, results, ranking)
  const participated = summary !== null

  // 재방문 트리거 퍼널(제출 → 경기 종료 후 결과 확인)의 도착 지점. 원페이저가 건 가설
  // "경기 일정이 재방문 캘린더 역할을 한다"를 직접 검증하는 이벤트라, 제출과 같은 week_key로
  // 묶어서 본다. 재방문 자체가 신호이므로 중복 조회를 일부러 걸러내지 않는다.
  useEffect(() => {
    trackEvent('prediction_result_viewed', {
      week_key: week.weekKey,
      participated,
      rank: summary?.rank ?? null,
      total_points: summary?.totalPoints ?? null,
      total_entries: ranking.length,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.weekKey])

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4 px-4 pb-16 pt-4 sm:max-w-[709px] sm:px-6 sm:pt-8">
      <VerdictHeadline week={week} results={results} />

      {week.matches.map((match, i) => (
        <div key={match.id} className="flex flex-col gap-3">
          {week.matches.length > 1 && (
            <p className="text-label-2 font-medium text-neutral-muted">
              경기 {i + 1} · {NUFC_LABEL} vs {match.opponent}
            </p>
          )}
          <MatchResultBlock
            match={match}
            state={matchResultState(match, results)}
            predictions={predictions}
            candidates={candidates}
          />
        </div>
      ))}

      <Finale week={week} summary={summary} ranking={ranking} />

      {participated && (
        <div className="flex justify-center">
          <ShareButton />
        </div>
      )}
    </div>
  )
}

/** 판정 헤드라인 계산에 쓰는 경기 하나치 결과 — 채점 완료 + 실제 스코어가 있어야 판정 가능하다. */
type MatchVerdict = {
  match: MatchView
  hit: MatchHit
  predictedOurs: [number, number]
  actual: [number, number]
}

/**
 * 판정 가능한(채점 완료 + 실제 스코어 존재) 경기만 골라낸다. 더블 매치위크에서 한 경기가 아직
 * 안 끝났으면 그 경기는 판정에서 빠지고, 끝난 경기만으로 헤드라인을 만든다 — 즉 "단일 경기
 * 카피"의 적용 조건은 "주차에 경기가 1개"가 아니라 "판정 가능한 경기가 1개"다.
 */
function resolveVerdicts(week: WeekSession, results: MyResultMap): MatchVerdict[] {
  return week.matches.flatMap(match => {
    const state = matchResultState(match, results)
    if (state.kind !== 'scored' || !match.actual) return []
    const predictedOurs = ourScoreOrder(state.result.predicted, match.isHome)
    return [{ match, hit: matchHit(predictedOurs, match.actual), predictedOurs, actual: match.actual }]
  })
}

type VerdictCopy = {
  headline: React.ReactNode
  subline: string | null
}

/** 판정 가능한 경기 하나에 대한 헤드라인/서브라인(design-brief 4번 A안, plan.md 0번 9-1 확정). */
function singleMatchVerdictCopy(verdict: MatchVerdict): VerdictCopy {
  const [ourScore, theirScore] = verdict.actual
  const scoreLabel = `${ourScore}–${theirScore}`

  if (verdict.hit === 'exact') {
    return {
      headline: (
        <>
          스코어 <span className="text-on-solid-brand">정확히 적중!</span>
        </>
      ),
      subline: `${verdict.match.opponent}전 ${scoreLabel}, 내 예측 그대로였어요`,
    }
  }

  if (verdict.hit === 'miss') {
    return {
      headline: '이번엔 예측이 빗나갔어요',
      subline: `${verdict.match.opponent}전 ${scoreLabel}, 내 예측과는 달랐어요`,
    }
  }

  // outcome — 승/무/패 중 어느 결과를 맞혔는지에 따라 서브라인 한 단어만 바뀐다. 9-1 확정은
  // "승리"/"무승부" 두 경우만 다뤘고, "패배"는 같은 자리에 결과 단어를 넣는 자연스러운 확장이다
  // (Math.sign 부호 3가지 중 나머지 하나 — matchHit 자체가 승/무/패를 대칭으로 다룬다).
  const [predictedOurs, predictedTheirs] = verdict.predictedOurs
  const outcomeWord =
    predictedOurs === predictedTheirs ? '무승부' : predictedOurs > predictedTheirs ? '승리' : '패배'
  return {
    headline: '승부는 적중, 스코어는 아쉬웠어요',
    subline: `${verdict.match.opponent}전 ${scoreLabel}, ${outcomeWord}는 맞혔지만 스코어는 달랐어요`,
  }
}

/**
 * 더블 매치위크(판정 가능한 경기 2개 이상)의 헤드라인/서브라인. 서브라인은 9-1이 confirm한
 * "Wolves전은 적중, Villa전은 빗나갔어요" 패턴을 전적중/전빗나감까지 그대로 확장한다 —
 * 새 문장 구조를 만들지 않고 같은 틀에 결과 단어만 바꿔 넣는다.
 */
function multiMatchVerdictCopy(verdicts: MatchVerdict[]): VerdictCopy {
  const hitCount = verdicts.filter(v => v.hit !== 'miss').length
  const subline = verdicts
    .map(v => `${v.match.opponent}전은 ${v.hit === 'miss' ? '빗나갔어요' : '적중'}`)
    .join(', ')

  if (hitCount === verdicts.length) return { headline: '두 경기 모두 적중!', subline }
  if (hitCount === 0) return { headline: '이번 주는 두 경기 모두 빗나갔어요', subline }
  return { headline: '2경기 중 1경기 적중!', subline }
}

/** 판정 헤드라인 전체 카피 — 판정 가능한 경기 수에 따라 미참여/단일/더블 분기로 나뉜다. */
function verdictCopy(verdicts: MatchVerdict[]): VerdictCopy {
  if (verdicts.length === 0) {
    // 미참여, 그리고 "제출은 했지만 아직 채점된 경기가 하나도 없음" 둘 다 판정할 재료가 없다는
    // 점에서 같다 — design-brief가 이미 확정한 대로 미참여 문구를 그대로 덮는다.
    return { headline: '이 기간에는 예측에 참여하지 않았어요', subline: null }
  }
  if (verdicts.length === 1) return singleMatchVerdictCopy(verdicts[0])
  return multiMatchVerdictCopy(verdicts)
}

/** ① 판정 헤드라인 — 다크 카드, 진입 즉시 "맞았는지"부터 보여준다(intent.md 목표). */
function VerdictHeadline({ week, results }: { week: WeekSession; results: MyResultMap }) {
  const { headline, subline } = verdictCopy(resolveVerdicts(week, results))

  return (
    <div className="spotlight-glow-brand-strong rounded-lg px-4 pb-5 pt-4 text-center">
      <p className="text-caption-1 text-on-solid-muted">{week.weekNo}주차 결과</p>
      <p className="mt-1.5 text-title-2 font-semibold text-on-solid">{headline}</p>
      {subline && <p className="mt-1 text-label-2 text-on-solid-muted">{subline}</p>}
    </div>
  )
}

/** 총점만 0에서 굴려 올린다(퍼블리싱 `animateCountUp`). 서버 렌더와 첫 페인트는 0이라 불일치가 없다. */
function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === 0) return
    const start = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min(1, (now - start) / durationMs)
      setValue(Math.round(target * progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs])

  return value
}

/**
 * ④ 피날레 — 사회적 비교의 클라이맥스(design-brief). 총점 카운트업 → 등수 → 스트립 →
 * 주차 랭킹을 다크 카드 하나에 통합한다. 랭킹은 참여 여부와 무관하게 공개되므로 `summary`가
 * 없어도(미참여) `WeekRankCard`는 그대로 보여주고, 개인 등수·스트립만 생략한다.
 */
function Finale({
  week,
  summary,
  ranking,
}: {
  week: WeekSession
  summary: ReturnType<typeof aggregateWeekResult>
  ranking: RankingRow[]
}) {
  const total = useCountUp(summary?.totalPoints ?? 0)

  return (
    <div className="spotlight-glow-brand-strong rounded-lg px-4 pb-5 pt-4">
      {summary && (
        <div className="text-center">
          <p className="text-caption-1 text-on-solid-muted">이번 주 순위</p>
          {/* 등수는 랭킹 집계가 끝나야 나온다 — 아직이면 "등수 집계 중"으로 자리를 지킨다. */}
          <p className="mt-1 text-title-2 font-semibold text-on-solid">
            {summary.rank === null ? '등수 집계 중' : `${summary.rank}위`}
            {summary.rank !== null && (
              <span className="ml-1.5 text-label-2 font-normal text-on-solid-muted">
                / {summary.totalEntries}명
              </span>
            )}
          </p>

          <div className="mx-auto mt-4 flex max-w-[320px] justify-center gap-5 rounded-md bg-on-solid-strong px-4 py-3.5">
            <FinaleStat label="경기예측" value={`${summary.matchPoints}점`} />
            <FinaleStat label="선수픽" value={`${summary.pickPoints}점`} />
            <FinaleStat label="총점" value={`${total}점`} />
          </div>
        </div>
      )}

      <div className={cn('text-left', summary && 'mt-5')}>
        <WeekRankCard weekNo={week.weekNo} entries={ranking} />
      </div>
    </div>
  )
}

function FinaleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-caption-1 text-on-solid-muted">{label}</p>
      <p className="mt-0.5 text-label-1-normal font-medium text-on-solid">{value}</p>
    </div>
  )
}

/** 경기 하나 — ② 경기별 비교(근거) + ③ 내 선수 픽(디테일), 카드 두 장. */
function MatchResultBlock({
  match,
  state,
  predictions,
  candidates,
}: {
  match: MatchView
  state: MatchResultState
  predictions: MyPredictionMap
  candidates: PickCandidates
}) {
  if (state.kind === 'pending') {
    return (
      <Card className="p-5 text-left">
        <p className="mb-3 text-body-2-normal font-semibold">경기 예측</p>
        <div className="rounded-md bg-page px-4 py-6 text-center">
          <p className="text-label-1-normal text-neutral-muted">
            {match.kickoff} {match.kickoffTime} 예정 · 아직 시작하지 않은 경기예요
          </p>
        </div>
      </Card>
    )
  }

  const scored = state.kind === 'scored' ? state.result : null

  return (
    <>
      {/* ② 경기별 비교 — 헤더 배지(+N점) 하나로만 점수를 말한다. 내 예측 행에는 점수 텍스트를
          넣지 않는다(intent.md). 크레스트 행 + 내 예측/실제 결과 2행 비교(시안 `.cmp` 구조). */}
      <Card className="p-5 text-left">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-body-2-normal font-semibold">경기 예측</span>
          <PointsBadge matchPoints={scored?.matchPoints ?? null} />
        </div>

        <div className="flex items-center gap-2 px-2">
          <span aria-hidden className={SCORE_LABEL_CELL_CLASS} />
          <MatchupTeam logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
          <span aria-hidden className={SCORE_DIVIDER_CELL_CLASS} />
          <MatchupTeam logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
        </div>

        <ScoreCompareRow
          label="내 예측"
          score={scored ? ourScoreOrder(scored.predicted, match.isHome) : null}
          fallback="–"
        />
        <ScoreCompareRow
          label="실제 결과"
          score={match.actual}
          fallback="스코어 집계 중"
          className="rounded-md bg-page"
        />
      </Card>

      {/* ③ 내 선수 픽 — 헤더에 합산 점수 배지. 모바일은 세로 행 리스트, 데스크탑은 포지션 카드
          3장(퍼블리싱과 동일). TOP3는 이슈 2가 데이터를 꽂을 자리라 지금은 항상 null. */}
      <Card className="p-5 text-left">
        <div className="mb-3.5 flex items-center justify-between">
          <span className="text-body-2-normal font-semibold">내 선수 픽</span>
          <PickPointsBadge pickPoints={scored?.pickPoints ?? null} />
        </div>
        <div className="overflow-hidden rounded-lg sm:hidden">
          {POSITIONS.map(position => (
            <PickResultRow
              key={position}
              position={position}
              pick={resolvePick(position, match, scored, predictions, candidates)}
              top3={null}
            />
          ))}
        </div>
        <div className="hidden sm:flex sm:gap-3">
          {POSITIONS.map(position => (
            <PickResultCard
              key={position}
              position={position}
              pick={resolvePick(position, match, scored, predictions, candidates)}
              top3={null}
            />
          ))}
        </div>
      </Card>
    </>
  )
}

/** 결과 화면이 그리는 픽 하나. 참여하지 않은 경기는 null. */
type ResolvedPick = {
  name: string | null
  photoUrl: string | null
  multiplier: number | null
  rating: number | null
  points: number
} | null

/**
 * 픽 표시에 필요한 값이 세 곳에 흩어져 있다: 점수·평점은 채점 결과(view), 배당은 제출 스냅샷(predictions),
 * 이름·사진은 픽 후보 목록. 스쿼드에서 빠진 선수는 이름을 알 수 없어도 점수는 그대로 보여준다.
 */
function resolvePick(
  position: Position,
  match: MatchView,
  scored: MyResult | null,
  predictions: MyPredictionMap,
  candidates: PickCandidates,
): ResolvedPick {
  if (!scored) return null

  const { playerId, rating, points } = scored.picks[position]
  const found = candidates[position].find(candidate => candidate.id === playerId)
  return {
    name: found?.name ?? null,
    photoUrl: found?.photoUrl ?? playerPhotoUrl(playerId),
    multiplier: predictions[match.id]?.picks[position]?.multiplier ?? null,
    rating,
    points,
  }
}

/**
 * 포지션 평점 TOP3 한 줄 — 이슈 2(포지션별 평점 TOP3 데이터)가 채울 인터페이스다. 전체 후보
 * 평점을 조회할 방법이 아직 쿼리 계층에 없어(candidates.ts에 rating 필드 자체가 없음) 지금은
 * 항상 `null`로 넘긴다 — `null`이면 아코디언 트리거 자체를 렌더하지 않는다(RatingBadge가
 * rating===null이면 배지를 아예 안 그리는 것과 같은 관례).
 */
type Top3Entry = {
  playerId: number
  name: string
  photoUrl: string | null
  rating: number
  isMine: boolean
}

const TIER_BADGE: Record<RatingTier, string> = {
  good: 'bg-positive-weak text-positive',
  mid: 'bg-warning-weak text-warning',
  bad: 'bg-critical-weak text-critical',
}

/** 평점 배지 — 픽 점수가 붙는 7.0 기준으로 색이 갈린다. 평점이 없으면(미출전/미집계) 표시하지 않는다. */
function RatingBadge({ rating }: { rating: number | null }) {
  const tier = ratingTier(rating)
  if (tier === null || rating === null) return null
  return (
    <span className={cn(badgeVariants({ variant: 'bare' }), TIER_BADGE[tier])}>
      {rating.toFixed(1)}
    </span>
  )
}

/** 경기 예측 적중 배지 — 정확히 맞히면 3점, 승패무만 맞히면 2점, 아니면 0점(DB `prediction_match_points`). */
function PointsBadge({ matchPoints }: { matchPoints: number | null }) {
  const style =
    matchPoints === null
      ? 'bg-disabled text-neutral-muted'
      : matchPoints > 0
        ? 'bg-positive-weak text-positive'
        : 'bg-critical-weak text-critical'
  const label = matchPoints === null ? '미참여' : matchPoints > 0 ? `+${matchPoints}점` : '0점'

  return (
    <span className={cn(badgeVariants({ variant: 'bare' }), style)}>
      {label}
    </span>
  )
}

/** 선수 픽 합산 점수 배지 — 경기 예측 배지(PointsBadge)와 같은 3단계 톤(양수/0점/미참여)을 쓴다. */
function PickPointsBadge({ pickPoints }: { pickPoints: number | null }) {
  const style =
    pickPoints === null
      ? 'bg-disabled text-neutral-muted'
      : pickPoints > 0
        ? 'bg-positive-weak text-positive'
        : 'bg-critical-weak text-critical'
  const label = pickPoints === null ? '미참여' : pickPoints > 0 ? `+${pickPoints}점` : '0점'

  return (
    <span className={cn(badgeVariants({ variant: 'bare' }), style)}>
      {label}
    </span>
  )
}

/**
 * 스코어보드의 열 폭 — 팀 축(헤더)과 스코어 행이 **같은 상수**를 참조해야 숫자가 세로로 맞물린다.
 * 한쪽만 고치면 정렬이 조용히 어긋나므로 리터럴을 양쪽에 복제하지 마라.
 */
const SCORE_LABEL_CELL_CLASS = 'w-16 shrink-0 sm:w-24'
const SCORE_DIVIDER_CELL_CLASS = 'w-4 shrink-0'
/** 숫자 한 칸 — 팀 축 칸과 같은 flex-1이라 팀과 스코어가 한 열로 읽힌다. */
const SCORE_CELL_CLASS = 'min-w-0 flex-1 text-center text-heading-1 font-semibold text-neutral'

/**
 * 스코어보드 한 행 — 왼쪽 라벨 + 팀별 숫자 두 칸. 적중 배지는 이제 블록 헤더로 옮겨서
 * 이 행에는 없다(점수는 헤더 한 곳에만, intent.md). 값이 없으면 숫자 칸 자리를 `fallback`이
 * 대신한다.
 */
function ScoreCompareRow({
  label,
  score,
  fallback,
  className,
}: {
  label: string
  score: [number, number] | null
  fallback: string
  className?: string
}) {
  return (
    <div className={cn('mt-2 flex items-center gap-2 px-2 py-2', className)}>
      <p className={cn(SCORE_LABEL_CELL_CLASS, 'break-keep text-caption-1 text-neutral-muted')}>{label}</p>
      {score ? (
        <>
          <span className={SCORE_CELL_CLASS}>{score[0]}</span>
          <span
            aria-hidden
            className={cn(SCORE_DIVIDER_CELL_CLASS, 'text-center text-body-2-normal text-neutral-subtle')}
          >
            –
          </span>
          <span className={SCORE_CELL_CLASS}>{score[1]}</span>
        </>
      ) : (
        <p className="min-w-0 flex-1 text-center text-label-1-normal font-medium text-neutral-muted">
          {fallback}
        </p>
      )}
    </div>
  )
}

/** TOP3 아코디언 한 줄 — 순위·사진·이름·평점 배지. 내가 고른 선수 행만 강조한다. */
function Top3Row({ entry, rank }: { entry: Top3Entry; rank: number }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md bg-page px-2.5 py-2',
        entry.isMine && 'bg-brand-weak',
      )}
    >
      <span
        className={cn(
          'w-7 shrink-0 text-caption-1 text-neutral-muted',
          entry.isMine && 'font-semibold text-brand',
        )}
      >
        {rank}위
      </span>
      <PlayerPhoto url={entry.photoUrl} size={28} />
      <span className={cn('min-w-0 flex-1 truncate text-label-2', entry.isMine && 'font-semibold')}>
        {entry.name}
      </span>
      <RatingBadge rating={entry.rating} />
    </div>
  )
}

function PickResultRow({
  position,
  pick,
  top3,
}: {
  position: Position
  pick: ResolvedPick
  top3: Top3Entry[] | null
}) {
  const row = (
    <>
      <PlayerPhoto url={pick?.photoUrl ?? null} size={48} />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
        <p className={cn('truncate text-label-1-normal font-medium', !pick && 'text-neutral-muted')}>
          {pick ? pick.name ?? '선수 정보 없음' : '선택하지 않았어요'}
        </p>
        {pick && <RatingBadge rating={pick.rating} />}
      </div>
      {pick && <span className="shrink-0 text-body-2-normal font-semibold text-brand">{pick.points}점</span>}
    </>
  )

  // TOP3 데이터가 없으면(이슈 2 착수 전) 트리거 자체를 만들지 않는다 — chevron도 없이 기존과
  // 같은 정적인 행 하나로 끝난다.
  if (!top3 || top3.length === 0) {
    return (
      <div className="border-b border-neutral-weak p-3 last:border-b-0">
        <p className="mb-2 text-caption-1 font-medium text-neutral-muted">{POSITION_LABEL[position]}</p>
        <div className="flex items-center gap-2.5">{row}</div>
      </div>
    )
  }

  // 행 전체가 트리거다(design-brief 6번 — 모바일은 행 탭으로 TOP3가 그 자리에서 펼쳐진다).
  return (
    <Accordion type="single" collapsible className="border-b border-neutral-weak last:border-b-0">
      <AccordionItem value={position} className="rounded-none border-0 bg-transparent">
        <AccordionTrigger className="items-center p-3 hover:opacity-100">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2 text-left">
            <p className="text-caption-1 font-medium text-neutral-muted">{POSITION_LABEL[position]}</p>
            <div className="flex w-full items-center gap-2.5">{row}</div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-1.5">
            {top3.map((entry, i) => (
              <Top3Row key={entry.playerId} entry={entry} rank={i + 1} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function PickResultCard({
  position,
  pick,
  top3,
}: {
  position: Position
  pick: ResolvedPick
  top3: Top3Entry[] | null
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex min-h-[196px] flex-col rounded-lg border border-neutral-weak bg-surface p-3">
        <span className="text-caption-1 font-medium text-neutral-muted">{POSITION_LABEL[position]}</span>
        <div className="my-2 h-px bg-neutral-weak" />
        {pick ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-1">
            <PlayerPhoto url={pick.photoUrl} />
            <p className="mt-0.5 text-center text-label-2 font-medium">{pick.name ?? '선수 정보 없음'}</p>
            <RatingBadge rating={pick.rating} />
            <div className="my-1.5 h-px w-8 bg-neutral-weak" />
            <span className="text-caption-1 font-medium text-brand">{pick.points}점</span>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            {/* 손으로 조립한 실루엣 원 대신 PlayerPhoto의 폴백을 그대로 쓴다 — 폴백 톤이 한 곳에서만 정해진다. */}
            <PlayerPhoto url={null} size={40} />
            <span className="text-center text-caption-2 font-medium text-neutral-muted">
              선택하지
              <br />
              않았어요
            </span>
          </div>
        )}
      </div>

      {/* TOP3 데이터가 없으면(이슈 2 착수 전) 아코디언 자체를 만들지 않는다. */}
      {top3 && top3.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value={position} className="rounded-md border-neutral-weak bg-page">
            <AccordionTrigger className="p-2.5 text-caption-1 font-medium text-neutral-muted hover:opacity-100">
              포지션 평점 TOP3
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-1.5">
                {top3.map((entry, i) => (
                  <Top3Row key={entry.playerId} entry={entry} rank={i + 1} />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  )
}

/** 스코어보드 팀 축 한 칸 — 아래 스코어 칸과 같은 폭(flex-1)이라 팀과 숫자가 한 열로 읽힌다. */
function MatchupTeam({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      <TeamBadge logoUrl={logoUrl} name={name} />
      {/* 모바일에서 칸이 좁아 접힐 수 있다 — 자르지 않고 어절 단위로 줄바꿈한다(라벨 칸과 같은 규칙). */}
      <span className="break-keep text-center text-label-2 font-medium text-neutral-muted">{name}</span>
    </div>
  )
}
