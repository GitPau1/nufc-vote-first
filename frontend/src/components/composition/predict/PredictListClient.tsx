'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/primitives/accordion'
import { useLoadingRouter } from '@/components/primitives/navigation-loading'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { MatchWeekList } from './MatchWeekList'
import { RankingCard } from './RankingCard'
import {
  NUFC_LABEL,
  NUFC_TEAM_ID,
  teamLogoUrl,
  toPredictWeeks,
  type WeekGroup,
} from '@/lib/predictions/week'
import type { MyPredictionMap, RankingRow } from '@/lib/queries/predictions'

/**
 * 플레이 방법 — 승부예측 규칙(docs/superpowers/specs/승부예측-규칙.md)의 핵심.
 * 제목 + 설명 쌍으로 항상 펼쳐 보여준다. 배점·규칙이 바뀌면 그 문서와 함께 고친다.
 */
/** 대회별 배점 — 규칙 문서(승부예측-규칙.md)의 표와 같은 값. total 행은 강조한다. */
const SCORE_TABLE: Array<{ label: string; league: string; cup: string; total?: boolean }> = [
  { label: '스코어 예측 성공', league: '8', cup: '5' },
  { label: '승무패 예측 성공', league: '5', cup: '3' },
  { label: '포지션 평점 1위', league: '4', cup: '3' },
  { label: '포지션 평점 2위', league: '2', cup: '2' },
  { label: '포지션 평점 3위', league: '1', cup: '1' },
  { label: '경기 만점', league: '20', cup: '14', total: true },
]

const PLAY_GUIDE: Array<{ title: string; desc?: string; scoreTable?: boolean }> = [
  {
    title: '다가오는 경기의 스코어를 예측하세요',
    desc: '포지션별로 활약할 선수 세 명도 함께 고릅니다. 수비수·미드필더·공격수 각 한 명이에요.',
  },
  {
    title: '5툰 예산 안에서 선수를 고르세요',
    desc: '선수마다 1~3툰의 가격이 있어요. 가격은 매달 최근 평점에 따라 바뀝니다.',
  },
  {
    title: '경기 결과로 채점됩니다',
    desc: '연장에서 갈리면 그 결과대로, 승부차기로 갈리면 무승부예요. 승부차기가 예상되면 무승부를 예측하세요.',
  },
  {
    title: '리그는 정식 배점, 컵은 보너스 라운드',
    desc: '컵 대회는 점수가 더 낮은 보너스 라운드예요.',
    scoreTable: true,
  },
  {
    title: '제출한 예측은 수정할 수 없어요',
    desc: '킥오프 전이라면 예측할 수 있습니다. 주 경기가 다 끝나면 점수와 순위가 공개돼요.',
  },
]

/** 플레이 방법 — 접이식(아코디언). 펼치면 제목+설명 쌍과 배점 표가 나온다. */
function PlayGuide({ className }: { className?: string }) {
  return (
    <Accordion type="single" collapsible className={className}>
      <AccordionItem value="play-guide">
        <AccordionTrigger>플레이 방법</AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-5 pt-1">
            {PLAY_GUIDE.map(({ title, desc, scoreTable }) => (
              <div key={title}>
                <p className="text-body-2-normal font-bold text-neutral">{title}</p>
                {desc && <p className="mt-1.5 text-label-2 text-neutral-muted">{desc}</p>}
                {scoreTable && (
                  <table className="mt-3 w-full text-label-2 tabular-nums">
                    <thead>
                      <tr className="text-caption-1 text-neutral-muted">
                        <th className="pb-1.5 text-left font-semibold">항목</th>
                        <th className="pb-1.5 text-right font-semibold">리그</th>
                        <th className="pb-1.5 text-right font-semibold">컵</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SCORE_TABLE.map(({ label, league, cup, total }) => (
                        <tr key={label} className="border-t border-neutral-weak">
                          <td className={cn('py-1.5 text-neutral', total && 'font-bold')}>{label}</td>
                          <td className={cn('py-1.5 text-right text-neutral', total && 'font-bold')}>{league}</td>
                          <td className={cn('py-1.5 text-right text-neutral', total && 'font-bold')}>{cup}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

export function PredictListClient({
  weeks,
  myPredictions = {},
  ranking = [],
}: {
  weeks: WeekGroup[]
  /** fixture_id → 내 제출 내역 */
  myPredictions?: MyPredictionMap
  /** 시즌 누적 랭킹 상위 + 내 행 — TOP3 카드와 내 순위 카드가 같은 배열을 쓴다 */
  ranking?: RankingRow[]
}) {
  const router = useLoadingRouter()

  const months = useMemo(() => Array.from(new Set(weeks.map(w => w.monthKey))).sort(), [weeks])
  // 예측 가능한 주차가 있는 달을 기본으로 — 없으면 첫 달.
  const defaultMonth = weeks.find(w => w.status === 'open')?.monthKey ?? months[0] ?? ''
  const [monthKey, setMonthKey] = useState(defaultMonth)

  const monthIndex = months.indexOf(monthKey)
  const visibleWeeks = weeks.filter(w => w.monthKey === monthKey)

  function moveMonth(step: -1 | 1) {
    const next = months[monthIndex + step]
    if (next) setMonthKey(next)
  }

  return (
    <div className="mx-auto max-w-shell px-4 pb-24 pt-4 sm:max-w-content sm:px-10 sm:pb-10">
      {/* 데스크탑은 프로토타입과 동일하게 주차 리스트(2) : 랭킹(1) 2단 구성 */}
      <div className="sm:grid sm:grid-cols-[2fr_1fr] sm:items-start sm:gap-x-10">
        <MatchWeekList
          monthLabel={monthKey ? `${Number(monthKey.slice(5))}월` : ''}
          weeks={toPredictWeeks(visibleWeeks, myPredictions)}
          homeTeamName={NUFC_LABEL}
          homeTeamLogoUrl={teamLogoUrl(NUFC_TEAM_ID)}
          onPrevMonth={() => moveMonth(-1)}
          onNextMonth={() => moveMonth(1)}
          onSelectWeek={week => {
            // 퍼널 A의 진입 지점. destination은 라우트가 아니라 서버가 어느 화면을 렌더할지다
            // (같은 URL이 status·hasPending에 따라 플로우/완료/결과로 갈린다).
            // WeekAction의 CTA 문구를 복사하지 않고 판정 근거를 그대로 실어보내, 문구가 바뀌어도
            // 이벤트가 어긋나지 않게 한다.
            trackEvent('prediction_week_clicked', {
              week_key: week.weekKey,
              week_status: week.status,
              submitted: week.submitted,
              has_pending: week.hasPending,
              match_count: week.matches.length,
              destination:
                week.status === 'result' ? 'result' : week.hasPending ? 'flow' : 'done',
            })
            router.push(`/predictions/${week.weekKey}`)
          }}
        />

        <div className="hidden flex-col gap-4 sm:flex">
          <PlayGuide />
          <RankingCard variant="top3" entries={ranking} />
          <RankingCard variant="mine" entries={ranking} />
        </div>
      </div>

      {/* 우측 열이 모바일에서 숨겨지므로(위 sm:flex) 플레이 방법만 목록 맨 아래에 한 번 더 둔다. */}
      <PlayGuide className="mt-4 sm:hidden" />
    </div>
  )
}
