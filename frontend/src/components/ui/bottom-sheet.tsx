'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
  children: React.ReactNode
}

// 데스크톱 판정 기준. PollHomeSection.tsx의 lg(1024px) 그리드 분기와는 별개 —
// 여기는 "터치로 끌어내리는 바텀시트가 자연스러운가"가 기준이라 더 좁은 md(768px)를 쓴다.
const DESKTOP_BREAKPOINT_QUERY = '(min-width: 768px)'

/**
 * 모바일(<768px)에서는 바텀시트, 데스크톱(>=768px)에서는 중앙 모달로 뜨게 한다 —
 * 바텀시트는 손가락으로 끌어내리는 모바일 제스처 문법이라 마우스로 조작하는 데스크톱에는 안 맞는다.
 * SSR에서는 화면 폭을 알 수 없으니 모바일(바텀시트)을 기본값으로 두고, 마운트 후 실제 폭으로 보정한다 —
 * 앱이 모바일 퍼스트라 대다수 사용자에게는 깜빡임 없이 그대로 맞다.
 */
function useIsDesktopViewport(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_BREAKPOINT_QUERY)
    const update = () => setIsDesktop(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isDesktop
}

/**
 * "드래그 핸들 + 자유 형식 본문 + 액션 버튼"을 갖는 하단 바텀시트 공용 셸.
 * ConfirmModal(투표 확인)·LoginModal(로그인 유도)이 공유한다.
 *
 * 헤더 정렬/아이콘 등 본문 구성은 일부러 통일하지 않고 호출부(children)에 맡긴다 —
 * ConfirmModal은 좌측 정렬, LoginModal은 중앙 정렬 + 아이콘을 쓰는 등 실제로 레이아웃이
 * 달라서, 여기서 억지로 하나의 헤더 API로 묶으면 각 사용처의 className 오버라이드만 늘어난다.
 *
 * 화면 폭에 따라 `sheet.tsx`의 `bottom`/`center` variant를 오간다 — 두 variant 모두
 * 기본 X 닫기 버튼은 숨기고(children이 자체 닫기 버튼을 둔다), 폭/위치는 각 variant가
 * 그대로 물려준다.
 */
export function BottomSheet({ open, onOpenChange, className, children }: BottomSheetProps) {
  const isDesktop = useIsDesktopViewport()
  const side = isDesktop ? 'center' : 'bottom'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showDragHandle={!isDesktop}
        className={cn('[&>button]:hidden', side === 'bottom' && 'border-t-0', className)}
      >
        {children}
      </SheetContent>
    </Sheet>
  )
}
