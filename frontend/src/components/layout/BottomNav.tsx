'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Trophy, Vote } from 'lucide-react'

const ITEMS = [
  { href: '/',         label: '투표',      Icon: Vote },
  { href: '/players',  label: '역대 선수', Icon: Trophy },
  { href: '/menu',     label: '메뉴',      Icon: Menu },
] as const

export function BottomNav() {
  const pathname = usePathname()

  if (pathname !== '/' && pathname !== '/polls' && pathname !== '/players' && pathname !== '/menu') return null

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-surface border-t border-border z-40">
      <div className="flex pb-4 pt-2">
        {ITEMS.map(({ href, label, Icon }) => {
          const isActive = href === '/' ? pathname === '/' || pathname.startsWith('/polls') : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className={`flex flex-1 flex-col items-center gap-0.5 text-caption-2 font-semibold transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
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
