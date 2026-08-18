'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function LoginButton() {
  return (
    <Link href="/login">
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-pill text-caption-1 font-semibold border-primary text-primary hover:text-primary"
      >
        로그인
      </Button>
    </Link>
  )
}
