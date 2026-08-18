'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics/mixpanel'

export function MyFeedbackForm() {
  const [content, setContent] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const { submitFeedback } = await import('@/lib/actions/feedback')
      const result = await submitFeedback(content)
      if (result.error) {
        setMessage(result.error)
        return
      }
      trackEvent('feedback_submitted', {
        source_page: 'feedback',
        content_length: content.trim().length,
      })
      setContent('')
      setMessage('피드백을 남겨주셔서 감사합니다.')
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value.slice(0, 500))}
        className="min-h-[180px] w-full resize-none rounded-sm border border-border bg-surface px-3.5 py-3 text-body-2-reading text-foreground outline-none placeholder:text-gray-3 focus:border-primary"
        placeholder="불편했던 점이나 개선 아이디어를 알려주세요."
        maxLength={500}
      />
      <div className="flex items-center justify-between text-caption-2 text-muted-foreground">
        <span>{message}</span>
        <span>{content.length}/500</span>
      </div>
      <Button type="submit" disabled={isPending} className="h-12">
        {isPending ? '보내는 중...' : '피드백 보내기'}
      </Button>
    </form>
  )
}
