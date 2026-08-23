'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PlayerPhoto, Silhouette, TeamBadge } from './shared'
import { POSITIONS, POSITION_LABEL, playerPhotoUrl, type Candidate, type Position } from '@/lib/predictions/candidates'
import {
  NUFC_LABEL,
  NUFC_TEAM_ID,
  teamLogoUrl,
  type WeekPrediction,
  type WeekSession,
} from '@/lib/predictions/week'
import type { PickCandidates } from '@/lib/queries/squads'
import { cn } from '@/lib/utils'

/** 완료 화면이 그리는 픽 하나 — 후보 목록에서 못 찾은 선수(스쿼드 이탈)도 배당은 스냅샷으로 남는다. */
type PickedPlayer = {
  position: Position
  name: string | null
  photoUrl: string
  multiplier: number
}

function resolvePicks(prediction: WeekPrediction, candidates: PickCandidates): PickedPlayer[] {
  return POSITIONS.map(position => {
    const { playerId, multiplier } = prediction.picks[position]
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
 * 주차 제출 완료 화면. 퍼블리싱 `renderComplete` / `completeCardHtml` 구조를 따른다:
 * 헤드라인 → 독립 카운트다운 블록 → 카드(경기 예측 · 내 선수 픽 · 공유하기).
 * 카운트다운 기준은 그 주 첫 경기 킥오프 — 마감 기준과 같다.
 * 제출 후 수정이 불가하므로(DB UNIQUE + UPDATE 정책 없음) 픽 카드는 클릭되지 않는다.
 */
export function PredictionDone({
  week,
  prediction,
  candidates,
}: {
  week: WeekSession
  prediction: WeekPrediction
  candidates: PickCandidates
}) {
  const picks = resolvePicks(prediction, candidates)

  const intro = (align: 'center' | 'left') => (
    <div className={align === 'center' ? 'text-center' : 'text-left'}>
      <p className="text-headline-1 font-extrabold text-black">{week.weekNo}주차 제출 완료</p>
      <p className="mt-1 text-label-2 text-gray-2">킥오프 전까지 언제든 결과를 확인하러 다시 와주세요</p>
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
          <Countdown targetIso={week.deadlineAt} />

          <div className="rounded-lg border border-gray-4 bg-surface px-4 py-5">
            <p className="mb-2.5 text-body-2-normal font-bold">경기 예측</p>
            <div className="flex flex-col gap-4">
              {/* 내가 제출한 경기만 — 킥오프이 지나 예측하지 못한 경기는 여기 없다. */}
              {week.matches.map(match => {
                const submittedScore = prediction.scores[match.id]
                if (!submittedScore) return null
                const [ourScore, theirScore] = submittedScore
                return (
                  <div key={match.id} className="flex items-center justify-center gap-2 sm:gap-6">
                    <MatchupTeam logoUrl={teamLogoUrl(NUFC_TEAM_ID)} name={NUFC_LABEL} />
                    <span className="text-title-2 font-black">
                      {ourScore} – {theirScore}
                    </span>
                    <MatchupTeam logoUrl={teamLogoUrl(match.opponentId)} name={match.opponent} />
                  </div>
                )
              })}
            </div>

            <p className="mb-2.5 mt-7 text-body-2-normal font-bold">내 선수 픽</p>
            {/* 모바일은 행 리스트, 데스크탑은 포지션 카드 3개 (퍼블리싱 동일) */}
            <div className="sm:hidden">
              <PickResultList picks={picks} />
            </div>
            <div className="hidden sm:flex sm:gap-2.5">
              {picks.map(pick => (
                <PickCard key={pick.position} pick={pick} />
              ))}
            </div>

            <div className="mt-7 flex justify-center">
              <ShareButton />
            </div>
          </div>

          {/* 퍼블리싱엔 없는 문구 — DB UNIQUE + UPDATE 정책 없음을 반영 */}
          <p className="mt-4 text-center text-caption-1 text-gray-3">제출한 예측은 수정할 수 없어요</p>
        </div>
      </div>
    </div>
  )
}

/**
 * 킥오프까지 남은 시간. 1초마다 텍스트만 갱신한다(퍼블리싱 `updateCountdownDisplay`와 같은 방식).
 * 첫 렌더는 서버와 같은 자리표시자(`-`/`--`)를 그려 하이드레이션 불일치를 피한다.
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
    <div className="mb-4 rounded-lg bg-[#0c2340] px-4 pb-[18px] pt-5 text-center">
      <p className="mb-2.5 text-caption-1 font-bold text-white/65">결과 반영까지</p>
      <div className="flex items-start justify-center gap-2.5">
        {segments.map((segment, i) => (
          <div key={segment.unit} className="flex items-start gap-2.5">
            {i > 0 && <span className="mt-px text-heading-2 font-black text-white/30">:</span>}
            <div className="flex min-w-[34px] flex-col items-center gap-[3px]">
              <span className="text-[26px] font-black tabular-nums text-white">{segment.value}</span>
              <span className="text-[10px] leading-none text-white/50">{segment.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 모바일 픽 결과 행 — 퍼블리싱 `positionCompleteRowHtml`. 경기 전이라 평점·점수 없이 배당만. */
function PickResultList({ picks }: { picks: PickedPlayer[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-4">
      {picks.map((pick, i) => (
        <div
          key={pick.position}
          className={cn('bg-surface p-3', i < picks.length - 1 && 'border-b border-gray-4')}
        >
          <p className="mb-2 text-caption-2 font-bold text-gray-3">{POSITION_LABEL[pick.position]}</p>
          <div className="flex items-center gap-2.5">
            <PlayerPhoto url={pick.photoUrl} size={48} />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
              <p className="truncate text-label-1-normal font-extrabold text-black">
                {pick.name ?? '선수 정보 없음'}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-[3px]">
              <span className="text-caption-2 font-bold text-gray-3">×{pick.multiplier.toFixed(1)}</span>
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
    <div className="flex min-h-[196px] min-w-0 flex-1 flex-col rounded-lg border border-border bg-surface p-3">
      <span className="text-caption-1 font-extrabold text-gray-2">{POSITION_LABEL[pick.position]}</span>
      <div className="my-2.5 h-px bg-border" />
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        {pick.name ? (
          <>
            <PlayerPhoto url={pick.photoUrl} />
            <p className="mt-0.5 text-center text-label-2 font-extrabold">{pick.name}</p>
          </>
        ) : (
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-disabled text-gray-3">
              <Silhouette />
            </span>
            <p className="mt-0.5 text-center text-label-2 font-extrabold text-gray-3">선수 정보 없음</p>
          </>
        )}
        <span className="text-caption-1 font-bold text-primary-dark">×{pick.multiplier.toFixed(1)}</span>
      </div>
    </div>
  )
}

function MatchupTeam({ logoUrl, name }: { logoUrl: string; name: string }) {
  return (
    <div className="flex w-[88px] shrink-0 flex-col items-center gap-1.5">
      <TeamBadge logoUrl={logoUrl} name={name} />
      <span className="text-label-2 font-bold text-gray-2">{name}</span>
    </div>
  )
}

/** 공유하기 = 현재 주소 링크 복사(2026-08-22 결정). 퍼블리싱은 라벨만 있고 동작이 없었다. */
function ShareButton() {
  const [copied, setCopied] = useState(false)

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드 권한이 없거나 보안 컨텍스트가 아니면 조용히 넘긴다 — 주소창에서 직접 복사할 수 있다.
    }
  }

  return (
    <Button className="w-40" onClick={copyLink}>
      {copied ? '링크 복사 완료' : '↗ 공유하기'}
    </Button>
  )
}
