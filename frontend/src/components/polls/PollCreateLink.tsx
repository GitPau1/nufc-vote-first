'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getHeaderAuth, type HeaderAuth } from '@/lib/actions/auth'

export function PollCreateLink() {
  const [auth, setAuth] = useState<HeaderAuth | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      const nextAuth = await getHeaderAuth()
      if (!cancelled) setAuth(nextAuth)
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [])

  if (auth === undefined) {
    return <div className="h-9 w-[78px] shrink-0 rounded-lg bg-disabled" aria-hidden="true" />
  }

  if (!auth) return null

  return (
    <Link href="/polls/create" prefetch={false} className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-caption-1 font-bold text-primary-foreground">
      투표 만들기
    </Link>
  )
}
