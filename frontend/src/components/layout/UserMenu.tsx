'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { IS_MOCK } from '@/lib/config'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface UserMenuProps {
  avatarUrl?: string
  displayName?: string
  isAdmin?: boolean
}

export function UserMenu({ avatarUrl, displayName }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  async function handleLogout() {
    setOpen(false)
    if (IS_MOCK) {
      const { mockLogout } = await import('@/lib/actions/auth')
      await mockLogout()
    } else {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = '/'
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="user menu"
        aria-expanded={open}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} alt={displayName ?? 'profile'} />
          <AvatarFallback className="bg-primary-dim text-primary-dark text-caption-1 font-bold">
            {displayName?.[0]?.toUpperCase() ?? 'U'}
          </AvatarFallback>
        </Avatar>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 min-w-[144px] bg-surface border border-border rounded-md shadow-w300 overflow-hidden">
          <Link
            href="/my"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-label-2 font-medium text-foreground border-b border-border hover:bg-secondary"
          >
            마이페이지
          </Link>

          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2.5 text-label-2 font-medium text-negative hover:bg-negative-dim"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
