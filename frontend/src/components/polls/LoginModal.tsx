'use client'

import { useEffect } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Lock } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { IS_MOCK } from '@/lib/config'
import { mockLogin } from '@/lib/actions/auth'
import { getSourcePage, trackEvent } from '@/lib/analytics/mixpanel'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

interface LoginModalProps {
  open: boolean
  onClose: () => void
  intent?: 'prompt' | 'direct'
  triggerAction?: 'vote' | 'comment' | 'create_poll' | 'login'
}

export function LoginModal({ open, onClose, intent = 'prompt', triggerAction = 'vote' }: LoginModalProps) {
  const pathname = usePathname()
  const isDirect = intent === 'direct'

  useEffect(() => {
    if (!open) return
    trackEvent('auth_prompt_viewed', {
      source_page: getSourcePage(pathname),
      trigger_action: triggerAction,
    })
  }, [open, pathname, triggerAction])

  async function handleLogin() {
    if (IS_MOCK) {
      await mockLogin()
      trackEvent('login_completed', {
        source_page: getSourcePage(pathname),
        method: 'mock',
      })
      onClose()
      return
    }
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(pathname)}`,
      },
    })
  }

  if (isDirect) {
    return (
      <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o) onClose() }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-w300 focus:outline-none">
            <DialogPrimitive.Title className="text-center text-body-1-normal font-bold text-foreground">
              NUFCVOTE 로그인
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Google 계정으로 로그인합니다
            </DialogPrimitive.Description>

            <Button
              variant="outline"
              className="mt-5 w-full h-12 font-semibold gap-2"
              onClick={handleLogin}
            >
              {IS_MOCK ? (
                <>
                  <span className="text-headline-1">⚡</span>
                  데모로 바로 로그인
                </>
              ) : (
                <>
                  <GoogleIcon />
                  Google로 로그인
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              className="mt-2 w-full text-muted-foreground"
              onClick={onClose}
            >
              닫기
            </Button>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    )
  }

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose() }}>
      <SheetContent
        side="bottom"
        className="left-1/2 right-auto w-full max-w-[480px] -translate-x-1/2 rounded-t-lg border-t-0 pb-10 [&>button]:hidden"
      >
        {/* 드래그 핸들 */}
        <div className="mx-auto w-10 h-1.5 rounded-full bg-muted mb-6" />

        <div className={`text-center ${isDirect ? 'mb-4' : 'mb-6'}`}>
          {!isDirect && (
            <div className="w-14 h-14 rounded-full bg-primary-dim flex items-center justify-center mx-auto mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
          )}
          <SheetHeader>
            <SheetTitle className="text-body-1-normal">
              {isDirect ? 'NUFCVOTE 로그인' : '로그인이 필요해요'}
            </SheetTitle>
            <SheetDescription className={isDirect ? 'sr-only' : undefined}>
              {isDirect
                ? 'Google 계정으로 로그인합니다'
                : IS_MOCK ? '데모 로그인으로 바로 참여할 수 있어요' : '투표에 참여하려면 로그인이 필요합니다'}
            </SheetDescription>
          </SheetHeader>
        </div>

        <Button
          variant="outline"
          className="w-full h-12 font-semibold gap-2 mb-2"
          onClick={handleLogin}
        >
          {IS_MOCK ? (
            <>
              <span className="text-headline-1">⚡</span>
              데모로 바로 로그인
            </>
          ) : (
            <>
              <GoogleIcon />
              Google로 로그인
            </>
          )}
        </Button>

        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={onClose}
        >
          닫기
        </Button>
      </SheetContent>
    </Sheet>
  )
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
