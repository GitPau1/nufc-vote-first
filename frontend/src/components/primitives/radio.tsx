import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * 라디오 인디케이터(링 + 안쪽 점)만 렌더링한다. 지금 사용처는 `RadioOption` 내부뿐이다 —
 * 클릭할 수 없는 자리(요약·확인 화면)에는 쓰지 않는다. 상호작용이 없는데 선택 UI 문법을 쓰면
 * 거기서도 선택을 바꿀 수 있는 것처럼 읽힌다(ConfirmModal의 "내 선택" 박스에서 그래서 걷어냈다).
 */
export function RadioIndicator({
  selected,
  className,
}: {
  selected: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2",
        selected ? "border-brand-solid" : "border-neutral-weak",
        className
      )}
    >
      {selected && <div className="h-2.5 w-2.5 rounded-pill bg-brand-solid" />}
    </div>
  )
}

export interface RadioOptionProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean
}

/** 전체 행이 클릭 대상인 라디오 옵션. 선택지 목록(투표 옵션 등)에 쓴다. */
const RadioOption = React.forwardRef<HTMLButtonElement, RadioOptionProps>(
  ({ selected, className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        "flex w-full items-center gap-3 rounded-sm border px-4 py-4 text-left",
        "transition-opacity duration-micro hover:opacity-70 focus:outline-none focus-visible:outline-none active:scale-[0.98]",
        selected ? "border-brand-solid bg-brand-weak" : "border-neutral-weak bg-surface",
        className
      )}
      {...props}
    >
      <RadioIndicator selected={selected} />
      {children}
    </button>
  )
)
RadioOption.displayName = "RadioOption"

export { RadioOption }
