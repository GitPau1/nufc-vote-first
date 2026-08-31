'use client'

import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { Card } from '@/components/primitives/card'
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
import { badgeVariants } from '@/components/primitives/badge'

/**
 * 주차 결과 화면(퍼블리싱 `renderResult`). 맨 상단의 "내 예측 / 전체 결과 / 순위" 세그먼트로 탭을 고른다 —
 * "내 예측"은 경기별 비교 + 선수 픽, "전체 결과"는 히어로(등수·점수) + 주차 랭킹, "순위"는 시즌 누적 순위다.
 * 첫 진입 기본 탭은 "전체 결과"다(내 점수·순위가 먼저 보이도록 — 사용자 확정).
 * 모바일·데스크탑 모두 같은 탭 구조다.
 *
 * 랭킹은 참여 여부와 무관하게 공개된다 — 예측하지 않은 주차도 이 화면으로 들어와 "미참여" 안내와
 * 랭킹을 볼 수 있다(퍼블리싱 `buildLeaderboardNoParticipation`). 시즌 누적 순위(순위 탭)도 같은 원칙이다.
 * 채점 단위는 경기지만 등수는 주차 단위 하나뿐이라, 더블 매치위크는 두 경기 점수를 합산한다.
 */
export function PredictionResult({
  week,
  results,
  predictions,
  candidates,
  ranking,
  seasonRanking,
}: {
  week: WeekSession
  /** fixture_id → 채점 결과 */
  results: MyResultMap
  /** fixture_id → 내 제출 내역 — 배당(제출 시점 스냅샷)은 여기서만 온다 */
  predictions: MyPredictionMap
  candidates: PickCandidates
  ranking: RankingRow[]
  /** 시즌 누적 순위(순위 탭) — `ranking`(주차)과 달리 총점만 있다(week_leaderboard vs season_leaderboard) */
  seasonRanking: RankingRow[]
}) {
  const [tab, setTab] = useState<'mine' | 'rank' | 'season'>('rank')
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

  // 셸은 제출 화면(PredictionFlowClient)과 동일 규격 — 860px 컨테이너 + 단일 Card
  return (
    <div className="mx-auto max-w-[860px] px-4 pb-16 pt-4 sm:px-6 sm:pt-8">
      <Card className="p-5 sm:p-7">
        {/* 탭 세그먼트 — 모든 뷰포트 공통. */}
        <div className="mb-5 flex gap-0.5 rounded-pill bg-disabled p-1">
          <SegmentButton active={tab === 'mine'} onClick={() => setTab('mine')}>
            내 예측
          </SegmentButton>
          <SegmentButton active={tab === 'rank'} onClick={() => setTab('rank')}>
            전체 결과
          </SegmentButton>
          <SegmentButton active={tab === 'season'} onClick={() => setTab('season')}>
            순위
          </SegmentButton>
        </div>

        <div className={tab === 'mine' ? 'block' : 'hidden'}>
          {week.matches.map((match, i) => (
            <div key={match.id}>
              {week.matches.length > 1 && (
                <p className={cn('mb-2 text-label-2 font-medium text-neutral-muted', i > 0 && 'mt-5')}>
                  경기 {i + 1} · {NUFC_LABEL} vs {match.opponent}
                </p>
              )}
              {/* 흰 Card 안이라 보더 카드를 겹치면 이중 프레임이 된다 — WeekRankCard·히어로·제출 화면
                  SummarySection과 같은 "카드 안 회색 패널(bg-page)"로 맞춘다. */}
              <div className="animate-enter rounded-lg bg-page px-4 py-5 text-left">
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

        <div className={tab === 'rank' ? 'block' : 'hidden'}>
          <Hero weekNo={week.weekNo} summary={summary} />
          {/* 모바일은 화면 높이만큼만 노출하고, 데스크탑은 10명까지만 그린 뒤 "전체보기"로 펼친다 */}
          <WeekRankCard weekNo={week.weekNo} entries={ranking} className="sm:hidden" />
          <WeekRankCard weekNo={week.weekNo} entries={ranking} capped className="hidden sm:block" />
        </div>

        <div className={tab === 'season' ? 'block' : 'hidden'}>
          <SeasonRankSection entries={seasonRanking} />
        </div>
      </Card>
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
      aria-pressed={active}
      className={cn(
        'flex-1 rounded-pill px-1 py-2 text-label-2 font-medium transition-colors duration-micro',
        active ? 'bg-brand-solid text-on-solid' : 'text-neutral-muted',
      )}
    >
      {children}
    </button>
  )
}

/** 순위 탭에서 보여줄 인원 수 — 넘으면 "전체보기"로 펼친다(WeekRankCard의 데스크탑 캡과 같은 값). */
const SEASON_RANK_CAP = 10

/**
 * 순위 탭 — 시즌 누적 순위(총점만) 목록. `WeekRankCard`는 주차 랭킹 전용이다: 그 카드의 예측/선수픽
 * 컬럼은 `RankingRow.matchPoints`/`pickPoints`가 있다고 가정하고 없으면 `?? 0`으로 채워서
 * "0점을 받았다"처럼 보인다(WeekRankCard.stories.tsx의 `MissingColumnPoints` 스토리가 이 근거로
 * "이 카드에는 주차 랭킹 행만 넘겨야 한다"고 명시한다). 그래서 시즌 데이터는 이 파일 안에서
 * 총점 한 컬럼짜리 단순 목록으로 따로 그린다 — WeekRankCard의 모바일/데스크탑 이원 캡 대신
 * 전체 뷰포트에서 같은 캡+전체보기 하나만 쓴다.
 */
function SeasonRankSection({ entries }: { entries: RankingRow[] }) {
  const [expanded, setExpanded] = useState(false)
  const overLimit = entries.length > SEASON_RANK_CAP

  const rows = expanded || !overLimit ? entries : entries.slice(0, SEASON_RANK_CAP)
  const me = entries.find(entry => entry.isMe)
  const myRowBelow = !expanded && overLimit && me && !rows.includes(me) ? me : undefined

  return (
    <div className="rounded-lg bg-page p-4 text-left">
      <p className="mb-3 text-body-2-normal font-semibold text-neutral">시즌 누적 순위</p>

      {entries.length === 0 ? (
        <p className="text-caption-1 text-neutral-muted">아직 집계된 시즌 순위가 없어요</p>
      ) : (
        <>
          <SeasonRankHeaderRow />
          {rows.map(entry => (
            <SeasonRankRow key={entry.userId} entry={entry} />
          ))}
          {myRowBelow && (
            <>
              <div className="py-1 text-center text-label-2 text-neutral-subtle">⋯</div>
              <SeasonRankRow entry={myRowBelow} />
            </>
          )}

          {!expanded && overLimit && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-3 flex w-full items-center justify-center rounded-md border border-neutral-weak p-3 text-label-2 font-medium text-neutral-muted transition-colors duration-micro hover:border-neutral-strong"
            >
              전체보기 · {entries.length}명
            </button>
          )}
        </>
      )}
    </div>
  )
}

function SeasonRankHeaderRow() {
  return (
    <div className="flex items-center gap-2 px-1 pb-2">
      <span className="w-8 shrink-0 text-center text-caption-2 font-medium text-neutral-muted">순위</span>
      <span className="h-7 w-7 shrink-0" />
      <span className="min-w-0 flex-1" />
      <span className="w-12 shrink-0 text-center text-caption-2 font-medium text-neutral-muted">총점</span>
    </div>
  )
}

function SeasonRankRow({ entry }: { entry: RankingRow }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-neutral-weak px-1 py-3 last:border-b-0',
        entry.isMe && 'rounded-md border-b-0 bg-brand-weak px-2',
      )}
    >
      <span
        className={cn(
          'w-8 shrink-0 text-center text-body-1-normal font-semibold text-neutral',
          entry.isMe && 'text-brand',
        )}
      >
        {entry.rank}
      </span>

      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-disabled text-neutral-subtle">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-3.5 w-3.5" />
        )}
      </span>

      <span className="min-w-0 flex-1 truncate text-label-1-normal font-medium text-neutral">{entry.name}</span>

      <span className="w-12 shrink-0 text-center text-body-2-normal font-semibold text-brand">
        {entry.totalPoints}
      </span>
    </div>
  )
}

