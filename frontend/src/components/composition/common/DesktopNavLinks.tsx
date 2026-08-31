'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Target, Trophy, Vote } from 'lucide-react'
import { cn } from '@/lib/utils'

// BottomNav.ITEMS에서 '메뉴'만 뺀 것 — 데스크탑 헤더 GNB 전용.
// '메뉴'(/menu)의 피드백·관리자 진입은 UserMenu 드롭다운으로 옮겨졌다.
const NAV_ITEMS = [
  { href: '/',            label: '투표',      Icon: Vote },
  { href: '/predictions', label: '예측',      Icon: Target },
  { href: '/players',     label: '역대 선수', Icon: Trophy },
] as const

export function DesktopNavLinks({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <nav className={cn('hidden gap-10 sm:flex', className)}>
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const isActive = href === '/' ? pathname === '/' || pathname.startsWith('/polls') : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex h-[56px] items-center gap-1.5 border-b-2 text-body-2-normal font-semibold transition-colors',
              isActive ? 'border-brand-solid text-brand' : 'border-transparent text-neutral-muted hover:text-neutral'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
