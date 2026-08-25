'use client'

import { useEffect, useState } from 'react'
import { getHeaderAuth, type HeaderAuth } from '@/lib/actions/auth'
import { LoginButton } from './LoginButton'
import { UserMenu } from './UserMenu'

export function HeaderAuthStatus({ auth: initialAuth }: { auth?: HeaderAuth | null }) {
  const [auth, setAuth] = useState<HeaderAuth | null | undefined>(initialAuth)

  useEffect(() => {
    if (initialAuth !== undefined) return

    let cancelled = false

    async function loadUser() {
      const nextAuth = await getHeaderAuth()
      if (!cancelled) setAuth(nextAuth)
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [initialAuth])

  if (auth === undefined) {
    return <div className="h-8 w-8 rounded-full bg-disabled" aria-hidden="true" />
  }

  if (!auth) return <LoginButton />

  return <UserMenu avatarUrl={auth.avatarUrl} displayName={auth.displayName} isAdmin={auth.isAdmin} />
}
