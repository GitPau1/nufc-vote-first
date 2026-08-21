import { notFound } from 'next/navigation'
import { AppHeader } from '@/components/layout/AppHeader'
import { PredictionFlowClient } from '@/components/predict/PredictionFlowClient'
import { getFixtureWeeks } from '@/lib/queries/fixtures'

export default async function PredictionFlowPage({ params }: { params: { weekKey: string } }) {
  const weeks = await getFixtureWeeks()
  const week = weeks.find(w => w.weekKey === decodeURIComponent(params.weekKey))

  // 예측 가능한 주만 진입 — 결과/예정 주차 화면은 아직 없다.
  if (!week || week.status !== 'open') notFound()

  return (
    <>
      <AppHeader mobileBack />
      <main className="min-h-[calc(100vh-62px)] bg-background">
        <PredictionFlowClient week={week} />
      </main>
    </>
  )
}
