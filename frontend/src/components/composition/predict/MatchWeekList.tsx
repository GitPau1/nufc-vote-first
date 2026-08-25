'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/primitives/badge'
import { Button } from '@/components/primitives/button'
import { TeamBadge } from './shared'
import { cn } from '@/lib/utils'

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
  /** "8월 2일" 형태 */
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

/**
 * 화면이 구분하는 주차 단계. `weekStatus`의 `'upcoming'`이 "아직 안 열림"과 "닫혔는데 결과가
 * 아직 안 적재됨" 두 뜻을 겸하고 있어서(lib/predictions/week.ts:35), 경기별 locked/finished로
 * 후자를 `'settling'`으로 갈라낸다. 순수 함수(weekStatus) 쪽은 건드리지 않는다.
 */
type WeekPhase = 'upcoming' | 'open' | 'settling' | 'result'

function weekPhase(week: PredictWeek): WeekPhase {
  if (week.status !== 'upcoming') return week.status
  return week.matches.some(match => match.locked && !match.finished) ? 'settling' : 'upcoming'
}

type BadgeVariant = 'default' | 'secondary' | 'outline'

/**
 * 배지는 **주차 단위**다 — 경기마다 붙이지 않는다(2026-08-25 확정).
 * 종료 주차는 참여했든 안 했든 "종료"이고, 참여 여부는 경기 카드 아래 내 점수 유무로 드러난다.
 */
function weekBadge(week: PredictWeek): { label: string; variant: BadgeVariant } {
  switch (weekPhase(week)) {
    case 'open':
      return week.hasPending
        ? { label: '진행중', variant: 'default' }
        : { label: '참여 완료', variant: 'secondary' }
    case 'settling':
      return { label: '결과 반영중', variant: 'outline' }
    case 'result':
      return { label: '종료', variant: 'outline' }
    default:
      return { label: '예정', variant: 'outline' }
  }
}

/**
 * 컨테이너 하단 CTA — 이 주차를 누르면 어디로 가는지 그대로 적는다. 컨테이너 자체는 클릭
 * 대상이 아니라(MatchdayHero와 같은 구조) 이 버튼만 진입점이다.
 * `settling`은 제출한 사람만 열어준다 — 미참여자는 그 화면에 보여줄 게 없다.
 */
function weekAction(week: PredictWeek): {
  label: string
  variant: 'default' | 'outline'
  disabled: boolean
} {
  switch (weekPhase(week)) {
    case 'open':
      // 부분 제출(일부 경기만 제출)이어도 문구는 같다 — 남은 경기를 예측하러 같은 자리로 들어간다.
      return week.hasPending
        ? { label: '예측하기', variant: 'default', disabled: false }
        : { label: '내 예측 보기', variant: 'outline', disabled: false }
    case 'settling':
      return week.submitted
        ? { label: '내 예측 보기', variant: 'outline', disabled: false }
        : { label: '예측 마감', variant: 'outline', disabled: true }
    case 'result':
      return { label: '결과보기', variant: 'outline', disabled: false }
    default:
      return { label: '예측 오픈 전', variant: 'outline', disabled: true }
  }
}

/**
 * 잠긴 경기(종료·진행중)와 아직 안 열린 주차의 경기 = 가라앉히는 대상.
 * 이제 **텍스트 톤만** 가른다(2026-08-25 결정) — 경기 카드 배경은 상태와 무관하게 한 색이고,
 * "지금 할 수 있는 것"은 컨테이너 색(예측 접수 중인 주차만 브랜드 글로우)이 가리킨다.
 * 카드 안에서 가라앉는 효과는 이 텍스트 톤 + 로고 흑백(finished)이 나른다.
 */
