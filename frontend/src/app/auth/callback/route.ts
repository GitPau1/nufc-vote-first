import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth`)
  }

  // 세션 쿠키를 response에 직접 쓰기 위해 response를 먼저 생성.
  // (cookies()에서 set하면 NextResponse.redirect() 새 응답에 쿠키가 안 넘어가는 문제 방지)
  const redirectResponse = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // 세션 쿠키를 최종 redirect response에 직접 설정
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/?error=auth`)
  }

  // 신규 가입자 판별: display_name이 null이면 온보딩으로
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .single()

    if (!profile?.display_name) {
      // 온보딩으로 리다이렉트 — 쿠키도 같이 전달
      const onboardingResponse = NextResponse.redirect(
        `${origin}/onboarding?next=${encodeURIComponent(next)}`
      )
      redirectResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
        onboardingResponse.cookies.set(name, value, options)
      })
      return onboardingResponse
    }
  }

  return redirectResponse
}
