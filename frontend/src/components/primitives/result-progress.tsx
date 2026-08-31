"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

export interface ResultProgressProps
  extends Omit<React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>, "value"> {
  /** 0~100 */
  percent: number
  /** 1위 등 강조 대상이면 브랜드 색으로, 아니면 회색으로 채운다 */
  highlighted?: boolean
  /** 왼쪽에 붙는 사진/이니셜. 없으면 라벨이 더 왼쪽에 붙는다 */
  thumb?: { url?: string | null; fallback: string; label: string } | null
  optionLabel: string
}

/**
 * 투표 결과 한 줄(선수·선택지 이름 + 득표율 막대 + 퍼센트).
 * Radix `Progress` 위에 얹어 `role="progressbar"`·`aria-valuenow` 등 접근성 속성을
 * 기본으로 받는다 — 이전 `ResultView`의 직접 구현엔 이게 없었다.
 */
const ResultProgress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ResultProgressProps
>(({ className, percent, highlighted, thumb, optionLabel, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={percent}
    className={cn(
      "relative min-h-[50px] overflow-hidden rounded-pill border border-neutral-weak bg-surface",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn(
        "absolute inset-y-0 left-0 rounded-l-pill transition-all",
        highlighted ? "bg-brand-weak" : "bg-disabled"
      )}
      style={{ width: `${percent}%` }}
    />
    <div
      className={cn(
        "relative flex min-h-[48px] items-center justify-between gap-3 py-[4px] pr-[17px]",
        thumb ? "pl-[5px]" : "pl-[17px]"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {thumb ? (
          <div className="flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-pill bg-brand-solid text-caption-1 font-medium text-white">
            {thumb.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb.url} alt={thumb.label} className="h-full w-full object-cover" />
            ) : (
              <span>{thumb.fallback}</span>
            )}
          </div>
        ) : null}
        <p
          className={cn(
            "min-w-0 truncate break-keep text-body-2-normal",
            highlighted ? "font-semibold text-brand" : "font-medium text-neutral-muted"
          )}
        >
          {optionLabel}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 text-body-2-normal tabular-nums",
          highlighted ? "font-semibold text-brand" : "font-medium text-neutral-muted"
        )}
      >
        {percent}%
      </span>
    </div>
  </ProgressPrimitive.Root>
))
ResultProgress.displayName = "ResultProgress"

export { ResultProgress }
