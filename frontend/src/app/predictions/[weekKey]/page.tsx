import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { PredictionFlowClient } from '@/components/predict/PredictionFlowClient'
import { PredictionResult } from '@/components/predict/PredictionResult'
import { getFixtureWeeks } from '@/lib/queries/fixtures'
import { findWeekPrediction, findWeekSession, submittableMatches } from '@/lib/predictions/week'
import { getPickCandidates } from '@/lib/queries/squads'
import { getMyPredictions, getMyResults, getWeekRanking } from '@/lib/queries/predictions'

export default async function PredictionFlowPage({ params }: { params: { weekKey: string } }) {
  const weeks = await getFixtureWeeks()
  const week = findWeekSession(weeks, decodeURIComponent(params.weekKey))

  // 아직 열리지 않은(예정) 주차는 보여줄 게 없다 — 오픈된 주차는 예측 플로우, 끝난 주차는 결과 화면.
  //
  // 'upcoming'에는 두 가지가 섞여 있다(week.ts의 weekStatus): 아직 안 열린 주차와, 킥오프이
  // 지났지만 fixtures.finished가 아직 적재되지 않은 주차. 후자를 막으면 경기가 끝난 새벽부터
  // 크론이 도는 아침까지 페이지가 사라진다 — 제출 내역을 확인하러 오는 시간대가 정확히 거기다.
  // 잠긴 경기가 하나도 없는 주차(= 정말 안 열린 주차)만 막는다.
  if (!week || (week.status === 'upcoming' && week.matches.every(match => !match.locked))) {
    notFound()
  }

  const [candidates, myPredictions] = await Promise.all([getPickCandidates(), getMyPredictions()])

  if (week.status === 'result') {
    // 랭킹은 참여 여부와 무관하게 공개된다 — 미참여 주차도 결과 화면으로 들어와 랭킹을 볼 수 있다.
    const [results, ranking] = await Promise.all([getMyResults(), getWeekRanking(week.weekKey)])
    return (
      <>
        <AppHeader mobileBack />
        <main className="min-h-[calc(100vh-62px)] bg-background">
          <PredictionResult
            week={week}
            results={results}
            predictions={myPredictions}
            candidates={candidates}
            ranking={ranking}
          />
        </main>
      </>
    )
  }

  // 남은(아직 안 잠긴) 경기 중 미제출이 있으면 그것만 입력받고, 없으면 완료 화면.
  const pending = submittableMatches(week).filter(match => !myPredictions[match.id])

  return (
    <>
      <AppHeader mobileBack />
      <main className="min-h-[calc(100vh-62px)] bg-background">
        <PredictionFlowClient
          week={week}
          pending={pending}
          candidates={candidates}
          submitted={pending.length === 0 ? findWeekPrediction(week, myPredictions) : undefined}
        />
      </main>
    </>
  )
}
