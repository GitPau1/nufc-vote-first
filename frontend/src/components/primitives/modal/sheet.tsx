"use client"

import * as React from "react"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Sheet = SheetPrimitive.Root

const SheetTrigger = SheetPrimitive.Trigger

const SheetClose = SheetPrimitive.Close

const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

// 본문 요소 사이 간격은 껍데기가 정하지 않는다 — content(modal/contents/*)의 margin/padding이
// 단독으로 책임진다. base에 gap을 두면 호출부가 세로 flex를 주입한 시트에서만 되살아나서(목록형
// 시트가 그렇다) 같은 껍데기인데 간격 규칙이 두 갈래가 된다.
const sheetVariants = cva(
  "fixed z-50 bg-surface p-5 shadow-w300 transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-exit data-[state=open]:duration-enter",
  {
    variants: {
      side: {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        // 모바일 셸 폭(--shell-w)에 맞춰 중앙정렬 — 데스크탑에서도 뷰포트 전체가 아니라
        // PageContainer 카드 폭에 맞게 뜬다.
        //
        // slide-in/out-from-left-1/2는 시각 효과가 아니라 버그 픽스다: tailwindcss-animate의
        // enter/exit 키프레임은 transform을 통째로 갈아끼우기 때문에, --tw-enter/exit-translate-x를
        // 지정하지 않으면 애니메이션 도중 -translate-x-1/2(중앙 정렬용 -50%)가 0으로 리셋된다.
        // 그 결과 시트가 대각선으로(오른쪽에서 중앙으로) 들어오는 것처럼 보인다. -50%를 명시해
        // 애니메이션 내내 x축 오프셋을 고정하고 y축(위/아래)만 움직이게 한다.
        bottom:
          "left-1/2 right-auto bottom-0 w-full max-w-shell -translate-x-1/2 rounded-t-lg border-t pb-10 data-[state=closed]:slide-out-to-bottom data-[state=closed]:slide-out-to-left-1/2 data-[state=open]:slide-in-from-bottom data-[state=open]:slide-in-from-left-1/2",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "inset-y-0 right-0 h-full w-3/4  border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
        // 데스크톱에서 바텀시트 대신 쓰는 중앙 모달. bottom과 마찬가지로 -translate-x/y-1/2로
        // 중앙정렬하는데, tailwindcss-animate의 enter/exit 키프레임이 transform을 통째로
        // 갈아끼우는 특성 때문에 slide-in/out-from-*-1/2로 x/y 오프셋을 -50%로 고정해야
        // 애니메이션 도중 좌상단으로 튀지 않는다(bottom variant와 동일한 이유).
        center:
          "left-1/2 top-1/2 w-[calc(100%-32px)] max-w-[448px] -translate-x-1/2 -translate-y-1/2 rounded-lg border data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  /** 상단에 드래그 핸들 바를 표시(하단 시트에서 선택적으로 사용) */
  showDragHandle?: boolean
  /**
   * 우측 상단 X 닫기 버튼을 표시. 드래그 핸들이 있는 하단 시트에서는 닫기 어포던스가
   * 중복되므로 끈다(핸들 ↔ X는 한 번에 하나만 — `Modal`이 form에 따라 정한다).
   */
  showCloseButton?: boolean
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({ side = "right", showDragHandle = false, showCloseButton = true, className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {showDragHandle && (
        <div className="mx-auto mb-6 h-1.5 w-10 rounded-full bg-disabled" />
      )}
      {children}
      {showCloseButton && (
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand-solid disabled:pointer-events-none data-[state=open]:bg-disabled">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      )}
    </SheetPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    // 정렬은 content가 정한다 — 좌측 정렬이 필요하면 `text-left`를 직접 준다(Confirm이 그렇게 쓴다).
    // base에 있던 `sm:text-left`는 shell의 형태 전환 기준(md/768px)과도 어긋나는 잔재였고,
    // 정렬을 지정하지 않은 Login 헤더가 640px 이상에서 아이콘만 중앙에 남고 텍스트만 좌측으로 갈렸다.
    className={cn(
      "flex flex-col space-y-2 text-center",
      className
    )}
    {...props}
  />
)
SheetHeader.displayName = "SheetHeader"

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-headline-1 font-bold text-neutral", className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-label-1-reading text-neutral-muted", className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
}