function isDimmed(week: PredictWeek, match: PredictWeekMatch): boolean {
  return match.locked || weekPhase(week) === 'upcoming'
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

      <div className="flex flex-col gap-4">
        {weeks.map((week, i) => (
          <WeekSessionCard
            key={week.weekKey}
            week={week}
            homeTeamName={homeTeamName}
            homeTeamLogoUrl={homeTeamLogoUrl}
            delayMs={i * 55}
            onSelect={onSelectWeek}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * 주차 하나 = 컨테이너 하나 = 예측 세션 하나. 컨테이너는 `div`다(클릭 대상이 아니다) —
 * 안에 경기 카드가 세로로 쌓이고, 진입은 하단 버튼 하나로만 한다.
 * 경기가 1개든 2개든 같은 카드를 쓴다(더블 매치위크를 따로 취급하지 않는다).
 *
 * 예측 접수 중인(`open`) 주차만 라이트 브랜드 글로우(.spotlight-glow-brand)로 강조한다 —
 * 배지가 `진행중`이든 `참여 완료`든 둘 다 포함한다. 나머지 단계(예정·결과 반영중·종료)는
 * 흰 컨테이너다. 위치(정렬)로 끌어올리는 대신 색으로 강조하는 방식이다(2026-08-25 사용자 결정).
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
  const badge = weekBadge(week)
  const action = weekAction(week)
  const isEmpty = week.matches.length === 0
  // 예측 접수 중인 주차 = 색으로 강조하는 컨테이너. 배경만 가른다 —
  // 테두리·텍스트 톤·경기 카드 표면은 다른 주차와 같다.
  const highlighted = weekPhase(week) === 'open'

  return (
    <section
      style={{ animationDelay: `${delayMs}ms` }}
      className={cn(
        'animate-enter rounded-lg border border-neutral-weak p-4',
        // .spotlight-glow-brand는 배경을 통째로 정하는 유틸리티라 bg-surface를 함께 주지 않는다.
        // 테두리는 별개다 — 글로우만으로는 페이지와의 경계가 안 생긴다(2026-08-25 실사용 확인).
        highlighted ? 'spotlight-glow-brand' : 'bg-surface'
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <p className="text-headline-1 font-extrabold text-neutral">{week.weekNo}주차</p>
        {/* Badge 4종 variant는 전부 "옅은 틴트 배경 + 700단계 텍스트"라(badge.tsx:11-17)
            대비가 배지 안에서 닫혀 있다 — 글로우 컨테이너 위에서도 그대로 읽힌다. */}
        {!isEmpty && <Badge variant={badge.variant}>{badge.label}</Badge>}
      </div>

      {isEmpty ? (
        // 경기 카드와 같은 자리에 들어가므로 표면도 같은 `bg-page`를 쓴다(2026-08-25 지정).
        <p className="rounded-lg bg-page p-5 text-center text-caption-1 text-neutral-muted">
          이번 주는 예정된 경기가 없어요
        </p>
      ) : (
        <>
          {/*
            데스크탑에서도 세로로 쌓는다(가로 배치 폐기, 2026-08-25 사용자 결정) — 팀명이 로고 옆으로
            오면서(TeamSide) 카드 하나에 필요한 최소 폭이 커졌고, 2단 레이아웃에서 목록 열은 전체 폭의
            2/3뿐이라(PredictListClient `sm:grid sm:grid-cols-[2fr_1fr]`) 그 열을 또 가로로 나누면
            팀명이 잘린다.
          */}
          <div className="flex flex-col gap-2">
            {week.matches.map(match => (
              <MatchInfoCard
                key={match.id}
                match={match}
                dimmed={isDimmed(week, match)}
                homeTeamName={homeTeamName}
                homeTeamLogoUrl={homeTeamLogoUrl}
              />
            ))}
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              size="sm"
              variant={action.variant}
              disabled={action.disabled}
              onClick={action.disabled ? undefined : () => onSelect?.(week)}
              // 컨테이너가 `<button>`에서 `<section>`으로 바뀌면서(시안 §2.4) 주차를 식별하는
              // 접근 가능한 이름이 이 버튼 하나에만 남았다. 문구는 주차마다 같으므로
              // ("예측하기"/"결과보기") 주차 번호를 이름에 넣지 않으면 스크린리더 폼컨트롤
              // 목록·탭 순회에서 여러 주차의 CTA가 전부 동일한 이름으로 보인다.
              aria-label={`${week.weekNo}주차 ${action.label}`}
            >
              {action.label}
            </Button>
          </div>
        </>
      )}
    </section>
  )
}

/**
 * 경기 하나 = 정보 카드 하나(클릭 대상이 아니다). 좌상단은 대회명만 둔다 — 이전에 있던
 * "N라운드"는 실제 라운드가 아니라 ISO 주차 번호였고(lib/predictions/week.ts:88-94),
 * `fixtures`에 라운드 컬럼이 없어서 삭제했다.
 *
 * 표면은 주차 상태·컨테이너 종류와 무관하게 항상 `bg-page` 한 색이다. 테두리는 없다 —
 * 컨테이너가 흰 면(`bg-surface` 또는 글로우 베이스)이라 한 단계 낮은 `bg-page`만으로 갈린다.
 */
function MatchInfoCard({
  match,
  dimmed,
  homeTeamName,
  homeTeamLogoUrl,
}: {
  match: PredictWeekMatch
  dimmed: boolean
  homeTeamName: string
  homeTeamLogoUrl?: string
}) {
  // 좌측 = 홈, 우측 = 원정 — isHome이 false면(원정 경기) 우리 팀이 우측으로 간다.
  const us = { name: homeTeamName, logoUrl: homeTeamLogoUrl }
  const them = { name: match.opponent, logoUrl: match.opponentLogoUrl }
  const [leftSide, rightSide] = match.isHome ? [us, them] : [them, us]
  const hasScore = typeof match.myResult?.totalPoints === 'number'
  // 가라앉는 경기의 2차 텍스트 톤 — 카드 표면이 두 경우 다 밝은 면이라 컨테이너와 무관하게 같다.
  const strongText = 'text-neutral'
  const mutedText = 'text-neutral-muted'

  // `min-w-0`: flex item의 min-width 초깃값 auto는 min-content 아래로 안 줄어든다.
  // 카드가 그 하한 아래로도 줄 수 있어야 좁은 모바일 폭에서 가로로 터지지 않는다.
  // `pb-5`(20px): 아래쪽만 더 줘서 시각적 무게를 아래로 배분한다.
  return (
    <div className="min-w-0 rounded-lg bg-page p-3 pb-5">
      {/*
        대회명은 dimmed에서도 톤을 더 낮추지 않는다 — text-neutral-subtle(#a2a5a9)은
        카드 배경 위에서 AA(4.5:1) 미달이다(bg-page 2.37:1). 가라앉는 효과는 아래
        일자·시각·팀명 톤과 로고 흑백이 나르고 있다.
      */}
      <p className={cn('mb-3 text-caption-1 font-bold', mutedText)}>
        {match.competition ?? '프리미어리그'}
      </p>

      {/*
        팀명 길이가 달라도 가운데(일자·시각)가 정중앙에 오도록 좌우를 동일 폭 fr로 고정한다.
        `1fr`이 아니라 `minmax(0,1fr)`인 이유: `1fr`은 minmax(auto,1fr)이라 트랙이 항목의
        min-content 아래로 못 줄고, 그 하한 때문에 좁은 열에서 카드가 가로로 터졌다.
        최소를 0으로 열어두면 좌우 트랙은 여전히 서로 같은 폭이고(fr 균등 분배) 트랙 안에서
        팀 칸만 줄어든다.
      */}
      {/* gap-6(1.5rem)은 로고와 가운데(일자·시각) 사이 간격이다 — 팀 칸이 `justify-end`/`justify-start`로
          가운데 쪽에 붙어 있어서, 그리드 열 간격이 곧 로고↔가운데 거리가 된다(2026-08-25 지정). */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6">
        <TeamSide
          name={leftSide.name}
          logoUrl={leftSide.logoUrl}
          grayscale={match.finished}
          nameClassName={dimmed ? mutedText : strongText}
          side="left"
        />

        <div className="flex flex-col items-center gap-0.5">
          {/*
            일자는 시각 위 caption — 월/일만 쓴다(연도 없음).
            색은 muted(#666666)다: text-neutral-subtle(#a2a5a9)은 카드 배경 위
            2.37:1로 11px 텍스트에 WCAG AA(4.5:1) 미달이고, Color.mdx가 subtle을 "힌트·입력창
            보조 텍스트"로 규정해 역할도 안 맞는다 — 경기 일자는 시안 §2.3이 새로 넣은 경기
            핵심 정보다.
          */}
          <span className={cn('text-caption-2', mutedText)}>{match.kickoff}</span>
          {match.finished ? (
            <span className={cn('text-heading-1 font-black', dimmed ? mutedText : strongText)}>
              {match.actual?.[0]} : {match.actual?.[1]}
            </span>
          ) : (
            <span className={cn('text-label-1-normal font-extrabold', dimmed ? mutedText : strongText)}>
              {match.kickoffTime}
            </span>
          )}
        </div>

        <TeamSide
          name={rightSide.name}
          logoUrl={rightSide.logoUrl}
          grayscale={match.finished}
          nameClassName={dimmed ? mutedText : strongText}
          side="right"
        />
      </div>

      {match.myResult && (
        <p
          className={cn(
            'mt-3 border-t border-neutral-weak pt-2 text-center text-caption-1',
            mutedText
          )}
        >
          예측 {match.myResult.predicted[0]}-{match.myResult.predicted[1]}
          {hasScore && (
            <span className="font-extrabold text-brand">
              {' '}
              +{match.myResult.totalPoints}점
            </span>
          )}
        </p>
      )}
    </div>
  )
}

/**
 * 팀 한 칸 — 팀명이 카드 **가장자리** 쪽, 로고가 **가운데**(일자·시각) 쪽이다.
 * `side`는 이 칸이 카드의 어느 쪽인지를 뜻하고(왼쪽 칸/오른쪽 칸), 그게 곧 [팀명][로고] 순서와
 * 어느 방향으로 붙일지를 정한다 — 예전 `align`(세로 스택의 정렬)에서 의미가 바뀐 자리다.
 *
 * 칸 폭은 그리드 트랙(minmax(0,1fr)) 그대로 두고 안에서만 가운데 쪽으로 붙인다(w-20 고정 폐지) —
 * 좌우 트랙이 서로 같은 폭이라 로고는 항상 가운데에서 같은 거리에 놓이고 일자·시각은 정중앙에 남는다.
 * 팀명은 `min-w-0 truncate`로 좁은 폭에서 …로 잘리고, 로고는 TeamBadge가 `shrink-0` +
 * 인라인 width/height(shared.tsx:29-51)라 어느 폭에서도 32px을 유지한다.
 */
function TeamSide({
  name,
  logoUrl,
  grayscale,
  nameClassName,
  side,
}: {
  name: string
  logoUrl?: string
  grayscale: boolean
  /** 팀명 색 — 카드가 계산한 톤(dimmed 여부)을 그대로 받는다 */
  nameClassName: string
  /** 이 칸이 카드의 왼쪽인지 오른쪽인지 */
  side: 'left' | 'right'
}) {
  const logo = <TeamBadge logoUrl={logoUrl} name={name} size={32} grayscale={grayscale} />
  const label = (
    <span className={cn('min-w-0 truncate text-caption-1 font-bold', nameClassName)}>{name}</span>
  )

  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        // 왼쪽 칸은 오른쪽(가운데) 끝으로, 오른쪽 칸은 왼쪽(가운데) 끝으로 붙인다.
        side === 'left' ? 'justify-end' : 'justify-start'
      )}
    >
      {side === 'left' ? (
        <>
          {label}
          {logo}
        </>
      ) : (
        <>
          {logo}
          {label}
        </>
      )}
    </div>
  )
}
