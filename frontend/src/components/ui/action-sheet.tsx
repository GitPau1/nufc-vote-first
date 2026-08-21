'use client'

import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface ActionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
  children: React.ReactNode
}

/**
 * "드래그 핸들 + 자유 형식 본문 + 액션 버튼"을 갖는 하단 바텀시트 공용 셸.
 * ConfirmModal(투표 확인)·LoginModal(로그인 유도)이 공유한다.
 *
 * 헤더 정렬/아이콘 등 본문 구성은 일부러 통일하지 않고 호출부(children)에 맡긴다 —
 * ConfirmModal은 좌측 정렬, LoginModal은 중앙 정렬 + 아이콘을 쓰는 등 실제로 레이아웃이
 * 달라서, 여기서 억지로 하나의 헤더 API로 묶으면 각 사용처의 className 오버라이드만 늘어난다.
 *
 * 폭/위치는 `sheet.tsx`의 `bottom` variant(--shell-w 인지)를 그대로 물려받는다.
 */
export function ActionSheet({ open, onOpenChange, className, children }: ActionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showDragHandle className={cn('border-t-0 [&>button]:hidden', className)}>
        {children}
      </SheetContent>
    </Sheet>
  )
}
