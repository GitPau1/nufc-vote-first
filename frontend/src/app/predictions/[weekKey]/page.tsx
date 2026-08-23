import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { PredictionFlowClient } from '@/components/predict/PredictionFlowClient'
import { getFixtureWeeks } from '@/lib/queries/fixtures'
import { findWeekPrediction, findWeekSession, submittableMatches } from '@/lib/predictions/week'
import { getPickCandidates } from '@/lib/queries/squads'
import { getMyPredictions } from '@/lib/queries/predictions'

export default async function PredictionFlowPage({ params }: { params: { weekKey: string } }) {
  const weeks = await getFixtureWeeks()
  const week = findWeekSession(weeks, decodeURIComponent(params.weekKey))

  // 예측 가능한 주차만 진입 — 결과/예정 주차 화면은 아직 없다.
  if (!week || week.status !== 'open') notFound()

  const [candidates, myPredictions] = await Promise.all([getPickCandidates(), getMyPredictions()])

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
