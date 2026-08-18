'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogIn, MessageSquareText, ShieldCheck, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LoginModal } from '@/components/polls/LoginModal'
import { MenuLogoutButton } from './MenuLogoutButton'

type MenuActionsProps = {
  isLoggedIn: boolean
  isAdmin: boolean
}

export function MenuActions({ isLoggedIn, isAdmin }: MenuActionsProps) {
  const router = useRouter()
  const [loginOpen, setLoginOpen] = useState(false)

  function closeLogin() {
    setLoginOpen(false)
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button asChild variant="outline" className="h-12 justify-start">
          <Link href="/my/feedback">
            <MessageSquareText className="h-4 w-4" />
            피드백 남기기
          </Link>
        </Button>

        {isLoggedIn ? (
          <>
            <Button asChild className="h-12 justify-start">
              <Link href="/my">
                <UserRound className="h-4 w-4" />
                내 정보
              </Link>
            </Button>

            {isAdmin && (
              <Button asChild variant="secondary" className="h-12 justify-start">
                <Link href="/admin">
                  <ShieldCheck className="h-4 w-4" />
                  관리자 페이지
                </Link>
              </Button>
            )}

            <MenuLogoutButton />
          </>
        ) : (
          <Button
            type="button"
            className="h-12 justify-start"
            onClick={() => setLoginOpen(true)}
          >
            <LogIn className="h-4 w-4" />
            로그인하기
          </Button>
        )}
      </div>

      <LoginModal open={loginOpen} onClose={closeLogin} intent="direct" triggerAction="login" />
    </>
  )
}
