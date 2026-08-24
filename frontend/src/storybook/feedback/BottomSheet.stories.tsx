import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Modal, type ModalForm } from '@/components/primitives/modal/Modal'
import { SheetHeader, SheetTitle, SheetDescription } from '@/components/primitives/modal/sheet'
import { Button } from '@/components/primitives/button'

// 공용 껍데기(Modal) 데모. form으로 default(중앙)/sheet(바텀)/responsive(폭 따라 자동)를 고른다.
const meta = {
  title: 'Feedback/BottomSheet',
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

function Demo({ form }: { form: ModalForm }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <Button onClick={() => setOpen(true)}>다시 열기</Button>
      <Modal open={open} onOpenChange={setOpen} form={form}>
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
      </Modal>
    </>
  )
}

/** 기본값 — 데스크탑=중앙 모달, 모바일(768px 미만)=바텀시트로 자동 전환. */
export const Default: Story = {
  render: () => <Demo form="responsive" />,
}

/** 항상 바텀시트(드래그 핸들 포함). */
export const Sheet: Story = {
  render: () => <Demo form="sheet" />,
}

/** 항상 중앙 모달 — 로그인처럼 모바일에서도 중앙으로 띄울 때. */
export const CenterDefault: Story = {
  render: () => <Demo form="default" />,
}
