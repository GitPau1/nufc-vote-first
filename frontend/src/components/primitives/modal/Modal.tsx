'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent } from './sheet'
import { cn } from '@/lib/utils'

export type ModalForm = 'responsive' | 'default' | 'sheet'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * 어떤 형태로 띄울지.
   * - `'responsive'`(기본): 데스크탑=중앙 모달(default), 모바일=바텀시트(sheet)
   * - `'default'`: 항상 중앙 모달 (로그인처럼 모바일에서도 중앙으로 띄울 때)
   * - `'sheet'`: 항상 바텀시트
   */
  form?: ModalForm
  className?: string
  children: React.ReactNode
}

// 데스크톱 판정 기준. "터치로 끌어내리는 바텀시트가 자연스러운가"가 기준이라 md(768px)를 쓴다.
const DESKTOP_BREAKPOINT_QUERY = '(min-width: 768px)'

/**
 * SSR에서는 화면 폭을 알 수 없으니 모바일을 기본값으로 두고, 마운트 후 실제 폭으로 보정한다 —
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
 * 모달·바텀시트 공용 껍데기(shell). 오버레이·위치/폭·반응형 전환·포커스 트랩·ESC와
 * **닫기 어포던스 하나**를 전담한다. **내부 본문은 `children`(= modal/contents/*)에 완전히 위임**한다 —
 * 헤더 정렬/아이콘 등은 사용처마다 달라서 껍데기에서 하나의 API로 묶지 않는다.
 *
 * 상태는 둘: `default`(중앙 모달, `sheet.tsx`의 center variant) / `sheet`(바텀시트, bottom variant).
 * `form`으로 무엇을 띄울지 정하고, `'responsive'`면 화면 폭으로 자동 전환한다.
 *
 * 닫기 어포던스는 상태별로 하나만 둔다: 중앙 모달 = 우측 상단 X, 바텀시트 = 상단 드래그 핸들.
 * 시트에 X까지 얹으면 같은 역할이 두 개가 되므로 `showCloseButton`으로 끈다.
 *
 * 주의: X 닫기 버튼을 CSS(`[&>button]:hidden`)로 가리지 않는다 — 그 선택자가 children의
 * 직계 버튼까지 숨겨 CTA가 사라진 적이 있다. 끄려면 `SheetContent`가 렌더하지 않게 하는 쪽으로.
 */
export function Modal({ open, onOpenChange, form = 'responsive', className, children }: ModalProps) {
  const isDesktop = useIsDesktopViewport()
  const asSheet = form === 'sheet' || (form === 'responsive' && !isDesktop)
  const side = asSheet ? 'bottom' : 'center'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showDragHandle={asSheet}
        showCloseButton={!asSheet}
        className={cn(side === 'bottom' && 'border-t-0', className)}
      >
        {children}
      </SheetContent>
    </Sheet>
  )
}
