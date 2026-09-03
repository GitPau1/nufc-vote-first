import { cookies } from 'next/headers'
import { IS_MOCK } from '@/lib/config'
import { RequireAuthModal } from '@/components/composition/auth/RequireAuthModal'
import { OnboardingForm } from './OnboardingForm'

export default async function OnboardingPage() {
  let isLoggedIn = false
  let displayName = ''

  if (IS_MOCK) {
    const cookieStore = await cookies()
    isLoggedIn = cookieStore.get('mock-auth')?.value === 'true'
    displayName = cookieStore.get('mock-display-name')?.value ?? ''
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    isLoggedIn = Boolean(user)

    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .single()
      displayName = profile?.display_name ?? ''
    }
  }

  if (!isLoggedIn) return <RequireAuthModal />

  return <OnboardingForm initialDisplayName={displayName} />
}
