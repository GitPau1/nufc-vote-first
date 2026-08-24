import type { Meta, StoryObj } from '@storybook/nextjs-vite'

const ITEMS = [
  { title: '손흥민', subtitle: 'FWD · 12승 3패' },
  { title: '케빈 데 브라위너', subtitle: 'MID · 9승 6패' },
  { title: '엘링 홀란드', subtitle: 'FWD · 15승 0패' },
]

const meta = {
  title: 'Primitives/ListGroup',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="w-96 divide-y divide-neutral-weak rounded-lg border border-neutral-weak bg-surface">
      {ITEMS.map((item) => (
        <div key={item.title} className="px-4 py-3">
          <p className="text-label-1-normal font-semibold text-neutral">{item.title}</p>
          <p className="mt-0.5 text-caption-2 text-neutral-muted">{item.subtitle}</p>
        </div>
      ))}
    </div>
  ),
}
