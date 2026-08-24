'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LoginModal } from '@/components/polls/LoginModal'

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

      <LoginModal
        open={open}
        onClose={() => setOpen(false)}
        triggerAction="login"
      />
    </>
  )
}
