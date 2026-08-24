'use client'

import { useEffect, useState } from 'react'
import { useLoadingRouter } from '@/components/primitives/navigation-loading'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { PlayerPhoto, ShareButton, TeamBadge } from './shared'
import { WeekRankCard } from './WeekRankCard'
import { POSITIONS, POSITION_LABEL, playerPhotoUrl, type Position } from '@/lib/predictions/candidates'
import {
  aggregateWeekResult,
  matchResultState,
  ourScoreOrder,
  ratingTier,
  type MatchResultState,
  type RatingTier,
} from '@/lib/predictions/result'
import { NUFC_LABEL, NUFC_TEAM_ID, teamLogoUrl, type MatchView, type WeekSession } from '@/lib/predictions/week'
import type { MyPredictionMap, MyResult, MyResultMap, RankingRow } from '@/lib/queries/predictions'
import type { PickCandidates } from '@/lib/queries/squads'
import { cn } from '@/lib/utils'

/**
 * 주차 결과 화면(퍼블리싱 `renderResult`). 히어로(등수·점수) → 내 예측(경기별 비교 + 선수 픽) → 주차 랭킹.
 * 모바일은 "내 예측 / 전체 결과" 세그먼트로 둘 중 하나만, 데스크탑은 세로로 둘 다 보여준다.
 *
 * 랭킹은 참여 여부와 무관하게 공개된다 — 예측하지 않은 주차도 이 화면으로 들어와 "미참여" 안내와
 * 랭킹을 볼 수 있다(퍼블리싱 `buildLeaderboardNoParticipation`).
 * 채점 단위는 경기지만 등수는 주차 단위 하나뿐이라, 더블 매치위크는 두 경기 점수를 합산한다.
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
  const router = useLoadingRouter()
  const [tab, setTab] = useState<'mine' | 'rank'>('mine')
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
    <div className="mx-auto max-w-[560px] px-4 pb-16 pt-4 sm:max-w-content sm:px-10 sm:pt-6">
      <button
        type="button"
        onClick={() => router.push('/predictions')}
        className="hidden text-label-1-normal font-bold text-neutral-muted sm:mb-7 sm:inline-flex sm:items-center sm:gap-1.5"
      >
        ‹ 목록으로
      </button>

      <div className="mx-auto sm:max-w-[709px]">
        <Hero weekNo={week.weekNo} summary={summary} />

        {/* 모바일 전용 토글 — 데스크탑은 두 섹션을 세로로 다 보여준다 */}
        <div className="mb-5 flex gap-0.5 rounded-pill bg-disabled p-[3px] sm:hidden">
          <SegmentButton active={tab === 'mine'} onClick={() => setTab('mine')}>
            내 예측
          </SegmentButton>
          <SegmentButton active={tab === 'rank'} onClick={() => setTab('rank')}>
            전체 결과
          </SegmentButton>
        </div>

        <div className={cn(tab === 'mine' ? 'block' : 'hidden', 'sm:block')}>
          {week.matches.map((match, i) => (
            <div key={match.id}>
              {week.matches.length > 1 && (
                <p className={cn('mb-2 text-label-2 font-extrabold text-neutral-muted', i > 0 && 'mt-5')}>
                  경기 {i + 1} · {NUFC_LABEL} vs {match.opponent}
                </p>
              )}
              <div className="animate-enter rounded-lg border border-neutral-weak bg-surface px-4 py-5 text-left">
                <MatchResultBlock
                  match={match}
                  state={matchResultState(match, results)}
                  predictions={predictions}
                  candidates={candidates}
                />
              </div>
            </div>
          ))}

          {participated && (
            <div className="mt-7 flex justify-center">
              <ShareButton />
            </div>
          )}
        </div>

        <div className={cn(tab === 'rank' ? 'block' : 'hidden', 'sm:mt-6 sm:block')}>
          {/* 모바일은 화면 높이만큼만 노출하고, 데스크탑은 10명까지만 그린 뒤 "전체보기"로 펼친다 */}
          <WeekRankCard weekNo={week.weekNo} entries={ranking} className="sm:hidden" />
          <WeekRankCard weekNo={week.weekNo} entries={ranking} capped className="hidden sm:block" />
        </div>
      </div>
    </div>
  )
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex-1 rounded-pill px-1 py-2.5 text-label-2 font-bold transition-colors duration-micro',
        active ? 'bg-brand-solid text-on-solid' : 'text-neutral-muted',
      )}
    >
      {children}
    </button>
  )
}

