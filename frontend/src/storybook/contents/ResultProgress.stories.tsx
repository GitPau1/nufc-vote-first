import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ResultProgress } from '@/components/ui/result-progress'

const meta = {
  title: 'Contents/ResultProgress',
  component: ResultProgress,
  args: {
    percent: 62,
    highlighted: true,
    optionLabel: '손흥민',
  },
  argTypes: {
    percent: { control: { type: 'range', min: 0, max: 100, step: 1 } },
  },
} satisfies Meta<typeof ResultProgress>

export default meta
type Story = StoryObj<typeof meta>

export const Highlighted: Story = {}

export const NotHighlighted: Story = {
  args: { highlighted: false, percent: 38, optionLabel: '케빈 데 브라위너' },
}

export const WithThumb: Story = {
  args: {
    thumb: { url: 'https://placehold.co/40x40', fallback: '손', label: '손흥민' },
  },
}

export const WithoutThumb: Story = {
  args: { thumb: null },
}

export const List: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-2">
      <ResultProgress
        percent={62}
        highlighted
        optionLabel="손흥민"
        thumb={{ url: 'https://placehold.co/40x40', fallback: '손', label: '손흥민' }}
      />
      <ResultProgress
        percent={38}
        highlighted={false}
        optionLabel="케빈 데 브라위너"
        thumb={{ url: 'https://placehold.co/40x40', fallback: '케', label: '케빈 데 브라위너' }}
      />
    </div>
  ),
}
