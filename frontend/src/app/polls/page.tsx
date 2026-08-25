import { AppHeader } from '@/components/composition/common/AppHeader'
import { PollListClient } from '@/components/composition/polls/PollListClient'
import { getPollList } from '@/lib/queries/polls'

// 안쪽 unstable_cache(30)와 정렬 — 이게 없으면 정적 라우트로 굳어 투표 참여자 수가 빌드 시점 값에 멈춘다.
// submitVote/submitRatingVotes는 /polls/{id}만 무효화한다.
export const revalidate = 30

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
