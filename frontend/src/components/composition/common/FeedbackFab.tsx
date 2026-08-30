'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
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

  useEffect(() => {
    getHeaderAuth().then(setAuth)
  }, [])

  const hidden = HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  // undefined(로딩) + null(비로그인) + 숨김 경로면 렌더하지 않는다.
  if (!auth || hidden) return null

  return (
    <>
      <button
        type="button"
        aria-label="피드백 남기기"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-pill bg-brand-solid text-on-solid shadow-w200 active:bg-brand-solid-pressed sm:bottom-6"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <Modal open={open} onOpenChange={o => { if (!o) setOpen(false) }}>
        <FeedbackContent onClose={() => setOpen(false)} />
      </Modal>
    </>
  )
}
