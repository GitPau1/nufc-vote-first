'use client'

import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { TeamBadge } from './shared'
import { cn } from '@/lib/utils'

/**
 * 클릭/예측의 단위는 "주차(week)"다 — 더블 매치위크(경기 2개)도 한 예측 세션으로 함께 열리고
 * 함께 제출된다. 그래서 status·submitted는 주차에 붙어 있고, 경기 행은 그 주에 뭘 예측하는지
 * 보여주는 정보 행일 뿐이다. 오픈/마감 기준은 그 주 첫 경기 킥오프다.
 */
export type WeekSessionStatus = 'open' | 'result' | 'upcoming'

export interface PredictWeekMatch {
  id: string
  /** 미지정 시 "프리미어리그"로 표시(더블 매치위크의 컵 경기 등은 명시) */
  competition?: string
  opponent: string
  /** true면 우리 팀이 홈(좌측) — false면 원정이라 상대가 좌측, 우리 팀이 우측에 온다 */
  isHome: boolean
  /** "8/2" 형태 */
  kickoff: string
  /** "오후 8:00" 형태 — 아직 안 끝난 경기에만 사용 */
  kickoffTime: string
  /** 이 경기가 종료됐는지 — 주차 상태와 별개로 스코어 표시를 가른다 */
  finished: boolean
  /** [홈팀 점수, 원정팀 점수] — isHome과 무관하게 항상 이 순서. finished일 때만 존재 */
  actual?: [number, number]
  opponentLogoUrl?: string
  /**
   * 이 경기에 대한 내 예측. predicted만 있고 totalPoints가 없으면
   * "제출은 했지만 아직 결과(점수) 발표 전" 상태를 뜻한다.
   */
  myResult?: {
    /** [홈팀 예측, 원정팀 예측] */
    predicted: [number, number]
    totalPoints?: number
  }
}

export interface PredictWeek {
  weekNo: number
  /** "2026-35" — 예측 세션 URL 파라미터 */
  weekKey: string
  status: WeekSessionStatus
  /** 이 주차 예측을 제출했는지(주 단위 1회) */
  submitted: boolean
  /** 0(경기 없는 주) · 1(일반) · 2(더블 매치위크). 주차 전체가 하나의 예측 세션이다 */
  matches: PredictWeekMatch[]
}

interface MatchWeekListProps {
  /** "8월" 형태 */
  monthLabel: string
  weeks: PredictWeek[]
  /** 우리 팀 이름(기본 "뉴캐슬") — isHome에 따라 좌/우 중 한쪽에 표기된다 */
  homeTeamName?: string
  /** 우리 팀 로고 — 매치마다 바뀌지 않으므로 리스트 단위로 한 번만 받는다 */
  homeTeamLogoUrl?: string
  onSelectWeek?: (week: PredictWeek) => void
  onPrevMonth?: () => void
  onNextMonth?: () => void
  className?: string
}

// 프로토타입 .badge / .badge-default / .badge-positive / .badge-outline 그대로
const BADGE_BASE = 'inline-flex items-center rounded-pill px-[9px] py-[3px] text-caption-2 font-bold'
const BADGE_VARIANT = {
  default: 'bg-primary-dim text-primary-dark',
  positive: 'bg-positive-dim text-positive',
  outline: 'bg-disabled text-gray-2',
} as const

function statusMeta(week: PredictWeek): { label: string; variant: keyof typeof BADGE_VARIANT } {
  if (week.status === 'open') return { label: '진행중', variant: 'default' }
  if (week.status === 'result') {
    return week.submitted
      ? { label: '참여', variant: 'positive' }
      : { label: '미참여', variant: 'outline' }
  }
  return { label: '예정', variant: 'outline' }
}

