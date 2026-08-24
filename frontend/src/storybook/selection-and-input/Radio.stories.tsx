import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { RadioIndicator, RadioOption } from '@/components/primitives/radio'

const meta = {
  title: 'Selection and Input/Radio',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const IndicatorOnly: Story = {
  render: () => (
    <div className="flex gap-3">
      <RadioIndicator selected={false} />
      <RadioIndicator selected />
    </div>
  ),
}

export const OptionGroup: Story = {
  render: function Render() {
    const [selected, setSelected] = useState('a')
    const options = [
      { id: 'a', label: '홈' },
      { id: 'b', label: '원정' },
      { id: 'c', label: '무승부' },
    ]
    return (
      <div className="flex w-72 flex-col gap-2">
        {options.map((option) => (
          <RadioOption
            key={option.id}
            selected={selected === option.id}
            onClick={() => setSelected(option.id)}
          >
            <span className="text-label-1-normal font-semibold text-neutral">
              {option.label}
            </span>
          </RadioOption>
        ))}
      </div>
    )
  },
}
