'use client'

import { useMemo, useState } from 'react'
import { Explanation } from '@/components/composition/common/Explanation'
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
 * 플레이 방법 — 승부예측 규칙(docs/superpowers/specs/승부예측-규칙.md)의 핵심을 짧게 추린다.
 * 배점·규칙이 바뀌면 그 문서와 함께 고친다.
 */
const PLAY_GUIDE = [
  '다가오는 경기의 최종 스코어를 예측하고, 포지션별 선수 3명(수비·미드필더·공격)을 고르세요',
  '선수마다 1~3툰 — 한 경기 5툰 예산 안에서 세 명을 골라요 (가격은 매달 갱신)',
  '스코어 정확: 리그 8점·컵 5점 / 승무패만 맞혀도 리그 5점·컵 3점',
  '포지션 평점 1위를 맞히면 리그 4점·컵 3점 (2·3위 차등, 미출전 0점)',
  '컵 대회는 보너스 라운드라 점수가 낮아요 · 연장·승부차기는 무승부로 채점',
  '킥오프 전까지 예측 가능 · 제출 후 수정 불가 · 주 경기가 다 끝나면 점수·순위 공개',
]

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
          <RankingCard variant="top3" entries={ranking} />
          <RankingCard variant="mine" entries={ranking} />
          <Explanation title="플레이 방법" items={PLAY_GUIDE} />
        </div>
      </div>

      {/* 우측 열이 모바일에서 숨겨지므로(위 sm:flex) 플레이 방법만 목록 맨 아래에 한 번 더 둔다. */}
      <Explanation title="플레이 방법" items={PLAY_GUIDE} className="mt-4 sm:hidden" />
    </div>
  )
}
