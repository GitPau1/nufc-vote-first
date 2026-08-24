import { AppHeader } from '@/components/layout/AppHeader'
import { HomeClient } from '@/components/polls/HomeClient'
import { getPollHomeSections } from '@/lib/queries/polls'
import { getHomeMatchdayFixture } from '@/lib/queries/fixtures'

export default async function HomePage() {
  const [sections, fixture] = await Promise.all([
    getPollHomeSections(),
    getHomeMatchdayFixture(),
  ])

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="min-h-[calc(100vh-56px)] bg-page pb-24">
        <HomeClient sections={sections} fixture={fixture} />
      </main>
    </>
  )
}
