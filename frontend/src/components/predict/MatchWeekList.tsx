'use client'

import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { TeamBadge } from './shared'
import { cn } from '@/lib/utils'
import { badgeVariants } from '@/components/primitives/badge'

/**
 * 클릭/예측의 단위는 "주차(week)"다 — 더블 매치위크(경기 2개)도 한 예측 세션으로 함께 열리고
 * 함께 제출된다. 그래서 status·submitted는 주차에 붙어 있고, 경기 행은 그 주에 뭘 예측하는지
 * 보여주는 정보 행일 뿐이다. 세션은 그 주 첫 경기 킥오프 7일 전에 열리고 **마지막** 경기
 * 킥오프에 닫힌다 — 이미 시작된 경기는 빠지므로 남은 경기만 예측하는 부분 제출이 가능하다.
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
  /** 이 경기는 예측 마감(킥오프 지남/이미 시작) — 주차가 열려 있어도 제출 대상이 아니다 */
  locked: boolean
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
  /** 이 주차에 예측을 제출한 경기가 하나라도 있는지 = 참여 여부 */
  submitted: boolean
  /** 아직 제출할 수 있는(안 잠기고 미제출인) 경기가 남았는지 */
  hasPending: boolean
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

// 배지 스타일 원본은 ui/badge.tsx 하나다. variant 이름이 프로토타입과 다르다 —
// 참여(초록)는 badge의 `secondary`다(`positive`라는 variant는 없다).
type StatusBadgeVariant = 'default' | 'secondary' | 'outline'

/**
 * 배지는 경기 단위다 — 더블 매치위크는 한 경기가 이미 끝났는데 다른 경기는 아직 진행중일 수 있어서
 * 두 상태를 각각 병기해야 한다(2026-08-23 확정).
 * "참여"는 이미 제출했다는 뜻이라 경기가 안 끝났어도 "진행중"이 아니라 "참여"로 보여준다.
 */
