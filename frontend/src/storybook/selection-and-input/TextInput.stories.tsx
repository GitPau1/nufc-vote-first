import type { Meta, StoryObj } from '@storybook/nextjs-vite'

const meta = {
  title: 'Primitives/TextInput',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <input className="input-field w-72" placeholder="투표 제목" />,
}

export const Disabled: Story = {
  render: () => <input className="input-field w-72" placeholder="투표 제목" disabled />,
}

export const Textarea: Story = {
  render: () => (
    <textarea className="input-field w-72 resize-none" rows={3} placeholder="설명(선택)" />
  ),
}
