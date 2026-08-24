import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/primitives/avatar'

const meta = {
  title: 'Primitives/Avatar',
  component: Avatar,
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const WithImage: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="https://placehold.co/40x40" alt="" />
      <AvatarFallback>NU</AvatarFallback>
    </Avatar>
  ),
}

export const FallbackOnly: Story = {
  render: () => (
    <Avatar>
      <AvatarImage src="" alt="" />
      <AvatarFallback>NU</AvatarFallback>
    </Avatar>
  ),
}