/**
 * 히어로 — 주차 등수(내 단계)와 점수 구성. 미참여 주차는 안내 문구만.
 * 흰 Card 안의 첫 요소라 다크 배경 대신 WeekRankCard·제출 화면 SummarySection과 같은
 * "카드 안 회색 패널(bg-page)"을 쓴다(WeekRankCard의 이중 프레임 방지 규칙과 동일).
 * 위계: 등수(title-2·brand) > 총점(title-3·카운트업) > 경기예측/선수픽(보조, HeroStat).
 */
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
      <div className="mb-4 rounded-lg bg-page px-4 py-5 text-center">
        <p className="text-caption-1 text-neutral-muted">{weekNo}주차 결과</p>
        <p className="mt-2 text-label-1-normal font-medium text-neutral">
          이 기간에는 예측에 참여하지 않았어요
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-lg bg-page px-4 py-6 text-center">
      <p className="text-caption-1 text-neutral-muted">{weekNo}주차 결과</p>

      {/* 등수는 랭킹 집계가 끝나야 나온다 — 아직이면 "집계 중"으로 자리를 지킨다.
          내 등수의 brand 색은 WeekRankCard의 내 행(isMe) 강조와 같은 규칙이다. */}
      <p className="mt-2 flex items-baseline justify-center gap-1.5">
        <span
          className={cn(
            'text-title-2 font-semibold',
            summary.rank === null ? 'text-neutral' : 'text-brand',
          )}
        >
          {summary.rank === null ? '집계 중' : `${summary.rank}위`}
        </span>
        {summary.rank !== null && (
          <span className="text-label-1-normal font-medium text-neutral-muted">
            / {summary.totalEntries}명
          </span>
        )}
      </p>

      {/* 총점 — 등수 다음 위계. 0에서 굴러 올라간다(useCountUp). */}
      <p className="mt-1 flex items-baseline justify-center gap-1.5">
        <span className="text-caption-1 text-neutral-muted">총점</span>
        <span className="text-title-3 font-semibold text-neutral">{total}점</span>
      </p>

      <div className="mx-auto mt-5 flex max-w-[320px] justify-center gap-5 border-t border-neutral-weak pt-4">
        <HeroStat label="경기예측" value={`${summary.matchPoints}점`} />
        <HeroStat label="선수픽" value={`${summary.pickPoints}점`} />
      </div>
    </div>
  )
}