/** 다크 히어로 — 주차 등수와 점수 구성. 미참여 주차는 안내 문구만. */
function Hero({
  weekNo,
  summary,
}: {
  weekNo: number
  summary: ReturnType<typeof aggregateWeekResult>
}) {
  const total = useCountUp(summary?.totalPoints ?? 0)

  if (!summary) {
    return (
      <div className="mb-4 rounded-lg bg-neutral-strong px-4 py-5 text-center">
        <p className="text-caption-1 text-on-solid-muted">{weekNo}주차 결과</p>
        <p className="mt-2.5 text-label-1-normal font-extrabold text-on-solid">
          이 기간에는 예측에 참여하지 않았어요
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-lg bg-neutral-strong px-4 py-5 text-center">
      <p className="text-caption-1 text-on-solid-muted">{weekNo}주차 결과</p>
      <p className="mt-1.5 flex items-baseline justify-center gap-1.5">
        {/* 등수는 랭킹 집계가 끝나야 나온다 — 아직이면 순위 자리를 비워두고 점수만 보여준다 */}
        <span className="text-title-2 font-black text-on-solid">
          {summary.rank === null ? '집계 중' : `${summary.rank}위`}
        </span>
        {summary.rank !== null && (
          <span className="text-label-2 text-on-solid-muted">/ {summary.totalEntries}명</span>
        )}
      </p>

      <div className="mt-4 flex justify-center gap-5 rounded-md bg-on-solid-strong px-4 py-3.5">
        <HeroStat label="경기예측" value={`${summary.matchPoints}점`} />
        <HeroStat label="선수픽" value={`${summary.pickPoints}점`} />
        <HeroStat label="총점" value={`${total}점`} />
      </div>
    </div>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-caption-1 text-on-solid-muted">{label}</p>
      <p className="mt-1 text-label-1-normal font-extrabold text-on-solid">{value}</p>
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

/** 경기 하나 — 예측 vs 실제 결과, 그리고 그 경기의 선수 픽 성적. */
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
      <>
        <p className="mb-2.5 text-body-2-normal font-bold">경기 예측</p>
        <div className="px-4 pb-4 pt-5 text-center">
          <p className="text-label-1-normal text-neutral-muted">
            {match.kickoff} {match.kickoffTime} 예정 · 아직 시작하지 않은 경기예요
          </p>
        </div>
      </>
    )
  }

  const scored = state.kind === 'scored' ? state.result : null

  return (
    <>
      <p className="mb-2.5 text-body-2-normal font-bold">경기 예측</p>
      <div className="px-4 pb-4 pt-5 text-center">
        <PointsBadge matchPoints={scored?.matchPoints ?? null} />

        <div className="flex items-center justify-center gap-2 sm:gap-6">
          <MatchupTeam logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
          <div className="flex min-w-0 flex-col items-center gap-0.5">
            <span className="whitespace-nowrap text-caption-1 text-neutral-muted">내 예측</span>
            {scored ? (
              <span className="whitespace-nowrap text-heading-1 font-black">
                {ourScoreOrder(scored.predicted, match.isHome).join(' – ')}
              </span>
            ) : (
              <span className="whitespace-nowrap text-label-1-normal font-extrabold">미참여</span>
            )}
          </div>
          <MatchupTeam logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
        </div>

        <div className="mt-6 rounded-md bg-page px-4 py-3">
          <p className="text-caption-1 text-neutral-muted">실제 결과</p>
          <p className="text-label-1-normal font-extrabold">
            {match.actual ? match.actual.join(' – ') : '스코어 집계 중'}
          </p>
        </div>
      </div>

      <p className="mb-2.5 mt-7 text-body-2-normal font-bold">내 선수 픽</p>
      {/* 모바일은 세로 행 리스트, 데스크탑은 포지션 카드 3장(퍼블리싱과 동일) */}
      <div className="overflow-hidden rounded-lg border border-neutral-weak sm:hidden">
        {POSITIONS.map(position => (
          <PickResultRow
            key={position}
            position={position}
            pick={resolvePick(position, match, scored, predictions, candidates)}
          />
        ))}
      </div>
      <div className="hidden sm:flex sm:gap-2.5">
        {POSITIONS.map(position => (
          <PickResultCard
            key={position}
            position={position}
            pick={resolvePick(position, match, scored, predictions, candidates)}
          />
        ))}
      </div>
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
    <span className={cn('inline-flex rounded-pill px-[9px] py-[3px] text-caption-2 font-bold', TIER_BADGE[tier])}>
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
    <span className={cn('mb-4 inline-flex rounded-pill px-[9px] py-[3px] text-caption-2 font-bold', style)}>
      {label}
    </span>
  )
}

