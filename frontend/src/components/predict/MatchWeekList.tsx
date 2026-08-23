'use client'

import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { TeamBadge } from './shared'
import { cn } from '@/lib/utils'

/**
 * 클릭/예측의 단위는 "경기(fixture)"다 — 더블 매치위크(경기 2개)도 각 경기가 독립된 예측 세션으로
 * 따로 열리고/닫히고/제출된다. 그래서 status·myResult는 매치에 붙어 있고, week은 목록에서
 * "N주차" 박스로 묶어 보여주기 위한 표시 단위일 뿐이다.
 */
export type MatchSessionStatus = 'open' | 'result' | 'upcoming'

export interface PredictWeekMatch {
  id: string
  /** 미지정 시 "프리미어리그"로 표시(더블 매치위크의 컵 경기 등은 명시) */
  competition?: string
  opponent: string
  /** true면 우리 팀이 홈(좌측) — false면 원정이라 상대가 좌측, 우리 팀이 우측에 온다 */
  isHome: boolean
  /** "8/2" 형태 */
  kickoff: string
  /** "오후 8:00" 형태 — status가 'result'가 아닐 때만 사용 */
  kickoffTime: string
  status: MatchSessionStatus
  /** [홈팀 점수, 원정팀 점수] — isHome과 무관하게 항상 이 순서. status === 'result'일 때만 존재 */
  actual?: [number, number]
  opponentLogoUrl?: string
  /**
   * 이 경기에 참여했는지/결과가 나왔는지. predicted만 있고 totalPoints가 없으면
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
  /** 0(경기 없는 주) · 1(일반) · 2(더블 매치위크). 각 경기가 개별 예측 세션이다 */
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
  onSelectMatch?: (match: PredictWeekMatch) => void
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

function statusMeta(match: PredictWeekMatch): { label: string; variant: keyof typeof BADGE_VARIANT } {
  if (match.status === 'open') return { label: '진행중', variant: 'default' }
  if (match.status === 'result') {
    return match.myResult
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
  onSelectMatch,
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
          <section key={week.weekNo}>
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
              <div className="overflow-hidden rounded-lg border border-gray-4 bg-surface">
                {week.matches.map((match, matchIndex) => (
                  <MatchSessionRow
                    key={match.id}
                    weekNo={week.weekNo}
                    match={match}
                    homeTeamName={homeTeamName}
                    homeTeamLogoUrl={homeTeamLogoUrl}
                    delayMs={i * 55}
                    // 상태줄이 경기 사이에 끼면 중복돼 보이니 박스의 마지막 경기에만 붙인다(프로토타입 동일).
                    withMeta={matchIndex === week.matches.length - 1}
                    withDivider={matchIndex < week.matches.length - 1}
                    onSelect={onSelectMatch}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

/**
 * 경기 하나 = 클릭 가능한 버튼 하나 = 예측 세션 하나. 더블 매치위크의 두 경기는
 * 같은 주차 박스 안에 있어도 서로 독립적으로 열리고 제출된다.
 */
function MatchSessionRow({
  weekNo,
  match,
  homeTeamName,
  homeTeamLogoUrl,
  delayMs,
  withMeta,
  withDivider,
  onSelect,
}: {
  weekNo: number
  match: PredictWeekMatch
  homeTeamName: string
  homeTeamLogoUrl?: string
  delayMs: number
  withMeta: boolean
  withDivider: boolean
  onSelect?: (match: PredictWeekMatch) => void
}) {
  const meta = statusMeta(match)
  const finished = match.status === 'result'
  // 진행중(open)인 경기도 제출했으면 "예측하기" 대신 제출한 스코어를 보여준다 — 제출 후 수정은 불가하다.
  const participated = !!match.myResult
  const hasScore = participated && typeof match.myResult?.totalPoints === 'number'
  // ponytail: 퍼블리싱은 종료 경기(미참여 포함)도 결과 화면으로 열리지만 그 화면이 아직 없다.
  // 결과 화면이 생기면 여기에 `|| finished`를 되돌린다.
  const clickable = match.status === 'open'

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onSelect?.(match) : undefined}
      style={{ animationDelay: `${delayMs}ms` }}
      className={cn(
        'animate-enter block w-full text-left',
        withDivider && 'border-b border-gray-4',
        clickable
          ? 'cursor-pointer transition-colors hover:bg-primary-dim active:bg-disabled'
          : 'cursor-not-allowed bg-[var(--c-bg)]'
      )}
    >
      <MatchInfoRow
        weekNo={weekNo}
        match={match}
        finished={finished}
        homeTeamName={homeTeamName}
        homeTeamLogoUrl={homeTeamLogoUrl}
      />

      {withMeta && (
        <div className="flex items-center justify-between gap-2 border-t border-gray-4 p-3.5 pt-3">
          <span className={cn(BADGE_BASE, BADGE_VARIANT[meta.variant])}>{meta.label}</span>

          {participated ? (
            <p className="m-0 text-label-2 font-extrabold text-black">
              예측 {match.myResult!.predicted[0]}-{match.myResult!.predicted[1]}
              {hasScore && <span className="text-primary-dark"> +{match.myResult!.totalPoints}점</span>}
            </p>
          ) : match.status === 'open' ? (
            <span className="flex items-center gap-0.5 text-label-2 font-bold text-primary">예측하기 ›</span>
          ) : match.status === 'upcoming' ? (
            <Lock className="h-4 w-4 text-gray-3" aria-label="예측 오픈 전" />
          ) : null}
        </div>
      )}
    </button>
  )
}

/** 매치 하나의 팀/스코어/킥오프 표시 — 참여 상태와 무관한 순수 정보 행. */
function MatchInfoRow({
  weekNo,
  match,
  finished,
  homeTeamName,
  homeTeamLogoUrl,
}: {
  weekNo: number
  match: PredictWeekMatch
  finished: boolean
  homeTeamName: string
  homeTeamLogoUrl?: string
}) {
  // 좌측 = 홈, 우측 = 원정 — isHome이 false면(원정 경기) 우리 팀이 우측으로 간다.
  const us = { name: homeTeamName, logoUrl: homeTeamLogoUrl }
  const them = { name: match.opponent, logoUrl: match.opponentLogoUrl }
  const [leftSide, rightSide] = match.isHome ? [us, them] : [them, us]

  return (
    <div className="p-3.5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-caption-1 font-bold text-gray-3">{match.competition ?? '프리미어리그'}</span>
        <span className="text-caption-1 font-bold text-gray-3">{weekNo}라운드</span>
      </div>

      <div className="flex items-center justify-center gap-4 py-1.5">
        <TeamSide name={leftSide.name} logoUrl={leftSide.logoUrl} />
        <div className="flex min-w-16 flex-col items-center gap-0.5">
          <span className="text-caption-2 font-bold text-gray-3">{match.kickoff}</span>
          {finished ? (
            <span className="text-heading-1 font-black text-black">
              {match.actual?.[0]} – {match.actual?.[1]}
            </span>
          ) : (
            <span className="text-body-2-normal font-extrabold text-black">{match.kickoffTime}</span>
          )}
        </div>
        <TeamSide name={rightSide.name} logoUrl={rightSide.logoUrl} />
      </div>
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
