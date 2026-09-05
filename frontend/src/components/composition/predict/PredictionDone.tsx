'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { PlayerPhoto, TeamBadge } from './shared'
import { MatchResultBlock } from './PredictionResult'
import { POSITIONS, POSITION_LABEL, playerPhotoUrl, type Candidate, type Position } from '@/lib/predictions/candidates'
import { matchResultState } from '@/lib/predictions/result'
import {
  NUFC_LABEL,
  NUFC_TEAM_ID,
  teamLogoUrl,
  weekLabel,
  type WeekPrediction,
  type WeekSession,
} from '@/lib/predictions/week'
import type { FixturePositionTop3 } from '@/lib/queries/fixtures'
import type { MyPredictionMap, MyFixtureResultMap } from '@/lib/queries/predictions'
import type { PickCandidates } from '@/lib/queries/squads'
import { cn } from '@/lib/utils'
import { badgeVariants } from '@/components/primitives/badge'
import { competitionColorBucket, COMPETITION_BADGE } from '@/lib/predictions/competitionColor'

/** 완료 화면이 그리는 픽 하나 — 후보 목록에서 못 찾은 선수(스쿼드 이탈)도 배당은 스냅샷으로 남는다. */
type PickedPlayer = {
  position: Position
  name: string | null
  photoUrl: string | null
  multiplier: number
}

/** 경기 하나의 픽 3개 — 픽은 경기별이라 경기 id로 꺼낸다. */
function resolvePicks(
  prediction: WeekPrediction,
  matchId: string,
  candidates: PickCandidates,
): PickedPlayer[] {
  return POSITIONS.map(position => {
    const { playerId, multiplier } = prediction.picks[matchId][position]
    const found: Candidate | undefined = candidates[position].find(c => c.id === playerId)
    return {
      position,
      // 스쿼드에서 빠진 선수는 이름을 알 수 없다 — 사진 URL은 id만으로 만들어진다.
      name: found?.name ?? null,
      photoUrl: found?.photoUrl ?? playerPhotoUrl(playerId),
      multiplier,
    }
  })
}

/**
 * 주차 제출 완료 화면(= 허브). 퍼블리싱 `renderComplete` / `completeCardHtml` 구조를 따른다:
 * 헤드라인 → 독립 카운트다운 블록 → 카드(제출됨 · 유예됨 · 마감됨) → 하단 수정하기 버튼.
 * 카운트다운 기준은 결과 반영 시각(다음 일요일 08:00 KST, TEA-35) — 킥오프 후에도 결과가 나올 때까지 유지된다.
 * 승부예측은 킥오프 전까지 자유롭게 재제출(수정)할 수 있다 — 카드 자체는 클릭되지 않고, 수정은
 * 하단 "수정하기" 버튼 하나로만 진입한다(2026-09-04 결정, feature-spec.md §7-5).
 */
