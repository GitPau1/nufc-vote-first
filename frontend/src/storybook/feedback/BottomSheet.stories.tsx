import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

const meta = {
  title: 'Feedback/BottomSheet',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <>
        <Button onClick={() => setOpen(true)}>다시 열기</Button>
        <BottomSheet open={open} onOpenChange={setOpen}>
          <SheetHeader className="mb-5 text-left">
            <SheetTitle className="text-body-1-normal">이 선택으로 투표하시겠어요?</SheetTitle>
            <SheetDescription>제출 후에는 변경할 수 없습니다</SheetDescription>
          </SheetHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button className="flex-[2]" onClick={() => setOpen(false)}>
              최종 제출
            </Button>
          </div>
        </BottomSheet>
      </>
    )
  },
}
