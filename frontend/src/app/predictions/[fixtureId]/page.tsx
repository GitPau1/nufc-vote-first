import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { PredictionFlowClient } from '@/components/predict/PredictionFlowClient'
import { getFixtureWeeks } from '@/lib/queries/fixtures'
import { findMatchSession } from '@/lib/predictions/week'
import { getPickCandidates } from '@/lib/queries/squads'
import { getMyPredictions } from '@/lib/queries/predictions'

export default async function PredictionFlowPage({ params }: { params: { fixtureId: string } }) {
  const weeks = await getFixtureWeeks()
  const match = findMatchSession(weeks, decodeURIComponent(params.fixtureId))

  // 예측 가능한 경기만 진입 — 결과/예정 경기 화면은 아직 없다.
  if (!match || match.status !== 'open') notFound()

  const [candidates, myPredictions] = await Promise.all([getPickCandidates(), getMyPredictions()])

  return (
    <>
      <AppHeader mobileBack />
      <main className="min-h-[calc(100vh-62px)] bg-background">
        <PredictionFlowClient
          match={match}
          candidates={candidates}
          submitted={myPredictions[match.id]}
        />
      </main>
    </>
  )
}
