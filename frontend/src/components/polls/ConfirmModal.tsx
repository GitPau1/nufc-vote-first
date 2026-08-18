'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

interface ConfirmModalProps {
  open: boolean
  selectedLabel: string
  onCancel: () => void
  onConfirm: () => void
  isPending: boolean
}

export function ConfirmModal({
  open,
  selectedLabel,
  onCancel,
  onConfirm,
  isPending,
}: ConfirmModalProps) {
  return (
    <Sheet open={open} onOpenChange={open => { if (!open) onCancel() }}>
      <SheetContent
        side="bottom"
        style={{ left: 'max(0px, calc(50% - 240px))' }}
        className="right-auto w-full max-w-[480px] rounded-t-lg border-t-0 pb-10 [&>button]:hidden"
      >
        {/* 드래그 핸들 */}
        <div className="mx-auto w-10 h-1.5 rounded-full bg-muted mb-6" />

        <SheetHeader className="text-left mb-5">
          <SheetTitle className="text-body-1-normal">이 선택으로 투표하시겠어요?</SheetTitle>
          <SheetDescription>제출 후에는 변경할 수 없습니다</SheetDescription>
        </SheetHeader>

        {/* 선택 요약 */}
        <div className="flex items-center gap-3 rounded-sm bg-primary-dim border border-primary px-4 py-3.5 mb-5">
          <div className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
          </div>
          <div>
            <p className="text-caption-2 text-muted-foreground mb-0.5">내 선택</p>
            <p className="text-label-1-normal font-semibold text-foreground">{selectedLabel}</p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isPending}
          >
            취소
          </Button>
          <Button
            className="flex-[2]"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? '제출 중…' : '최종 제출'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
