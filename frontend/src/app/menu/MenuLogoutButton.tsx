'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { IS_MOCK } from '@/lib/config'
import { Button } from '@/components/ui/button'

export function MenuLogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    if (IS_MOCK) {
      const { mockLogout } = await import('@/lib/actions/auth')
      await mockLogout()
      router.push('/')
      router.refresh()
      return
    }

    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-12 justify-start text-negative hover:text-negative"
      onClick={handleLogout}
    >
      <LogOut className="h-4 w-4" />
      로그아웃
    </Button>
  )
}