export function PredictionDone({
  week,
  prediction,
  candidates,
  fixtureResults,
  topRatings,
}: {
  week: WeekSession
  prediction: WeekPrediction
  candidates: PickCandidates
  /** fixture_id → 정산 게이트 없는 채점 결과. 종료된 경기 카드에만 쓰인다. */
  fixtureResults: MyFixtureResultMap
  /** fixture_id → 포지션별 평점 TOP3. 종료된 경기 카드에만 쓰인다. */
  topRatings: Record<string, FixturePositionTop3>
}) {
  const submittedMatches = week.matches.filter(match => prediction.scores[match.id])
  // 제출된 경기 중 이미 킥오프돼 잠긴 경기는 수정 대상에서 뺀다 — "제출됨" 표시는 submittedMatches를
  // 그대로 쓰고, 수정 진입 경로만 이 목록을 기준으로 계산한다.
  const editableMatches = submittedMatches.filter(match => !match.locked)
  // 아직 안 잠겼는데 제출 안 함 = 사용자가 "나중에"를 고른 상태(부분 제출 선택권, feature-spec §3.2).
  const deferredMatches = week.matches.filter(match => !prediction.scores[match.id] && !match.locked)
  // 마감돼서 제출하지 못한 경기 — 결과가 아직 안 나왔어도 "참여하지 못했다"는 사실은 지금 알려줘야 한다.
  const missedMatches = week.matches.filter(match => !prediction.scores[match.id] && match.locked)
  const isMulti = week.matches.length > 1
  const editHref =
    editableMatches.length === 1
      ? `/predictions/${week.weekKey}?edit=${editableMatches[0].id}`
      : `/predictions/${week.weekKey}?editSelect=1`
  // 퍼널 A의 종료 지점. 제출 성공 직후 router.refresh()로 이 화면이 마운트되므로 사실상
  // 제출 성공과 1:1이고, 앞 단계가 전부 클라이언트 이벤트라 퍼널이 한 계층에서 일관된다.
  // (지표용 prediction_submitted는 별도로 서버가 보낸다 — 측정 대상이 달라 중복이 아니다.)
  // missed_match_count/is_partial은 "제출 안 한 경기가 있다"는 기존 의미 그대로 유지한다 —
  // 화면은 이제 그 이유(마감돼서 vs 아직 안 함)를 나눠 보여주지만, 분석 이벤트 스키마 확장은
  // 이번 스코프에서 스킵 확정이라(feature-spec.md §7-7) 필드 의미는 건드리지 않는다.
  const notSubmittedCount = deferredMatches.length + missedMatches.length
  useEffect(() => {
    trackEvent('prediction_done_viewed', {
      week_key: week.weekKey,
      submitted_match_count: submittedMatches.length,
      missed_match_count: notSubmittedCount,
      is_partial: notSubmittedCount > 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week.weekKey])

  const intro = (align: 'center' | 'left') => (
    <div className={align === 'center' ? 'text-center' : 'text-left'}>
      <p className="text-headline-1 font-semibold text-neutral">{weekLabel(week.weekNo, '주차')} 제출 완료</p>
      <p className="mt-1 text-label-2 text-neutral-muted">킥오프 전까지 언제든 결과를 확인하러 다시 와주세요</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-16 pt-4 sm:max-w-content sm:px-10 sm:pt-6">
      {/* 데스크탑 2단(좌: 안내 문구 / 우: 카드) — 예측 플로우와 같은 그리드 */}
      <div className="sm:grid sm:grid-cols-[200px_1fr] sm:gap-x-10">
        <div className="mb-5 sm:mb-0">
          <div className="sm:hidden">{intro('center')}</div>
          <div className="hidden sm:block">{intro('left')}</div>
        </div>

        <div>
          <Countdown targetIso={week.resultAt} />

          {/* 아직 안 잠긴(킥오프 전) 미제출 경기 — 부분 제출 선택권으로 "나중에"를 고른 상태다.
              지금 바로 예측하러 갈 수 있는 CTA를 준다(제출 문맥 단일 경기 진입). */}
          {deferredMatches.map(match => (
            <div key={match.id} className="mb-4">
              {isMulti && (
                <p className="mb-2 text-label-2 font-medium text-neutral-muted">
                  {NUFC_LABEL} vs {match.opponent}
                </p>
              )}
              <div className="rounded-lg border border-neutral-weak bg-surface px-4 py-5 text-center">
                <p className="mb-3 text-body-2-normal font-semibold">아직 예측하지 않았어요</p>
                <Link
                  href={`/predictions/${week.weekKey}?match=${match.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-md bg-brand-solid px-5 text-label-1-normal font-medium text-on-solid"
                >
                  지금 예측하기
                </Link>
              </div>
            </div>
          ))}

          {/* 제출하지 못한 경기(킥오프이 지나 마감)도 같은 화면에 함께 보여준다 — 참여 마감은 경기
              단위라 더블 매치위크에서 한 경기만 놓치는 상황이 정상이다(2026-08-23 확정). */}
          {missedMatches.map(match => (
            <div key={match.id} className="mb-4">
              {isMulti && (
                <p className="mb-2 text-label-2 font-medium text-neutral-muted">
                  {NUFC_LABEL} vs {match.opponent}
                </p>
              )}
              <div className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
                {/* 대회명 배지(TEA-30): PredictionFlowClient와 같은 배지(100 배경+800 텍스트), 제출·마감 카드 공통. */}
                <div className="mb-3 flex items-center gap-2">
                  <p className="text-body-2-normal font-semibold">경기 예측</p>
                  {match.competition && (
                    <span
                      className={cn(
                        badgeVariants({ variant: 'bare' }),
                        COMPETITION_BADGE[competitionColorBucket(match.competition)],
                      )}
                    >
                      {match.competition}
                    </span>
                  )}
                </div>
                <p className="px-4 pb-4 pt-5 text-center text-label-1-normal text-neutral-muted">
                  이 경기는 예측 마감 시간이 지나 참여하지 못했어요
                </p>
              </div>
            </div>
          ))}

          {/* 픽이 경기별이라 카드도 경기별로 나눈다 — 스코어와 그 경기 픽이 한 카드 안에 있다. */}
          {submittedMatches.map((match, i) => {
            const [ourScore, theirScore] = prediction.scores[match.id]!

            if (match.finished) {
              // 종료된 경기는 결과 화면과 같은 판정 블록(경기 비교 + 내 선수 픽)을 그대로 쓴다 —
              // 대회 배지·카드 그림자/패딩 차이는 감수한다(design-brief.md §8-3, 4단계 확정).
              const singlePrediction: MyPredictionMap = {
                [match.id]: { score: prediction.scores[match.id]!, picks: prediction.picks[match.id] },
              }
              return (
                <div key={match.id} className={cn(i > 0 && 'mt-4')}>
                  {isMulti && (
                    <p className="mb-2 text-label-2 font-medium text-neutral-muted">
                      경기 {i + 1} · {NUFC_LABEL} vs {match.opponent}
                    </p>
                  )}
                  <MatchResultBlock
                    match={match}
                    state={matchResultState(match, fixtureResults)}
                    predictions={singlePrediction}
                    candidates={candidates}
                    topRatings={topRatings[match.id]}
                    pickPointsReady={fixtureResults[match.id]?.ratingsSettled ?? false}
                  />
                </div>
              )
            }

            const picks = resolvePicks(prediction, match.id, candidates)
            return (
              <div key={match.id} className={cn(i > 0 && 'mt-4')}>
                {isMulti && (
                  <p className="mb-2 text-label-2 font-medium text-neutral-muted">
                    경기 {i + 1} · {NUFC_LABEL} vs {match.opponent}
                  </p>
                )}
                <div className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
                  <div className="mb-3 flex items-center gap-2">
                    <p className="text-body-2-normal font-semibold">경기 예측</p>
                    {match.competition && (
                      <span
                        className={cn(
                          badgeVariants({ variant: 'bare' }),
                          COMPETITION_BADGE[competitionColorBucket(match.competition)],
                        )}
                      >
                        {match.competition}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-2 sm:gap-6">
                    <MatchupTeam logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
                    <span className="text-title-2 font-semibold">
                      {ourScore} – {theirScore}
                    </span>
                    <MatchupTeam logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
                  </div>

                  {/* 킥오프됐지만(잠김) 아직 안 끝난 경기 — 결과가 아직 없다는 것만 알린다.
                      배지 없이 캡션 한 줄(design-brief.md §8-1 후보 1, 5단계 확정). */}
                  {match.locked && (
                    <p className="mt-4 text-center text-caption-1 text-neutral-muted">
                      결과를 기다리는 중이에요
                    </p>
                  )}

                  <p className="mb-3 mt-7 text-body-2-normal font-semibold">내 선수 픽</p>
                  {/* 모바일은 행 리스트, 데스크탑은 포지션 카드 3개 (퍼블리싱 동일) */}
                  <div className="sm:hidden">
                    <PickResultList picks={picks} />
                  </div>
                  <div className="hidden sm:flex sm:gap-2">
                    {picks.map(pick => (
                      <PickCard key={pick.position} pick={pick} />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}

          {/* 공유하기는 이번 스코프에서 완전히 제외됐다(재배치는 별도 논의) — 그 자리를 큰
              "수정하기" 버튼 하나로 대체한다. 제출된 경기가 없으면 수정할 게 없어 버튼 자체를
              숨긴다(2026-09-04 결정, feature-spec.md §7-5). */}
          {editableMatches.length > 0 && (
            <div className="mt-7 flex flex-col items-center gap-2">
              <Link
                href={editHref}
                className="flex h-12 w-full max-w-[280px] items-center justify-center rounded-lg bg-brand-solid text-label-1-normal font-medium text-on-solid"
              >
                수정하기
              </Link>
              <p className="text-center text-caption-1 text-neutral-muted">킥오프 전까지 다시 수정할 수 있어요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 결과 반영(매일 KST 08:00 크론)까지 남은 시간. 1초마다 텍스트만 갱신한다(퍼블리싱
 * `updateCountdownDisplay`와 같은 방식). 첫 렌더는 서버와 같은 자리표시자(`-`/`--`)를 그려
 * 하이드레이션 불일치를 피한다. 남은 시간이 0 이하면(크론이 아직 안 돌았거나 막 돈 시점)
 * 숫자 대신 "결과를 반영하고 있어요" 안내로 바꾼다.
 */
function Countdown({ targetIso }: { targetIso: string | null }) {
  const target = targetIso ? new Date(targetIso).getTime() : null
  const [remaining, setRemaining] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (target === null) return
    const tick = () => setRemaining(Math.max(0, target - Date.now()))
    tick()
    timer.current = setInterval(tick, 1000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [target])

  if (target === null) return null

  const isDone = remaining !== null && remaining <= 0
  const segments =
    remaining === null
      ? [
          { value: '-', unit: '일' },
          { value: '--', unit: '시간' },
          { value: '--', unit: '분' },
          { value: '--', unit: '초' },
        ]
      : [
          { value: String(Math.floor(remaining / 86_400_000)), unit: '일' },
          { value: pad(Math.floor((remaining % 86_400_000) / 3_600_000)), unit: '시간' },
          { value: pad(Math.floor((remaining % 3_600_000) / 60_000)), unit: '분' },
          { value: pad(Math.floor((remaining % 60_000) / 1000)), unit: '초' },
        ]

  return (
    <div className="mb-4 rounded-lg bg-neutral-strong px-4 pb-5 pt-5 text-center">
      <p className="mb-2 text-caption-1 font-medium text-on-solid-muted">결과 반영까지</p>
      {isDone ? (
        <p className="py-1 text-title-3 font-semibold text-on-solid">결과를 반영하고 있어요</p>
      ) : (
        <div className="flex items-start justify-center gap-2.5">
          {segments.map((segment, i) => (
            <div key={segment.unit} className="flex items-start gap-2.5">
              {i > 0 && <span className="mt-px text-heading-2 font-semibold text-on-solid-muted">:</span>}
              <div className="flex min-w-[34px] flex-col items-center gap-1">
                <span className="text-title-3 font-semibold tabular-nums text-on-solid">{segment.value}</span>
                <span className="text-caption-2 text-on-solid-muted">{segment.unit}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 모바일 픽 결과 행 — 퍼블리싱 `positionCompleteRowHtml`. 경기 전이라 평점·점수 없이 배당만. */
function PickResultList({ picks }: { picks: PickedPlayer[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-weak">
      {picks.map((pick, i) => (
        <div
          key={pick.position}
          className={cn('bg-surface p-3', i < picks.length - 1 && 'border-b border-neutral-weak')}
        >
          <p className="mb-2 text-caption-1 font-medium text-neutral-muted">{POSITION_LABEL[pick.position]}</p>
          <div className="flex items-center gap-2.5">
            <PlayerPhoto url={pick.photoUrl} size={48} />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <p className="truncate text-label-1-normal font-medium text-neutral">
                {pick.name ?? '선수 정보 없음'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** 데스크탑 포지션 카드 — 예측 플로우의 카드와 같은 모양이지만 클릭되지 않는다. */
function PickCard({ pick }: { pick: PickedPlayer }) {
  return (
    <div className="flex min-h-[196px] min-w-0 flex-1 flex-col rounded-lg border border-neutral-weak bg-surface p-3">
      <span className="text-caption-1 font-medium text-neutral-muted">{POSITION_LABEL[pick.position]}</span>
      <div className="my-2 h-px bg-neutral-weak" />
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        {pick.name ? (
          <>
            <PlayerPhoto url={pick.photoUrl} />
            <p className="mt-0.5 text-center text-label-2 font-medium">{pick.name}</p>
          </>
        ) : (
          <>
            {/* 손으로 조립한 실루엣 원 대신 PlayerPhoto의 폴백을 그대로 쓴다 — 폴백 톤이 한 곳에서만 정해진다. */}
            <PlayerPhoto url={null} size={40} />
            <p className="mt-0.5 text-center text-label-2 font-medium text-neutral-muted">선수 정보 없음</p>
          </>
        )}
      </div>
    </div>
  )
}

function MatchupTeam({ logoUrl, name }: { logoUrl: string | null; name: string }) {
  return (
    <div className="flex w-[88px] shrink-0 flex-col items-center gap-1.5">
      <TeamBadge logoUrl={logoUrl} name={name} />
      <span className="text-label-2 font-medium text-neutral-muted">{name}</span>
    </div>
  )
}
