import { AppHeader } from '@/components/layout/AppHeader'
import { PredictListClient } from '@/components/predict/PredictListClient'
import { getFixtureWeeks } from '@/lib/queries/fixtures'

export default async function PredictionsPage() {
  const weeks = await getFixtureWeeks()

  return (
    <>
      <AppHeader />
      <main className="min-h-[calc(100vh-62px)] bg-background">
        <PredictListClient weeks={weeks} />
      </main>
    </>
  )
}
