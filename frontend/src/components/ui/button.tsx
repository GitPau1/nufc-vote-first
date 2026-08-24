import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-body-2-normal font-bold transition-[opacity,background-color] duration-micro hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid disabled:pointer-events-none disabled:bg-disabled disabled:text-disabled disabled:opacity-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // 채워진 배경이 있는 variant는 active(press)를 opacity가 아니라 -pressed 토큰(색 자체)으로 표현한다.
        default: "bg-brand-solid text-on-solid shadow-w200 active:bg-brand-solid-pressed",
        // 예외: critical-weak-pressed(red-200) 위에 text-critical(red-700)을 올리면 3.94:1로 AA 미달
        // (평상시 critical-weak도 4.54:1로 턱걸이라 한 단계만 진해져도 기준 아래로 떨어진다).
        // 색 교체 대신 opacity를 유지한다.
        destructive:
          "border border-critical-weak bg-critical-weak text-critical shadow-none active:opacity-50",
        secondary:
          "bg-disabled text-neutral shadow-none active:bg-neutral-weak-pressed",
        // 투명 배경 variant는 스왑할 배경색이 없어 기존 opacity 방식을 유지한다.
        outline:
          "border border-neutral-weak bg-transparent text-neutral shadow-none active:opacity-50",
        ghost: "bg-transparent text-neutral-muted shadow-none active:opacity-50",
        link: "text-brand underline-offset-4 hover:underline active:opacity-50",
      },
      size: {
        default: "h-11 px-4 py-3.5",
        sm: "h-9 px-3 text-label-2",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