/** 점수 구성의 보조 항목(경기예측/선수픽) — 총점보다 한 단계 작은 위계. */
function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-caption-1 text-neutral-muted">{label}</p>
      <p className="mt-1 text-label-1-normal font-medium text-neutral">{value}</p>
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
        <p className="mb-3 text-body-2-normal font-semibold">경기 예측</p>
        {/* 스코어보드가 들어갈 자리 — 아직 비교할 값이 없어도 같은 흰 패널을 써서
            한 주차에 끝난 경기와 안 끝난 경기가 섞여도 블록 모양이 흔들리지 않게 한다. */}
        <div className="rounded-md bg-surface px-4 py-6 text-center">
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
      <p className="mb-3 text-body-2-normal font-semibold">경기 예측</p>
      {/* 스코어보드 — 회색 블록 위의 흰 패널(페이지 위 Card와 같은 관계)이라 안쪽 "실제" 행이
          다시 bg-page로 눌릴 수 있다. 팀을 열로 세우고 "내 예측"과 "실제"를 같은 열에 위아래로
          붙여, 두 스코어가 세로로 맞물려 읽히게 한다(전에는 배지 사이 스코어와 별도 박스로 떨어져 있었다).
          왼쪽 열이 뉴캐슬 — `ourScoreOrder`와 `MatchView.actual` 둘 다 [우리, 상대] 순서다. */}
      <div className="rounded-md bg-surface p-3 sm:p-4">
        <div className="flex items-center gap-2 px-2">
          <span aria-hidden className={SCORE_LABEL_CELL_CLASS} />
          <MatchupTeam logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
          <span aria-hidden className={SCORE_DIVIDER_CELL_CLASS} />
          <MatchupTeam logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
        </div>

        {/* 미참여는 배지 하나로만 말한다 — 스코어 칸까지 "미참여"를 반복하면 한 행에 같은 말이 두 번 나온다. */}
        <ScoreCompareRow
          label="내 예측"
          badge={<PointsBadge matchPoints={scored?.matchPoints ?? null} />}
          score={scored ? ourScoreOrder(scored.predicted, match.isHome) : null}
          fallback="–"
        />
        <ScoreCompareRow
          label="실제 결과"
          score={match.actual}
          fallback="스코어 집계 중"
          className="rounded-md bg-page"
        />
      </div>

      <p className="mb-3 mt-7 text-body-2-normal font-semibold">내 선수 픽</p>
      {/* 모바일은 세로 행 리스트, 데스크탑은 포지션 카드 3장(퍼블리싱과 동일).
          회색 블록 위라 흰 행/카드 자체가 경계를 만든다 — 보더는 얹지 않는다(이중 프레임 방지). */}
      <div className="overflow-hidden rounded-lg sm:hidden">
        {POSITIONS.map(position => (
          <PickResultRow
            key={position}
            position={position}
            pick={resolvePick(position, match, scored, predictions, candidates)}
          />
        ))}
      </div>
      <div className="hidden sm:flex sm:gap-2">
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

