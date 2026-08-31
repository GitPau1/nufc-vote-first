import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Users } from 'lucide-react'

const meta = {
  title: 'Composition/Polls/FormSection',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Shell: Story = {
  render: () => (
    <section className="w-96 space-y-2.5 rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
      <p className="text-label-1-normal font-medium text-neutral">기본 정보</p>
      <input className="input-field" placeholder="투표 제목" />
      <input className="input-field" placeholder="설명(선택)" />
    </section>
  ),
}

export const PickerEmpty: Story = {
  render: () => (
    <section className="w-96 space-y-2.5 rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label-1-normal font-medium text-neutral">대상 선수</p>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-disabled px-2.5 text-caption-1 font-medium text-neutral"
        >
          <Users className="h-3.5 w-3.5" /> 선택
        </button>
      </div>
      <div className="rounded-md border border-dashed border-neutral-weak px-3 py-4 text-center text-caption-1 font-medium text-neutral-muted">
        선수를 선택해주세요.
      </div>
    </section>
  ),
}

export const PickerSelected: Story = {
  render: () => (
    <section className="w-96 space-y-2.5 rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200">
      <div className="flex items-center justify-between gap-3">
        <p className="text-label-1-normal font-medium text-neutral">대상 선수</p>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-disabled px-2.5 text-caption-1 font-medium text-neutral"
        >
          <Users className="h-3.5 w-3.5" /> 선택
        </button>
      </div>
      <div className="flex items-center gap-3 rounded-md border border-neutral-weak bg-disabled px-3 py-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-surface text-caption-1 font-medium text-brand">
          손흥
        </div>
        <div className="min-w-0">
          <p className="truncate text-label-2 font-medium text-neutral">손흥민</p>
        </div>
      </div>
    </section>
  ),
}