function matchStatusMeta(
  week: PredictWeek,
  match: PredictWeekMatch,
): { label: string; variant: StatusBadgeVariant } {
  if (week.status === 'upcoming') return { label: '예정', variant: 'outline' }
  const submitted = !!match.myResult
  if (submitted) return { label: '참여', variant: 'secondary' }
  return match.finished
    ? { label: '미참여', variant: 'outline' }
    : { label: '진행중', variant: 'default' }
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
        <span className="text-title-3 font-black text-neutral">{monthLabel}</span>
        <div className="flex gap-0.5">
          <button
            type="button"
            aria-label="이전 달"
            onClick={onPrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-pill border border-neutral-weak bg-surface text-neutral-muted transition-colors duration-micro hover:border-neutral-strong"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="다음 달"
            onClick={onNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-pill border border-neutral-weak bg-surface text-neutral-muted transition-colors duration-micro hover:border-neutral-strong"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {weeks.map((week, i) => (
          <section key={week.weekKey}>
            <p className="mb-2 px-0.5 text-label-1-normal font-extrabold text-neutral">
              {week.weekNo}주차
            </p>

            {week.matches.length === 0 ? (
              <div
                style={{ animationDelay: `${i * 55}ms` }}
                className="animate-enter rounded-lg border border-neutral-weak bg-surface p-5 text-center text-caption-1 text-neutral-muted"
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
  // 종료된 주차는 결과 화면으로, 열려 있는 주차는 예측/완료 화면으로 들어간다.
  // 미참여 주차도 결과 화면이 "참여하지 않았다"는 안내와 랭킹을 보여주므로 클릭 대상이다.
  const clickable = week.status === 'open' || week.status === 'result'
  const isMulti = week.matches.length > 1

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onSelect?.(week) : undefined}
      style={{ animationDelay: `${delayMs}ms` }}
      className={cn(
        'animate-enter block w-full overflow-hidden rounded-lg border border-neutral-weak bg-surface text-left',
        clickable
          // pressed 전용 값(brand-weak-pressed)은 본문 회색과 AA 미달이라 hover와 같은 톤을 쓴다(Foundations/State).
          ? 'cursor-pointer transition-colors duration-micro hover:bg-brand-weak active:bg-brand-weak'
          : 'cursor-not-allowed bg-page'
      )}
    >
      {isMulti && (
        <p className="px-3.5 pt-3.5 text-caption-1 font-extrabold text-brand">
          더블 매치위크 · 경기 {week.matches.length}개
        </p>
      )}

      {week.matches.map((match, i) => (
        <MatchInfoRow
          key={match.id}
          weekNo={week.weekNo}
          match={match}
          // 더블 매치위크는 경기마다 상태가 달라질 수 있어 배지를 행 안에 각각 붙인다.
          badge={isMulti ? matchStatusMeta(week, match) : undefined}
          homeTeamName={homeTeamName}
          homeTeamLogoUrl={homeTeamLogoUrl}
          withDivider={i < week.matches.length - 1}
        />
      ))}

      <div className="flex items-center justify-between gap-2 border-t border-neutral-weak p-3.5 pt-3">
        {/* 단일 경기 주차는 배지가 하단에 하나만 온다 — 더블 매치위크는 위 행들에 이미 붙어 있다. */}
        {isMulti ? <span /> : <StatusBadge meta={matchStatusMeta(week, week.matches[0])} />}
        <WeekAction week={week} />
      </div>
    </button>
  )
}

function StatusBadge({ meta }: { meta: ReturnType<typeof matchStatusMeta> }) {
  // 카드 전체가 <button>이라 Badge(div)를 넣을 수 없다 — 스타일만 span에 얹는다.
  return <span className={badgeVariants({ variant: meta.variant })}>{meta.label}</span>
}

/**
 * 카드 우측 액션 — 이 주차를 누르면 어디로 가는지 그대로 적는다.
 * 아직 제출할 경기가 남았으면 예측 플로우, 다 제출했지만 아직 안 끝났으면 제출완료 화면,
 * 전부 끝났으면 결과 화면(2026-08-23 확정).
 */
function WeekAction({ week }: { week: PredictWeek }) {
  const linkClass = 'flex items-center gap-0.5 text-label-2 font-bold text-brand'

  if (week.status === 'open') {
    // 부분 제출 상태(첫 경기만 제출)에서도 남은 경기를 예측하러 다시 들어와야 한다.
    if (week.hasPending) {
      return <span className={linkClass}>{week.submitted ? '남은 경기 예측하기 ›' : '예측하기 ›'}</span>
    }
    return <span className={linkClass}>제출완료 ›</span>
  }
  if (week.status === 'result') return <span className={linkClass}>결과보기 ›</span>
  return <Lock className="h-4 w-4 text-disabled" aria-label="예측 오픈 전" />
}

/** 경기 하나의 팀/스코어/킥오프 + 내 예측 표시 — 순수 정보 행(클릭 대상이 아니다). */
function MatchInfoRow({
  weekNo,
  match,
  badge,
  homeTeamName,
  homeTeamLogoUrl,
  withDivider,
}: {
  weekNo: number
  match: PredictWeekMatch
  /** 있으면 라운드 표기 대신 이 경기의 상태 배지를 붙인다(더블 매치위크) */
  badge?: ReturnType<typeof matchStatusMeta>
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
    <div className={cn('p-3.5', withDivider && 'border-b border-neutral-weak')}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-caption-1 font-bold text-neutral-muted">{match.competition ?? '프리미어리그'}</span>
        {badge ? (
          <StatusBadge meta={badge} />
        ) : (
          <span className="text-caption-1 font-bold text-neutral-muted">{weekNo}라운드</span>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 py-1.5">
        <TeamSide name={leftSide.name} logoUrl={leftSide.logoUrl} />
        <div className="flex min-w-16 flex-col items-center gap-0.5">
          <span className="text-caption-2 font-bold text-neutral-muted">{match.kickoff}</span>
          {match.finished ? (
            <span className="text-heading-1 font-black text-neutral">
              {match.actual?.[0]} – {match.actual?.[1]}
            </span>
          ) : (
            <span className="text-body-2-normal font-extrabold text-neutral">{match.kickoffTime}</span>
          )}
        </div>
        <TeamSide name={rightSide.name} logoUrl={rightSide.logoUrl} />
      </div>

      {match.myResult && (
        <p className="mt-2 text-center text-label-2 font-extrabold text-neutral">
          예측 {match.myResult.predicted[0]}-{match.myResult.predicted[1]}
          {hasScore && <span className="text-brand"> +{match.myResult.totalPoints}점</span>}
        </p>
      )}
    </div>
  )
}

function TeamSide({ name, logoUrl }: { name: string; logoUrl?: string }) {
  return (
    <div className="flex w-[84px] shrink-0 flex-col items-center gap-1.5">
      <TeamBadge logoUrl={logoUrl} name={name} />
      <span className="text-center text-label-2 font-bold text-neutral">{name}</span>
    </div>
  )
}
