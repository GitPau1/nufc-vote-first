import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { PollPageHeader } from '@/components/polls/PollPageHeader'
import { UserPollCreateForm } from '@/components/polls/UserPollCreateForm'
import { IS_MOCK } from '@/lib/config'
import { getPollFormPlayers } from '@/lib/queries/polls'

export default async function PollCreatePage() {
  let isLoggedIn = false

  if (IS_MOCK) {
    const cookieStore = await cookies()
    isLoggedIn = cookieStore.get('mock-auth')?.value === 'true'
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    isLoggedIn = Boolean(user)
  }

  if (!isLoggedIn) redirect('/login')

  const players = await getPollFormPlayers()

  return (
    <>
      <PollPageHeader />
      <main className="px-4 pt-4 pb-24 animate-enter">
        <div className="mb-3">
          <h1 className="text-heading-2 font-black text-foreground">투표 만들기</h1>
          <p className="mt-1 text-label-2 text-muted-foreground">투표는 생성 즉시 시작되고 지정한 종료일에 마감됩니다.</p>
        </div>
        <UserPollCreateForm players={players} />
      </main>
    </>
  )
}
