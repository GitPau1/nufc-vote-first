'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle, X } from 'lucide-react'
import { getHeaderAuth, type HeaderAuth } from '@/lib/actions/auth'
import { Modal } from '@/components/primitives/modal/Modal'
import { FeedbackContent } from '@/components/primitives/modal/contents/Feedback'

// FAB를 숨길 경로 접두. 관리자·온보딩은 피드백 수집 대상이 아니다.
const HIDDEN_PREFIXES = ['/admin', '/onboarding']

export function FeedbackFab() {
  const pathname = usePathname()
  // HeaderAuthStatus와 동일한 관례 — 클라이언트에서 서버 액션으로 로그인 여부를 판정한다.
  const [auth, setAuth] = useState<HeaderAuth | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  // 진입 시 잠깐 떴다 사라지는 안내 말풍선.
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => {
    getHeaderAuth().then(setAuth)
  }, [])

  const hidden = HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  // undefined(로딩) + null(비로그인) + 숨김 경로면 FAB를 렌더하지 않는다.
  const visible = !!auth && !hidden

  // FAB가 보이기 시작하면 말풍선을 띄우고 4초 뒤 사라지게 한다.
  useEffect(() => {
    if (!visible) return
    setShowTooltip(true)
    const timer = setTimeout(() => setShowTooltip(false), 4000)
    return () => clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  return (
    <>
      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6">
        {/* 안내 말풍선 — 진입 시 잠깐 노출, 모달이 열리면 숨긴다. */}
        <div
          role="status"
          aria-hidden={!showTooltip || open}
          className={`relative whitespace-nowrap rounded-lg bg-neutral-strong px-3 py-2 text-label-2 font-medium text-on-solid shadow-w200 transition-opacity duration-enter ${showTooltip && !open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        >
          이용에 아쉬운 점이 있나요?
          <button
            type="button"
            aria-label="안내 닫기"
            onClick={() => setShowTooltip(false)}
            className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-pill bg-neutral-strong text-on-solid shadow-w200"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <button
          type="button"
          aria-label="피드백 남기기"
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-pill bg-brand-solid text-on-solid shadow-w200 active:bg-brand-solid-pressed"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>

      <Modal open={open} onOpenChange={o => { if (!o) setOpen(false) }}>
        <FeedbackContent onClose={() => setOpen(false)} />
      </Modal>
    </>
  )
}