/**
 * 스코어보드의 열 폭 — 팀 축(헤더)과 스코어 행이 **같은 상수**를 참조해야 숫자가 세로로 맞물린다.
 * 한쪽만 고치면 정렬이 조용히 어긋나므로 리터럴을 양쪽에 복제하지 마라.
 */
const SCORE_LABEL_CELL_CLASS = 'w-16 shrink-0 sm:w-24'
const SCORE_DIVIDER_CELL_CLASS = 'w-4 shrink-0'
/** 숫자 한 칸 — 팀 축 칸과 같은 flex-1이라 팀과 스코어가 한 열로 읽힌다. */
const SCORE_CELL_CLASS = 'min-w-0 flex-1 text-center text-heading-1 font-semibold text-neutral'

/**
 * 스코어보드 한 행 — 왼쪽 라벨(내 예측 행은 그 아래 적중 배지) + 팀별 숫자 두 칸.
 * 값이 없으면 숫자 칸 자리를 `fallback`이 대신한다. 상태를 무엇이 말하는지는 호출부가 정한다:
 * 내 예측 행은 배지가 "미참여"를 말하므로 중립 대시, 배지가 없는 실제 결과 행은 "스코어 집계 중" 문구.
 */
function ScoreCompareRow({
  label,
  badge,
  score,
  fallback,
  className,
}: {
  label: string
  badge?: React.ReactNode
  score: [number, number] | null
  fallback: string
  className?: string
}) {
  return (
    <div className={cn('mt-2 flex items-center gap-2 px-2 py-2', className)}>
      <div className={SCORE_LABEL_CELL_CLASS}>
        <p className="break-keep text-caption-1 text-neutral-muted">{label}</p>
        {badge && <div className="mt-1">{badge}</div>}
      </div>
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

function PickResultRow({ position, pick }: { position: Position; pick: ResolvedPick }) {
  return (
    <div className="border-b border-neutral-weak bg-surface p-3 last:border-b-0">
      <p className="mb-2 text-caption-1 font-medium text-neutral-muted">{POSITION_LABEL[position]}</p>
      <div className="flex items-center gap-2.5">
        <PlayerPhoto url={pick?.photoUrl ?? null} size={48} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <p className={cn('truncate text-label-1-normal font-medium', !pick && 'text-neutral-muted')}>
            {pick ? pick.name ?? '선수 정보 없음' : '선택하지 않았어요'}
          </p>
          {pick && <RatingBadge rating={pick.rating} />}
        </div>
        {pick && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-body-2-normal font-semibold text-brand">{pick.points}점</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PickResultCard({ position, pick }: { position: Position; pick: ResolvedPick }) {
  return (
    <div className="flex min-h-[196px] min-w-0 flex-1 flex-col rounded-lg bg-surface p-3">
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
