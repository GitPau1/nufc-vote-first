'use client'

import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { badgeVariants } from '@/components/ui/badge'

/**
 * 클릭/예측의 단위는 "주(week)"다 — 더블 매치위크(경기 2개)도 하나의 예측 세션으로 묶여서
 * 열리고/닫히고/제출된다. 그래서 status·myResult는 매치가 아니라 week 레벨에만 존재하고,
 * 개별 매치(PredictWeekMatch)는 팀·킥오프·실제 스코어 같은 "표시용 정보"만 갖는다.
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
  /** "오후 8:00" 형태 — week.status가 'result'가 아닐 때만 사용 */
  kickoffTime: string
  /** [홈팀 점수, 원정팀 점수] — isHome과 무관하게 항상 이 순서. week.status === 'result'일 때만 존재 */
  actual?: [number, number]
  opponentLogoUrl?: string
}

export interface PredictWeek {
  weekNo: number
  /** 0(경기 없는 주) · 1(일반) · 2(더블 매치위크) — 몇 개든 이 week 하나가 예측 세션 단위다 */
  matches: PredictWeekMatch[]
  status: WeekSessionStatus
  /**
   * 이 주 세션에 참여했는지/결과가 나왔는지. predicted만 있고 totalPoints가 없으면
   * "제출은 했지만 아직 결과(점수) 발표 전" 상태를 뜻한다.
   */
  myResult?: {
    /** matches와 같은 순서·개수. 각 원소가 [홈팀 예측, 원정팀 예측] */
    predicted: Array<[number, number]>
    /** 두 경기 각각의 점수가 아니라 세션 전체 합산 점수 */
    totalPoints?: number
  }
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

const DEFAULT_TEAM_LOGO = 'https://placehold.co/48x48/e1e7ef/a8a8a8?text=%20'

// 상태 배지는 ui/badge.tsx를 쓴다. variant 이름이 프로토타입과 다르다 —
// 참여(초록)는 badge의 `secondary`다(`positive`라는 variant는 없다).
type StatusBadgeVariant = 'default' | 'secondary' | 'outline'

function statusMeta(week: PredictWeek): { label: string; variant: StatusBadgeVariant } {
  if (week.status === 'open') return { label: '진행중', variant: 'default' }
  if (week.status === 'result') {
    return week.myResult
      ? { label: '참여', variant: 'secondary' }
      : { label: '미참여', variant: 'outline' }
  }
  return { label: '예정', variant: 'outline' }
}

/** [1, 0] → "1-0" / [[1,0],[2,1]] → "1-0 / 2-1" (더블 매치위크) */
function formatPredicted(predicted: Array<[number, number]>): string {
  return predicted.map(([h, a]) => `${h}-${a}`).join(' / ')
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
        <span className="text-heading-2 font-black text-black">{monthLabel}</span>
        <div className="flex gap-0.5">
          <button
            type="button"
            aria-label="이전 달"
            onClick={onPrevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-pill border border-neutral-weak bg-surface text-neutral-muted hover:border-brand-solid hover:text-brand"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="다음 달"
            onClick={onNextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-pill border border-neutral-weak bg-surface text-neutral-muted hover:border-brand-solid hover:text-brand"
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
                className="animate-enter rounded-lg border border-neutral-weak bg-surface p-5 text-center text-caption-1 text-neutral-subtle"
              >
                이번 주는 예정된 경기가 없어요
              </div>
            ) : (
              <WeekSessionRow
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
 * 주 하나 = 클릭 가능한 버튼 하나. 매치가 1개든 2개든(더블 매치위크) 이 버튼 하나가
 * 그 주의 예측 세션 전체를 대표한다 — 매치별로 따로 클릭하거나 상태를 갖지 않는다.
 */
function WeekSessionRow({
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
  const finished = week.status === 'result'
  const participated = finished && !!week.myResult
  const hasScore = participated && typeof week.myResult?.totalPoints === 'number'
  // 미참여 주차도 결과 화면으로는 들어갈 수 있어야 한다 — 예측을 안 했다는 사실 자체가 그 화면의 안내 내용.
  const clickable = week.status === 'open' || finished

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onSelect?.(week) : undefined}
      style={{ animationDelay: `${delayMs}ms` }}
      className={cn(
        'animate-enter block w-full overflow-hidden rounded-lg border border-neutral-weak bg-surface text-left',
        clickable
          ? // brand-weak-pressed(blue-200)는 text-muted-foreground와 4.48:1로 AA 미달이라 안 쓴다.
            // hover와 같은 톤(brand-weak)을 유지해 파란 계열에서 안 벗어나면서 대비를 지킨다.
            'cursor-pointer transition-colors hover:bg-brand-weak active:bg-brand-weak'
          : 'cursor-not-allowed bg-[var(--c-bg)]'
      )}
    >
      {week.matches.map((match, i) => (
        <MatchInfoRow
          key={match.id}
          weekNo={week.weekNo}
          match={match}
          finished={finished}
          homeTeamName={homeTeamName}
          homeTeamLogoUrl={homeTeamLogoUrl}
          withDivider={i < week.matches.length - 1}
        />
      ))}

      <div className="flex items-center justify-between gap-2 border-t border-neutral-weak p-3.5 pt-3">
        {/* 이 카드 전체가 <button>이라 Badge(div)를 못 넣는다 — 스타일만 span에 얹는다. */}
        <span className={badgeVariants({ variant: meta.variant })}>{meta.label}</span>

        {participated ? (
          <p className="m-0 text-label-2 font-extrabold text-black">
            예측 {formatPredicted(week.myResult!.predicted)}
            {hasScore && <span className="text-brand"> +{week.myResult!.totalPoints}점</span>}
          </p>
        ) : week.status === 'open' ? (
          <span className="flex items-center gap-0.5 text-label-2 font-bold text-brand">예측하기 ›</span>
        ) : week.status === 'upcoming' ? (
          <Lock className="h-4 w-4 text-neutral-subtle" aria-label="예측 오픈 전" />
        ) : null}
      </div>
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
  withDivider,
}: {
  weekNo: number
  match: PredictWeekMatch
  finished: boolean
  homeTeamName: string
  homeTeamLogoUrl?: string
  withDivider: boolean
}) {
  // 좌측 = 홈, 우측 = 원정 — isHome이 false면(원정 경기) 우리 팀이 우측으로 간다.
  const us = { name: homeTeamName, logoUrl: homeTeamLogoUrl }
  const them = { name: match.opponent, logoUrl: match.opponentLogoUrl }
  const [leftSide, rightSide] = match.isHome ? [us, them] : [them, us]

  return (
    <div className={cn('p-3.5', withDivider && 'border-b border-neutral-weak')}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-caption-1 font-bold text-neutral-subtle">{match.competition ?? '프리미어리그'}</span>
        <span className="text-caption-1 font-bold text-neutral-subtle">{weekNo}라운드</span>
      </div>

      <div className="flex items-center justify-center gap-4 py-1.5">
        <TeamSide name={leftSide.name} logoUrl={leftSide.logoUrl} />
        <div className="flex min-w-16 flex-col items-center gap-0.5">
          <span className="text-caption-2 font-bold text-neutral-subtle">{match.kickoff}</span>
          {finished ? (
            <span className="text-body-2-normal font-black text-black">
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
      <img src={logoUrl ?? DEFAULT_TEAM_LOGO} alt="" className="w-12 shrink-0 object-contain" />
      <span className="text-center text-label-2 font-bold leading-tight text-black">{name}</span>
    </div>
  )
}
