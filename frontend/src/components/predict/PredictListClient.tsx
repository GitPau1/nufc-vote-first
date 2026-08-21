'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MatchWeekList } from './MatchWeekList'
import { RankingCard } from './RankingCard'
import {
  NUFC_LABEL,
  NUFC_TEAM_ID,
  teamLogoUrl,
  toPredictWeeks,
  type WeekGroup,
} from '@/lib/predictions/week'

export function PredictListClient({ weeks }: { weeks: WeekGroup[] }) {
  const router = useRouter()

  const months = useMemo(() => Array.from(new Set(weeks.map(w => w.monthKey))).sort(), [weeks])
  // 진행 중인 주가 있는 달을 기본으로 — 없으면 첫 달.
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
      {/* 데스크탑은 프로토타입과 동일하게 경기 리스트(2) : 랭킹(1) 2단 구성 */}
      <div className="sm:grid sm:grid-cols-[2fr_1fr] sm:items-start sm:gap-x-10">
        <MatchWeekList
          monthLabel={monthKey ? `${Number(monthKey.slice(5))}월` : ''}
          weeks={toPredictWeeks(visibleWeeks)}
          homeTeamName={NUFC_LABEL}
          homeTeamLogoUrl={teamLogoUrl(NUFC_TEAM_ID)}
          onPrevMonth={() => moveMonth(-1)}
          onNextMonth={() => moveMonth(1)}
          onSelectWeek={week => {
            const target = visibleWeeks.find(w => w.weekNo === week.weekNo)
            if (target) router.push(`/predictions/week/${target.weekKey}`)
          }}
        />

        {/* ponytail: 랭킹 쿼리(predictions 테이블)가 생기면 entries만 실제 데이터로 바꾼다. */}
        <div className="hidden flex-col gap-4 sm:flex">
          <RankingCard variant="top3" entries={[]} />
          <RankingCard variant="mine" entries={[]} />
        </div>
      </div>
    </div>
  )
}
