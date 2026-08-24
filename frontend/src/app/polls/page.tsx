import { AppHeader } from '@/components/layout/AppHeader'
import { PollListClient } from '@/components/polls/PollListClient'
import { getPollList } from '@/lib/queries/polls'

export default async function PollsPage() {
  const initialPolls = await getPollList(0)

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="min-h-[calc(100vh-56px)] bg-background pb-24">
        <PollListClient initialPolls={initialPolls} />
      </main>
    </>
  )
}
