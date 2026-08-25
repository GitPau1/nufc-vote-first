import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/primitives/accordion'

const meta = {
  title: 'Primitives/Accordion',
  component: Accordion,
  args: { type: 'single' },
  parameters: {
    docs: {
      description: {
        component:
          '펼침/접힘 블록. `type="single"` + `collapsible`이 기본 조합이고, `defaultValue`를 안 넘기면 접힌 상태로 시작한다. 여닫을 때 높이 애니메이션(0.2s)이 붙는다 — `tailwind.config.ts`의 `accordion-down`/`accordion-up` keyframes를 쓴다.',
      },
    },
  },
} satisfies Meta<typeof Accordion>

export default meta
type Story = StoryObj<typeof meta>

/** 기본 — 접힌 상태로 시작한다. 헤더를 누르면 열리고, 다시 누르면 닫힌다(`collapsible`). */
export const Collapsed: Story = {
  render: () => (
    <Accordion type="single" collapsible className="max-w-80">
      <AccordionItem value="how-to-play">
        <AccordionTrigger>플레이 방법</AccordionTrigger>
        <AccordionContent>
          스코어를 정확히 맞히면 3점, 승·무·패만 맞혀도 2점을 받는다.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}

/** `defaultValue`로 처음부터 펼친 상태. 값은 `AccordionItem`의 `value`와 같아야 한다. */
export const Expanded: Story = {
  render: () => (
    <Accordion type="single" collapsible defaultValue="how-to-play" className="max-w-80">
      <AccordionItem value="how-to-play">
        <AccordionTrigger>플레이 방법</AccordionTrigger>
        <AccordionContent>
          스코어를 정확히 맞히면 3점, 승·무·패만 맞혀도 2점을 받는다.
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  ),
}
