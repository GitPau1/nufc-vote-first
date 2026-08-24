'use client'

import { useEffect } from 'react'
import { Lock } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { IS_MOCK } from '@/lib/config'
import { mockLogin } from '@/lib/actions/auth'
import { getSourcePage, trackEvent } from '@/lib/analytics/mixpanel'
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'

/**
 * 이 모달이 뜬 맥락. 실제로 넘기는 값만 둔다 —
 * 예전엔 'comment'·'create_poll'도 있었지만 넘기는 호출부가 없어서 없앴다
 * (댓글은 투표 참여자만 쓸 수 있어 비로그인 사용자가 도달하지 못하고,
 *  투표 생성 화면은 RequireAuthModal = 'login'을 쓴다).
 * 이제 이 값이 설명 문구까지 가르므로, 안 쓰는 값을 남겨두면 죽은 문구가 같이 생긴다.
 */
export type LoginTrigger = 'login' | 'vote' | 'predict'

/**
 * 진입 맥락별 설명 문구.
 * - 'login': 특정 행동을 전제하지 않은 일반 로그인(헤더 버튼·메뉴·보호된 화면 게이트).
 *   "필요"를 강조하는 대신 로그인해서 얻는 것을 말한다.
 * - 그 외: 하려던 행동이 막혀서 뜬 경우 — 그 행동을 그대로 문구에 담는다.
 */
const TRIGGER_DESCRIPTION: Record<LoginTrigger, string> = {
  login: '로그인하면 투표에 참여하고 내 기록을 볼 수 있어요',
  vote: '투표에 참여하려면 로그인해주세요',
  predict: '승부예측에 참여하려면 로그인해주세요',
}

interface LoginModalProps {
  open: boolean
  onClose: () => void
  /** 문구를 가르는 값이라 기본값을 두지 않는다 — 호출부가 자기 맥락을 명시해야 한다. */
  triggerAction: LoginTrigger
}

// 모바일에서는 BottomSheet가 바텀시트로, 데스크톱에서는 중앙 모달로 뜬다 —
// intent로 "항상 중앙 모달"을 강제하던 예전 분기는 없앴다. 화면 폭이 유일한 기준이다.
export function LoginModal({ open, onClose, triggerAction }: LoginModalProps) {
  const pathname = usePathname()

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

  return (
    <BottomSheet open={open} onOpenChange={o => { if (!o) onClose() }}>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-brand-weak flex items-center justify-center mx-auto mb-4">
          <Lock className="h-6 w-6 text-brand" />
        </div>
        <SheetHeader>
          <SheetTitle className="text-body-1-normal">로그인이 필요해요</SheetTitle>
          {/* 문구는 IS_MOCK이 아니라 진입 맥락으로 갈린다 — 데모 모드라는 사실은
              아래 CTA 라벨("데모로 바로 로그인")이 이미 말해준다. */}
          <SheetDescription>{TRIGGER_DESCRIPTION[triggerAction]}</SheetDescription>
        </SheetHeader>
      </div>

      {/* 원탭 로그인 CTA — outline(보조 버튼)이 아니라 default(브랜드 채움)로 둬서
          "여기를 누르면 바로 로그인된다"는 게 시각적으로 분명하게 드러나야 한다. */}
      <Button
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
        className="w-full text-neutral-muted"
        onClick={onClose}
      >
        닫기
      </Button>
    </BottomSheet>
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