export function MatchWeekList({
  monthLabel,
  weeks,
  homeTeamName = '뉴캐슬',
  homeTeamLogoUrl,
  onSelectWeek,
  onPrevMonth,
  onNextMonth,
  className,
}: MatchWeekListProps) {
  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-title-3 font-black text-black">{monthLabel}</span>
        <div className="flex gap-0.5">
          <button
            type="button"
            aria-label="이전 달"
            onClick={onPrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-pill border border-gray-4 bg-surface text-gray-2 hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="다음 달"
            onClick={onNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-pill border border-gray-4 bg-surface text-gray-2 hover:border-primary hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {weeks.map((week, i) => (
          <section key={week.weekKey}>
            <p className="mb-2 px-0.5 text-label-1-normal font-extrabold text-black">
              {week.weekNo}주차
            </p>

            {week.matches.length === 0 ? (
              <div
                style={{ animationDelay: `${i * 55}ms` }}
                className="animate-enter rounded-lg border border-gray-4 bg-surface p-5 text-center text-caption-1 text-gray-3"
              >
                이번 주는 예정된 경기가 없어요
              </div>
            ) : (
              <WeekSessionCard
                week={week}
                homeTeamName={homeTeamName}
                homeTeamLogoUrl={homeTeamLogoUrl}
                delayMs={i * 55}
                onSelect={onSelectWeek}
              />
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

/**
 * 주차 하나 = 클릭 가능한 버튼 하나 = 예측 세션 하나. 더블 매치위크의 두 경기는
 * 이 카드 안에 정보 행으로 나란히 들어가고, 열림/마감/제출은 카드 단위로 한 번만 판정된다.
 */
function WeekSessionCard({
  week,
  homeTeamName,
  homeTeamLogoUrl,
  delayMs,
  onSelect,
}: {
  week: PredictWeek
  homeTeamName: string
  homeTeamLogoUrl?: string
  delayMs: number
  onSelect?: (week: PredictWeek) => void
}) {
  const meta = statusMeta(week)
  // ponytail: 퍼블리싱은 종료 주차(미참여 포함)도 결과 화면으로 열리지만 그 화면이 아직 없다.
  // 결과 화면이 생기면 여기에 `|| week.status === 'result'`를 되돌린다.
  const clickable = week.status === 'open'

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onSelect?.(week) : undefined}
      style={{ animationDelay: `${delayMs}ms` }}
      className={cn(
        'animate-enter block w-full overflow-hidden rounded-lg border border-gray-4 bg-surface text-left',
        clickable
          ? 'cursor-pointer transition-colors hover:bg-primary-dim active:bg-disabled'
          : 'cursor-not-allowed bg-[var(--c-bg)]'
      )}
    >
      {week.matches.map((match, i) => (
        <MatchInfoRow
          key={match.id}
          weekNo={week.weekNo}
          match={match}
          homeTeamName={homeTeamName}
          homeTeamLogoUrl={homeTeamLogoUrl}
          withDivider={i < week.matches.length - 1}
        />
      ))}

      <div className="flex items-center justify-between gap-2 border-t border-gray-4 p-3.5 pt-3">
        <span className={cn(BADGE_BASE, BADGE_VARIANT[meta.variant])}>{meta.label}</span>

        {week.submitted ? (
          <span className="text-label-2 font-extrabold text-black">제출 완료</span>
        ) : week.status === 'open' ? (
          <span className="flex items-center gap-0.5 text-label-2 font-bold text-primary">예측하기 ›</span>
        ) : week.status === 'upcoming' ? (
          <Lock className="h-4 w-4 text-gray-3" aria-label="예측 오픈 전" />
        ) : null}
      </div>
    </button>
  )
}

/** 경기 하나의 팀/스코어/킥오프 + 내 예측 표시 — 순수 정보 행(클릭 대상이 아니다). */
function MatchInfoRow({
  weekNo,
  match,
  homeTeamName,
  homeTeamLogoUrl,
  withDivider,
}: {
  weekNo: number
  match: PredictWeekMatch
  homeTeamName: string
  homeTeamLogoUrl?: string
  withDivider: boolean
}) {
  // 좌측 = 홈, 우측 = 원정 — isHome이 false면(원정 경기) 우리 팀이 우측으로 간다.
  const us = { name: homeTeamName, logoUrl: homeTeamLogoUrl }
  const them = { name: match.opponent, logoUrl: match.opponentLogoUrl }
  const [leftSide, rightSide] = match.isHome ? [us, them] : [them, us]
  const hasScore = typeof match.myResult?.totalPoints === 'number'

  return (
    <div className={cn('p-3.5', withDivider && 'border-b border-gray-4')}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-caption-1 font-bold text-gray-3">{match.competition ?? '프리미어리그'}</span>
        <span className="text-caption-1 font-bold text-gray-3">{weekNo}라운드</span>
      </div>

      <div className="flex items-center justify-center gap-4 py-1.5">
        <TeamSide name={leftSide.name} logoUrl={leftSide.logoUrl} />
        <div className="flex min-w-16 flex-col items-center gap-0.5">
          <span className="text-caption-2 font-bold text-gray-3">{match.kickoff}</span>
          {match.finished ? (
            <span className="text-heading-1 font-black text-black">
              {match.actual?.[0]} – {match.actual?.[1]}
            </span>
          ) : (
            <span className="text-body-2-normal font-extrabold text-black">{match.kickoffTime}</span>
          )}
        </div>
        <TeamSide name={rightSide.name} logoUrl={rightSide.logoUrl} />
      </div>

      {match.myResult && (
        <p className="mt-2 text-center text-label-2 font-extrabold text-black">
          예측 {match.myResult.predicted[0]}-{match.myResult.predicted[1]}
          {hasScore && <span className="text-primary-dark"> +{match.myResult.totalPoints}점</span>}
        </p>
      )}
    </div>
  )
}

function TeamSide({ name, logoUrl }: { name: string; logoUrl?: string }) {
  return (
    <div className="flex w-[84px] shrink-0 flex-col items-center gap-1.5">
      <TeamBadge logoUrl={logoUrl} name={name} />
      <span className="text-center text-label-2 font-bold leading-tight text-black">{name}</span>
    </div>
  )
}
