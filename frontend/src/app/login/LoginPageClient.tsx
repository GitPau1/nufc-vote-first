'use client'

import { ENABLE_DEV_MOCK_AUTH, IS_MOCK } from '@/lib/config'
import { mockLogin } from '@/lib/actions/auth'
import { useRouter, useSearchParams } from 'next/navigation'

export function LoginPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/'

  async function handleLogin() {
    if (IS_MOCK || ENABLE_DEV_MOCK_AUTH) {
      await mockLogin()
      router.push(next)
      router.refresh()
      return
    }
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
  }

  async function handleSignUp() {
    if (IS_MOCK || ENABLE_DEV_MOCK_AUTH) {
      await mockLogin()
      router.push('/onboarding')
      router.refresh()
      return
    }
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-6 py-12">
      {/* 아이콘 */}
      <div className="w-18 h-18 rounded-full bg-primary-dim flex items-center justify-center mb-5 text-title-1">
        ⚽
      </div>

      <h1 className="text-heading-1 font-black text-foreground text-center mb-2">
        NUFC Vote
      </h1>
      <p className="text-label-1-reading text-muted-foreground text-center mb-10">
        팬들의 투표로 만드는<br />우리팀 이야기
      </p>

      <div className="w-full flex flex-col gap-3">
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-sm bg-primary text-white font-bold text-body-2-normal shadow-w200 transition-opacity hover:opacity-70 active:opacity-50"
        >
          <GoogleIcon color="white" />
          Google로 로그인
        </button>

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-border" />
          <span className="text-caption-1 text-muted-foreground font-medium">처음 오셨나요?</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleSignUp}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-sm bg-surface border border-border text-foreground font-semibold text-body-2-normal transition-opacity hover:opacity-70 active:opacity-50"
        >
          <GoogleIcon color="#41b6e6" />
          Google로 회원가입
        </button>
      </div>

      <p className="text-caption-2 text-muted-foreground text-center mt-7">
        가입하면 투표 참여 및 댓글 작성이 가능해요.<br />
        <span className="text-primary font-semibold">구글 계정으로만 가입해요.</span>
      </p>
    </div>
  )
}

function GoogleIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill={color}/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill={color}/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill={color}/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill={color}/>
    </svg>
  )
}
