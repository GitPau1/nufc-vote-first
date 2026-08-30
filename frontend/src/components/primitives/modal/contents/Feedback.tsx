'use client'

// 사용 도메인: 피드백 (FAB → 피드백 모달의 본문). 껍데기(Modal)는 호출부(FeedbackFab)가 씌운다.

import { useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/primitives/button'
import { SheetHeader, SheetTitle, SheetDescription } from '../sheet'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  pathToCategory,
  type FeedbackCategory,
} from '@/lib/feedback/categories'
import { getSourcePage, trackEvent } from '@/lib/analytics/mixpanel'

// 만족도 1~5. 이모지는 참고 이미지(찡그림→하트눈) 순서를 따른다.
const RATINGS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😦', label: '별로예요' },
  { value: 2, emoji: '🙄', label: '아쉬워요' },
  { value: 3, emoji: '😐', label: '보통이에요' },
  { value: 4, emoji: '😌', label: '좋아요' },
  { value: 5, emoji: '😍', label: '최고예요' },
]

interface FeedbackContentProps {
  onClose: () => void
}

export function FeedbackContent({ onClose }: FeedbackContentProps) {
  const pathname = usePathname()
  // 모달을 연 시점의 경로를 고정 — 제출 지연 중 라우팅돼도 남긴 화면 기준으로 저장.
  const [pagePath] = useState(pathname)
  const [rating, setRating] = useState<number | null>(null)
  const [category, setCategory] = useState<FeedbackCategory>(() => pathToCategory(pathname))
  const [content, setContent] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const { submitFeedback } = await import('@/lib/actions/feedback')
      const result = await submitFeedback({ content, category, rating, pagePath })
      if (result.error) {
        setMessage(result.error)
        return
      }
      trackEvent('feedback_submitted', {
        source_page: getSourcePage(pagePath),
        content_length: content.trim().length,
        category,
        rating: rating ?? undefined,
      })
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <SheetHeader className="text-left">
        <SheetTitle className="text-body-1-normal">의견을 들려주세요</SheetTitle>
        <SheetDescription>불편했던 점이나 개선 아이디어를 알려주세요.</SheetDescription>
      </SheetHeader>

      {/* 만족도(선택) — 다시 누르면 해제 */}
      <div className="flex justify-between px-1">
        {RATINGS.map(r => (
          <button
            key={r.value}
            type="button"
            aria-label={r.label}
            aria-pressed={rating === r.value}
            onClick={() => setRating(prev => (prev === r.value ? null : r.value))}
            className={`text-headline-1 transition-transform ${rating === r.value ? 'scale-125' : 'opacity-50 hover:opacity-100'}`}
          >
            {r.emoji}
          </button>
        ))}
      </div>

      {/* 카테고리 — 열릴 때 현재 경로 기준 초기 선택, 변경 가능 */}
      <select
        value={category}
        onChange={e => setCategory(e.target.value as FeedbackCategory)}
        aria-label="피드백 카테고리"
        className="w-full rounded-sm border border-neutral-weak bg-surface px-3.5 py-3 text-body-1-reading text-neutral outline-none focus:border-brand-solid"
      >
        {FEEDBACK_CATEGORIES.map(c => (
          <option key={c} value={c}>{FEEDBACK_CATEGORY_LABELS[c]}</option>
        ))}
      </select>

      {/* 내용(필수) */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value.slice(0, 500))}
        className="min-h-[140px] w-full resize-none rounded-sm border border-neutral-weak bg-surface px-3.5 py-3 text-body-1-reading text-neutral outline-none placeholder:text-placeholder focus:border-brand-solid"
        placeholder="자세한 내용을 남겨주세요."
        maxLength={500}
      />
      <div className="flex items-center justify-between text-caption-2 text-neutral-muted">
        <span>{message}</span>
        <span>{content.length}/500</span>
      </div>

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? '보내는 중...' : '피드백 보내기'}
      </Button>
    </form>
  )
}
