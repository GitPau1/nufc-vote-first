'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import type { HeaderAuth } from '@/lib/actions/auth'
import { HeaderAuthStatus } from './HeaderAuthStatus'
import { DesktopNavLinks } from './DesktopNavLinks'

type AppHeaderProps = {
  auth?: HeaderAuth | null
  /** 모바일에서만 적용 — 데스크탑은 페이지와 무관하게 항상 같은 GNB를 보여준다. */
  showAuth?: boolean
  /** 모바일에서 로고 중앙 정렬 대신 '돌아가기' 버튼(서브 페이지). 데스크탑 GNB에는 영향 없음. */
  mobileBack?: boolean
}

/**
 * 앱 전체에서 재사용하는 유일한 헤더.
 *
 * 데스크탑(≥640px)에서는 어떤 화면에 들어가도 완전히 동일한 GNB(로고·투표·역대 선수·아바타)가
 * --content-w(1140px) 기준으로 뜬다 — "다른 페이지에 들어가도 헤더는 홈과 그대로"라는 원칙.
 * 모바일에서는 화면 성격에 따라 두 갈래로 갈린다: 최상위 화면은 로고 중앙 정렬(+옵션 아바타),
 * 서브 화면(`mobileBack`)은 돌아가기 버튼 — 기존 PollPageHeader와 동일한 모습.
 */
export function AppHeader({ auth, showAuth = true, mobileBack = false }: AppHeaderProps = {}) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-gradient-to-b from-white to-white/75 backdrop-blur">
      <div className="relative mx-auto flex h-[62px] max-w-content items-center px-4">
        {/* 모바일 전용 레이어 */}
        <div className="flex w-full items-center justify-center sm:hidden">
          {mobileBack ? (
            <button
              onClick={() => router.back()}
              className="absolute left-4 flex items-center gap-1.5 text-label-1-normal font-semibold text-muted-foreground
                         hover:text-foreground active:opacity-50 transition-all duration-100 focus:outline-none"
            >
              <ChevronLeft className="h-4 w-4" />
              돌아가기
            </button>
          ) : (
            <Link href="/" className="flex items-center">
              <span className="text-title-3 font-black text-foreground">NUFCVOTE</span>
            </Link>
          )}

          {!mobileBack && showAuth && (
            <div className="absolute right-4">
              <HeaderAuthStatus auth={auth} />
            </div>
          )}
        </div>

        {/* 데스크탑 전용 레이어 — 화면과 무관하게 항상 동일 */}
        <div className="hidden w-full items-center sm:flex">
          <Link href="/" className="flex items-center">
            <span className="text-title-3 font-black text-foreground">NUFCVOTE</span>
          </Link>
          <DesktopNavLinks className="ml-14" />
          <div className="ml-auto">
            <HeaderAuthStatus auth={auth} />
          </div>
        </div>
      </div>
    </header>
  )
}
