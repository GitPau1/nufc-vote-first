import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Button } from '@/components/primitives/button'

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: {
    children: '버튼',
    variant: 'default',
    size: 'default',
    disabled: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'secondary', 'outline', 'ghost', 'link'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Destructive: Story = {
  args: { variant: 'destructive', children: '탈퇴하기' },
}

export const Secondary: Story = {
  args: { variant: 'secondary', children: '더 보기' },
}

export const Outline: Story = {
  args: { variant: 'outline', children: '취소' },
}

export const Ghost: Story = {
  args: { variant: 'ghost', children: '건너뛰기' },
}

export const Link: Story = {
  args: { variant: 'link', children: '자세히 보기' },
}

export const Disabled: Story = {
  args: { disabled: true, children: '제출 중…' },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">default</Button>
      <Button variant="destructive">destructive</Button>
      <Button variant="secondary">secondary</Button>
      <Button variant="outline">outline</Button>
      <Button variant="ghost">ghost</Button>
      <Button variant="link">link</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">sm</Button>
      <Button size="default">default</Button>
      <Button size="lg">lg</Button>
      <Button size="icon">🔍</Button>
    </div>
  ),
}
