import { AppHeader } from '@/components/composition/common/AppHeader'
import { PollListClient } from '@/components/composition/polls/PollListClient'
import { getPollList } from '@/lib/queries/polls'

export default async function PollsPage() {
  const initialPolls = await getPollList(0)

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="min-h-[calc(100vh-56px)] bg-page pb-24">
        <PollListClient initialPolls={initialPolls} />
      </main>
    </>
  )
}
