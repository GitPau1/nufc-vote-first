import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ProgressPips } from '@/components/composition/predict/steps'

const meta = {
  title: 'Composition/Predict/ProgressPips',
  component: ProgressPips,
} satisfies Meta<typeof ProgressPips>

export default meta
type Story = StoryObj<typeof meta>

export const Score: Story = { args: { current: 'score' } }
export const Pick: Story = { args: { current: 'pick' } }
export const Confirm: Story = { args: { current: 'confirm' } }

/** 세 단계를 한 번에 — 현재 단계까지 brand-solid로 채워지는 걸 비교한다. */
export const AllSteps: Story = {
  // render가 직접 세 단계를 그리므로 args는 쓰이지 않지만, ProgressPips의 current가 필수라 타입상 필요하다.
  args: { current: 'score' },
  render: () => (
    <div className="flex flex-col gap-4">
      <ProgressPips current="score" />
      <ProgressPips current="pick" />
      <ProgressPips current="confirm" />
    </div>
  ),
}
