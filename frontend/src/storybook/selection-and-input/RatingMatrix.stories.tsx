import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { cn } from '@/lib/utils'

const SCORE_OPTIONS = [
  { score: 0, grade: 'F' },
  { score: 1, grade: 'D' },
  { score: 2, grade: 'C' },
  { score: 3, grade: 'B' },
  { score: 4, grade: 'A' },
  { score: 5, grade: 'S' },
] as const

function RatingRow({ initial }: { initial: number | null }) {
  const [score, setScore] = useState<number | null>(initial)
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {SCORE_OPTIONS.map((option) => {
        const selected = score === option.score
        return (
          <button
            key={option.score}
            type="button"
            onClick={() => setScore(option.score)}
            className={cn(
              'rounded-lg border py-2 text-center text-caption-1 font-black transition-colors',
              selected ? 'border-brand-solid bg-brand-solid text-white' : 'border-neutral-weak bg-surface text-neutral'
            )}
          >
            <span className="block text-label-2">{option.grade}</span>
          </button>
        )
      })}
    </div>
  )
}

const meta = {
  title: 'Selection and Input/RatingMatrix',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Unselected: Story = {
  render: () => (
    <div className="w-80">
      <RatingRow initial={null} />
    </div>
  ),
}

export const Selected: Story = {
  render: () => (
    <div className="w-80">
      <RatingRow initial={4} />
    </div>
  ),
}
