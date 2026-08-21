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
        className="h-8 rounded-pill text-caption-1 font-semibold border-primary text-primary hover:text-primary"
        onClick={() => setOpen(true)}
      >
        로그인
      </Button>

      <LoginModal
        open={open}
        onClose={() => setOpen(false)}
        intent="direct"
        triggerAction="login"
      />
    </>
  )
}
