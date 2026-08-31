'use client'

// 사용 도메인: polls (투표 제출 확인), predict (승부예측 제출 확인) — Modal 껍데기에 끼워 쓴다

import { SheetHeader, SheetTitle, SheetDescription } from '../sheet'
import { Button } from '@/components/primitives/button'

interface ConfirmContentProps {
  selectedLabel: string
  onCancel: () => void
  onConfirm: () => void
  isPending: boolean
  /** 기본값은 선택형 투표 문구다. 전체 평가처럼 "선택"이 아닌 제출에서만 바꾼다. */
  title?: string
  summaryCaption?: string
  confirmLabel?: string
}

/**
 * 투표 제출 직전 확인 모달의 **내용**. 껍데기(Modal)는 호출부가 씌운다(기본 form=responsive).
 * "제출 후에는 변경할 수 없습니다" 설명은 이 모달이 존재하는 이유라 고정 — prop으로 못 끈다.
 */
export function ConfirmContent({
  selectedLabel,
  onCancel,
  onConfirm,
  isPending,
  title = '이 선택으로 투표하시겠어요?',
  summaryCaption = '내 선택',
  confirmLabel = '최종 제출',
}: ConfirmContentProps) {
  return (
    <>
      <SheetHeader className="text-left mb-5">
        <SheetTitle className="text-body-1-normal">{title}</SheetTitle>
        <SheetDescription>제출 후에는 변경할 수 없습니다</SheetDescription>
      </SheetHeader>

      {/* 선택 요약 — 라디오 인디케이터·브랜드색 테두리로 "선택하는 중"을 다시 그리지 않는다.
          이 자리는 고르는 화면이 아니라 이미 고른 것을 확인하는 화면이라, bg-page로 눌러 앉힌
          블록에 내가 고른 선택지를 텍스트로만 보여준다. */}
      <div className="rounded-sm bg-page px-4 py-3.5 mb-5">
        <p className="text-caption-2 text-neutral-muted mb-0.5">{summaryCaption}</p>
        <p className="text-label-1-normal font-medium text-neutral">{selectedLabel}</p>
      </div>

      {/* 버튼 */}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isPending}>
          취소
        </Button>
        <Button className="flex-[2]" onClick={onConfirm} disabled={isPending}>
          {isPending ? '제출 중…' : confirmLabel}
        </Button>
      </div>
    </>
  )
}
