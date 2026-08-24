import { AppHeader } from '@/components/layout/AppHeader'
import { PredictListClient } from '@/components/predict/PredictListClient'
import { getFixtureWeeks } from '@/lib/queries/fixtures'
import { getMyPredictions, getSeasonRanking } from '@/lib/queries/predictions'

export default async function PredictionsPage() {
  const [weeks, myPredictions, ranking] = await Promise.all([
    getFixtureWeeks(),
    getMyPredictions(),
    getSeasonRanking(),
  ])

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="min-h-[calc(100vh-62px)] bg-page">
        <PredictListClient weeks={weeks} myPredictions={myPredictions} ranking={ranking} />
      </main>
    </>
  )
}