function PickResultRow({ position, pick }: { position: Position; pick: ResolvedPick }) {
  return (
    <div className="border-b border-neutral-weak bg-surface p-3 last:border-b-0">
      <p className="mb-2 text-caption-2 font-bold text-neutral-muted">{POSITION_LABEL[position]}</p>
      <div className="flex items-center gap-2.5">
        <PlayerPhoto url={pick?.photoUrl ?? null} size={48} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
          <p className={cn('truncate text-label-1-normal font-extrabold', !pick && 'text-neutral-muted')}>
            {pick ? pick.name ?? '선수 정보 없음' : '선택하지 않았어요'}
          </p>
          {pick && <RatingBadge rating={pick.rating} />}
        </div>
        {pick && (
          <div className="flex shrink-0 flex-col items-end gap-[3px]">
            {pick.multiplier !== null && (
              <span className="text-caption-2 font-bold text-neutral-muted">×{pick.multiplier.toFixed(1)}</span>
            )}
            <span className="text-body-2-normal font-black text-brand">{pick.points}점</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PickResultCard({ position, pick }: { position: Position; pick: ResolvedPick }) {
  return (
    <div className="flex min-h-[196px] min-w-0 flex-1 flex-col rounded-lg border border-neutral-weak bg-surface p-3">
      <span className="text-caption-1 font-extrabold text-neutral-muted">{POSITION_LABEL[position]}</span>
      <div className="my-2.5 h-px bg-neutral-weak" />
      {pick ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          <PlayerPhoto url={pick.photoUrl} />
          <p className="mt-0.5 text-center text-label-2 font-extrabold">{pick.name ?? '선수 정보 없음'}</p>
          <RatingBadge rating={pick.rating} />
          <div className="my-1.5 h-px w-8 bg-neutral-weak" />
          <span className="text-caption-1 font-bold text-brand">{pick.points}점</span>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          {/* 손으로 조립한 실루엣 원 대신 PlayerPhoto의 폴백을 그대로 쓴다 — 폴백 톤이 한 곳에서만 정해진다. */}
          <PlayerPhoto url={null} size={40} />
          <span className="text-center text-caption-2 font-bold text-neutral-muted">
            선택하지
            <br />
            않았어요
          </span>
        </div>
      )}
    </div>
  )
}

function MatchupTeam({ logoUrl, name }: { logoUrl: string; name: string }) {
  return (
    <div className="flex w-[88px] shrink-0 flex-col items-center gap-1.5">
      <TeamBadge logoUrl={logoUrl} name={name} />
      <span className="text-label-2 font-bold text-neutral-muted">{name}</span>
    </div>
  )
}
