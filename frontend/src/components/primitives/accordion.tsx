"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * 펼침/접힘 블록. 기본은 접힌 상태다 — Radix의 `defaultValue`를 안 넘기면 아무것도 안 펼쳐진다.
 *
 * 높이 애니메이션은 `tailwind.config.ts`에 이미 준비돼 있던 걸 쓴다 — keyframes
 * `accordion-down`/`accordion-up`(164-177번째 줄)이 Radix의 `--radix-accordion-content-height`를
 * 읽으므로 `animate-accordion-down`은 임의값이 아니라 이름 있는 클래스다. 그래서 임의값을
 * 금지하는 `design-foundation.test.mjs`(accordion.tsx가 검사 목록에 있다)와 부딪히지 않는다.
 * 같은 방식의 선례가 `primitives/modal/sheet.tsx`의 `data-[state=open]:animate-in`이다.
 */
const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("rounded-lg border border-neutral-weak bg-surface", className)}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between gap-2 p-4 text-left text-label-1-normal font-medium text-neutral transition-opacity duration-micro hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-neutral-muted transition-transform duration-micro" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = "AccordionTrigger"

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    // 애니메이션 대상(Content)에는 overflow-hidden과 애니메이션 클래스만 둔다 — padding은
    // 안쪽 div가 갖는다(상류 shadcn 구조). Radix는 getBoundingClientRect().height로 높이를
    // 재는데 그 값은 border-box라 padding을 포함하고, Tailwind preflight의
    // box-sizing: border-box 때문에 keyframe의 `height: 0` 프레임에서도 pb-4 16px이 남는다.
    // 그래서 padding이 Content 몸에 있으면 열 때 첫 프레임이 16px에서 시작하고, 닫을 때
    // 마지막 프레임이 16px에서 툭 끊긴다.
    //
    // overflow-hidden은 장식이 아니라 높이 애니메이션의 전제다 — 없으면 0 높이 프레임에서
    // 본문이 밖으로 삐져나온다. 애니메이션을 걷어낼 때가 아니면 지우지 마라.
    //
    // 계약 변경: `className`은 Content가 아니라 **안쪽 div**에 붙는다. 애니메이션 클래스가
    // 소비자 클래스에 덮이지 않게 하려는 것이고, 소비자가 기대하는 대상도 본문 박스다.
    // 현재 리포에 className을 넘기는 소비자는 0곳이다(Explanation.tsx:28,
    // storybook/contents/Accordion.stories.tsx:33,47 — 셋 다 prop 없음).
    className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("px-4 pb-4 text-caption-1 text-neutral-muted", className)}>{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = "AccordionContent"

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
