import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// 색 있는 뱃지 공통 크롬(테두리·hover·focus). bare에는 얹지 않는다.
const chrome =
  "border border-transparent transition-opacity hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-brand-solid"

// base = 모양만(알약꼴·패딩·caption-2). 이게 뱃지 shape의 유일한 정의처다 —
// 도메인 색(평점 tier·적중 등)이 필요해 <Badge>를 못 쓰는 pill들도 이 shape을 공유한다:
//   <span className={cn(badgeVariants({ variant: 'bare' }), 색클래스)}>
const badgeVariants = cva(
  "inline-flex items-center rounded-pill px-2 py-1 text-caption-2 font-medium",
  {
    variants: {
      variant: {
        default: `${chrome} bg-brand-weak text-brand`,
        secondary: `${chrome} bg-positive-weak text-positive`,
        destructive: `${chrome} bg-critical-weak text-critical`,
        outline: `${chrome} bg-disabled text-neutral-muted`,
        // 색·테두리·상호작용 없이 shape만. 색은 호출부가 얹는다.
        bare: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
