import { cookies } from 'next/headers'
import { IS_MOCK } from '@/lib/config'
import { PollPageHeader } from '@/components/composition/polls/PollPageHeader'
import { MyFeedbackForm } from '@/components/composition/my/MyFeedbackForm'
import { RequireAuthModal } from '@/components/composition/auth/RequireAuthModal'

export default async function MyFeedbackPage() {
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

  if (!isLoggedIn) {
    return (
      <>
        <PollPageHeader />
        <RequireAuthModal />
      </>
    )
  }

  return (
    <>
      <PollPageHeader />
      <main className="mx-auto min-h-[calc(100vh-56px)] max-w-detail bg-page px-4 pt-6 pb-24">
        <div className="mb-5">
          <h1 className="text-heading-2 sm:text-heading-1 font-semibold text-neutral">피드백 남기기</h1>
          <p className="mt-1 text-label-1-reading text-neutral-muted">
            NUFCVOTE를 쓰면서 느낀 점을 알려주세요.
          </p>
        </div>
        <MyFeedbackForm />
      </main>
    </>
  )
}
