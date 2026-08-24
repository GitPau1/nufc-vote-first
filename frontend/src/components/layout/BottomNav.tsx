'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Target, Trophy, Vote } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/',             label: '투표',      Icon: Vote },
  { href: '/predictions',  label: '예측',      Icon: Target },
  { href: '/players',      label: '역대 선수', Icon: Trophy },
  { href: '/menu',         label: '메뉴',      Icon: Menu },
] as const

// 데스크탑 헤더 GNB(AppHeader wide)로 대체된 화면만 데스크탑에서 숨긴다.
const REPLACED_BY_HEADER_GNB = ['/', '/polls', '/predictions', '/players', '/menu']

export function BottomNav() {
  const pathname = usePathname()

  if (pathname !== '/' && pathname !== '/polls' && pathname !== '/predictions' && pathname !== '/players' && pathname !== '/menu') return null

  const hiddenOnDesktop = REPLACED_BY_HEADER_GNB.includes(pathname)

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-shell bg-surface border-t border-border z-40',
        hiddenOnDesktop && 'sm:hidden'
      )}
    >
      <div className="flex pb-4 pt-2">
        {ITEMS.map(({ href, label, Icon }) => {
          const isActive = href === '/' ? pathname === '/' || pathname.startsWith('/polls') : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`flex flex-1 flex-col items-center gap-0.5 text-label-2 font-semibold transition-colors ${isActive ? 'text-brand' : 'text-muted-foreground'}`}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
