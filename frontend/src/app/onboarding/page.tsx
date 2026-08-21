import { cookies } from 'next/headers'
import { IS_MOCK } from '@/lib/config'
import { RequireAuthModal } from '@/components/auth/RequireAuthModal'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage() {
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

  if (!isLoggedIn) return <RequireAuthModal />

  return <OnboardingForm />
}
