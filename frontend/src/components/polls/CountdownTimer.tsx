'use client'

import { useEffect, useState } from 'react'
import { formatDeadline } from '@/lib/utils'

export function CountdownTimer({ closesAt }: { closesAt: string }) {
  // 빈 문자열로 초기화: 서버·클라이언트 모두 '' → hydration 불일치 없음
  // useEffect에서 실제 값 세팅 (클라이언트 전용)
  const [text, setText] = useState('')

  useEffect(() => {
    setText(formatDeadline(closesAt))
    const timer = setInterval(() => setText(formatDeadline(closesAt)), 1000)
    return () => clearInterval(timer)
  }, [closesAt])

  return <>{text}</>
}
