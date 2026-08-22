import { AppHeader } from '@/components/layout/AppHeader'
import { PredictListClient } from '@/components/predict/PredictListClient'
import { getFixtureWeeks } from '@/lib/queries/fixtures'
import { getMyPredictions } from '@/lib/queries/predictions'

export default async function PredictionsPage() {
  const [weeks, myPredictions] = await Promise.all([getFixtureWeeks(), getMyPredictions()])

  return (
    <>
      <AppHeader />
      <main className="min-h-[calc(100vh-62px)] bg-background">
        <PredictListClient weeks={weeks} myPredictions={myPredictions} />
      </main>
    </>
  )
}
