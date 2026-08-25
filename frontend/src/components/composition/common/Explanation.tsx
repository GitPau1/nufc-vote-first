'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/primitives/accordion'

/**
 * 접힌 상태로 시작하는 설명 블록 — 화면의 주 내용이 아니라 "필요하면 펼쳐 보는" 보조 정보다.
 * 어느 화면에서든 쓸 수 있게 문구를 갖고 있지 않다: 제목과 항목을 호출부가 넘긴다.
 */
export function Explanation({
  title,
  items,
  className,
}: {
  title: string
  /** 순서가 의미 있는 설명 항목들 — 번호 매긴 목록으로 렌더된다 */
  items: string[]
  className?: string
}) {
  return (
    <Accordion type="single" collapsible className={className}>
      <AccordionItem value="explanation">
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionContent>
          <ol className="list-decimal space-y-1.5 pl-4">
            {items.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
