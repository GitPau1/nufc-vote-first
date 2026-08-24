import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Separator } from '@/components/ui/separator'

const meta = {
  title: 'Presentation/Separator',
  component: Separator,
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div className="w-64">
      <p className="text-label-2 text-neutral">위</p>
      <Separator className="my-3" />
      <p className="text-label-2 text-neutral">아래</p>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-3">
      <span className="text-label-2 text-neutral">왼쪽</span>
      <Separator orientation="vertical" />
      <span className="text-label-2 text-neutral">오른쪽</span>
    </div>
  ),
}
