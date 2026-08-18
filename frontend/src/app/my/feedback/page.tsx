import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { IS_MOCK } from '@/lib/config'
import { PollPageHeader } from '@/components/polls/PollPageHeader'
import { MyFeedbackForm } from '@/components/my/MyFeedbackForm'

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

  if (!isLoggedIn) redirect('/login?next=/my/feedback')

  return (
    <>
      <PollPageHeader />
      <main className="min-h-[calc(100vh-62px)] bg-background px-4 pt-6 pb-24">
        <div className="mb-5">
          <h1 className="text-heading-2 font-black text-foreground">피드백 남기기</h1>
          <p className="mt-1 text-label-2 text-muted-foreground">
            NUFCVOTE를 쓰면서 느낀 점을 알려주세요.
          </p>
        </div>
        <MyFeedbackForm />
      </main>
    </>
  )
}
