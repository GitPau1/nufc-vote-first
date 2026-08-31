'use client'

import { PollHeroCard } from '@/components/composition/polls/PollHeroCard'
import { PollHomeSection } from '@/components/composition/polls/PollHomeSection'
import { MatchdayHero } from '@/components/composition/predict/MatchdayHero'
import type { PollHomeSections } from '@/lib/queries/polls'
import type { MatchdayFixture } from '@/lib/queries/fixtures'

interface HomeClientProps {
  sections: PollHomeSections
  /** null이면(fixtures 비어있음 등) 예전처럼 가장 급한 투표를 히어로로 대신 보여준다. */
  fixture: MatchdayFixture | null
}

/**
 * 홈(`/`) 화면. 히어로 배너 + 진행중/예정/종료 3개 섹션.
 * 전체 투표 목록(탭 + 무한 스크롤)은 `/polls`에 그대로 남아 있고, "종료된 투표" 섹션의
 * "전체보기"가 거기로 이동한다 — 이 화면엔 전체 목록을 다시 넣지 않는다.
 *
 * 히어로 자리는 다음/최근 경기(MatchdayHero)가 기본이고, fixture 데이터가 없을 때만
 * 예전 방식(가장 급한 투표 배너)으로 대체한다 — 두 데이터 소스는 서로 독립이라, 투표가
 * 하나도 없어도 히어로는 계속 보여야 한다.
 */
export function HomeClient({ sections, fixture }: HomeClientProps) {
  const { active, scheduled, closed } = sections
  const hasPolls = active.length > 0 || scheduled.length > 0 || closed.length > 0
  // 히어로는 지금 가장 급한 것(마감 임박한 진행중 → 곧 공개될 예정 → 최근 종료) 하나만 보여준다.
  const heroPoll = active[0] ?? scheduled[0] ?? closed[0] ?? null

  return (
    <div className="mx-auto flex max-w-content flex-col gap-8 px-5 pt-4 pb-10 animate-enter">
      {fixture ? <MatchdayHero fixture={fixture} /> : heroPoll && <PollHeroCard poll={heroPoll} />}

      {hasPolls ? (
        <>
          <PollHomeSection title="진행 중인 투표" polls={active} />
          <PollHomeSection title="예정된 투표" polls={scheduled} />
          <PollHomeSection title="종료된 투표" polls={closed} action={{ label: '전체보기', href: '/polls' }} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 gap-2">
          <p className="text-label-1-normal font-medium text-neutral">투표가 없습니다</p>
          <p className="text-caption-1 text-neutral-muted">곧 새로운 투표가 공개될 예정입니다</p>
        </div>
      )}
    </div>
  )
}
