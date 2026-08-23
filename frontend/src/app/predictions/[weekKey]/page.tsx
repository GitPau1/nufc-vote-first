import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { PredictionFlowClient } from '@/components/predict/PredictionFlowClient'
import { getFixtureWeeks } from '@/lib/queries/fixtures'
import { findWeekPrediction, findWeekSession } from '@/lib/predictions/week'
import { getPickCandidates } from '@/lib/queries/squads'
import { getMyPredictions } from '@/lib/queries/predictions'

export default async function PredictionFlowPage({ params }: { params: { weekKey: string } }) {
  const weeks = await getFixtureWeeks()
  const week = findWeekSession(weeks, decodeURIComponent(params.weekKey))

  // 예측 가능한 주차만 진입 — 결과/예정 주차 화면은 아직 없다.
  if (!week || week.status !== 'open') notFound()

  const [candidates, myPredictions] = await Promise.all([getPickCandidates(), getMyPredictions()])

  return (
    <>
      <AppHeader mobileBack />
      <main className="min-h-[calc(100vh-62px)] bg-background">
        <PredictionFlowClient
          week={week}
          candidates={candidates}
          submitted={findWeekPrediction(week, myPredictions)}
        />
      </main>
    </>
  )
}
