'use client'

import { useState, useTransition } from 'react'
import { saveNickname } from '@/lib/actions/onboarding'

export default function OnboardingPage() {
  const [error, setError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await saveNickname(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-6 py-12">
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-5 text-title-2 border-2 border-border">
        🧑
      </div>

      <h1 className="text-heading-2 font-black text-foreground text-center mb-1.5">
        팬 이름을 정해주세요
      </h1>
      <p className="text-label-2 text-muted-foreground text-center mb-9">
        다른 팬들에게 이 이름으로 보여요.<br />
        나중에 마이페이지에서 변경 가능해요.
      </p>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-label-2 font-semibold text-foreground">닉네임</label>
          <input
            name="displayName"
            className="w-full px-3.5 py-3 rounded-sm border border-border text-body-2-normal text-foreground bg-surface outline-none focus:border-primary placeholder:text-gray-3"
            placeholder="예: 까치사랑해"
            maxLength={12}
            autoFocus
          />
          <span className="text-caption-2 text-muted-foreground">2~12자, 특수문자 제외</span>
          {error && <span className="text-caption-1 text-negative font-medium">{error}</span>}
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3.5 rounded-sm bg-primary text-white font-bold text-body-2-normal shadow-w200 transition-opacity hover:opacity-70 active:opacity-50 disabled:bg-disabled disabled:text-gray-3 disabled:opacity-100 mt-2"
        >
          {isPending ? '저장 중...' : '시작하기 →'}
        </button>
      </form>
    </div>
  )
}
