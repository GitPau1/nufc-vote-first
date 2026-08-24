'use client'

import { useState } from 'react'
import { Button } from '@/components/primitives/button'
import { Modal } from '@/components/primitives/modal/Modal'
import { LoginContent } from '@/components/primitives/modal/contents/Login'

export function LoginButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-pill font-semibold border-brand-solid text-brand hover:text-brand"
        onClick={() => setOpen(true)}
      >
        로그인
      </Button>

      <Modal open={open} onOpenChange={o => { if (!o) setOpen(false) }} form="default">
        <LoginContent triggerAction="login" onClose={() => setOpen(false)} />
      </Modal>
    </>
  )
}
