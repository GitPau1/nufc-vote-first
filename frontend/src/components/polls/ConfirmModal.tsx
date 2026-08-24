'use client'

import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import { RadioIndicator } from '@/components/ui/radio'

interface ConfirmModalProps {
  open: boolean
  selectedLabel: string
  onCancel: () => void
  onConfirm: () => void
  isPending: boolean
  /** 기본값은 선택형 투표 문구다. 전체 평가처럼 "선택"이 아닌 제출에서만 바꾼다. */
  title?: string
  summaryCaption?: string
  confirmLabel?: string
}

export function ConfirmModal({
  open,
  selectedLabel,
  onCancel,
  onConfirm,
  isPending,
  title = '이 선택으로 투표하시겠어요?',
  summaryCaption = '내 선택',
  confirmLabel = '최종 제출',
}: ConfirmModalProps) {
  return (
    <BottomSheet open={open} onOpenChange={open => { if (!open) onCancel() }}>
      <SheetHeader className="text-left mb-5">
        <SheetTitle className="text-body-1-normal">{title}</SheetTitle>
        <SheetDescription>제출 후에는 변경할 수 없습니다</SheetDescription>
      </SheetHeader>

      {/* 선택 요약 */}
      <div className="flex items-center gap-3 rounded-sm bg-brand-weak border border-brand-solid px-4 py-3.5 mb-5">
        <RadioIndicator selected />
        <div>
          <p className="text-caption-2 text-muted-foreground mb-0.5">{summaryCaption}</p>
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
          {isPending ? '제출 중…' : confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  )
}
