'use client'

import { useRef, useState, useEffect } from 'react'
import Link from 'next/link'
import { IS_MOCK } from '@/lib/config'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/primitives/avatar'

interface UserMenuProps {
  avatarUrl?: string
  displayName?: string
  isAdmin?: boolean
}

export function UserMenu({ avatarUrl, displayName, isAdmin }: UserMenuProps) {
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
        className="rounded-pill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid"
        aria-label="user menu"
        aria-expanded={open}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatarUrl} alt={displayName ?? 'profile'} />
          <AvatarFallback className="bg-brand-weak text-brand text-caption-1 font-medium">
            {displayName?.[0]?.toUpperCase() ?? 'U'}
          </AvatarFallback>
        </Avatar>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 min-w-[144px] bg-surface border border-neutral-weak rounded-md shadow-w300 overflow-hidden">
          <Link
            href="/my"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-label-2 font-medium text-neutral border-b border-neutral-weak hover:bg-disabled"
          >
            마이페이지
          </Link>

          <Link
            href="/my/feedback"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-label-2 font-medium text-neutral border-b border-neutral-weak hover:bg-disabled"
          >
            피드백 남기기
          </Link>

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-label-2 font-medium text-neutral border-b border-neutral-weak hover:bg-disabled"
            >
              관리자 페이지
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2.5 text-label-2 font-medium text-critical hover:bg-critical-weak"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}
