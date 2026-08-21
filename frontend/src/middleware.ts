import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdmin } from '@/lib/admin'

const _url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const IS_MOCK = !_url || !_url.startsWith('http')
const PROTECTED_PREFIXES = ['/my', '/onboarding']
const ADMIN_PREFIXES = ['/admin']

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (
    process.env.NODE_ENV === 'production' &&
    pathname.startsWith('/dev/design-system')
  ) {
    return new NextResponse(null, { status: 404 })
  }

  const requiresAuth = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))
  const requiresAdmin = ADMIN_PREFIXES.some(prefix => pathname.startsWith(prefix))
  if (!requiresAuth && !requiresAdmin) {
    return NextResponse.next({ request })
  }

  if (IS_MOCK) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // 로그인 필수 경로 → /login 페이지가 없어졌으므로 리다이렉트하지 않는다.
  // 미로그인 상태로 통과시키고, 각 페이지가 서버에서 auth를 확인해 로그인 모달을 직접 띄운다.
  if (!user && requiresAuth) {
    return supabaseResponse
  }

  // /admin → 관리자만 허용. 미로그인은 페이지의 로그인 모달에 맡기고,
  // 로그인은 했지만 관리자가 아닌 경우만 홈으로 돌려보낸다(로그인 모달로 해결되지 않는 권한 문제).
  if (requiresAdmin) {
    if (user && !isAdmin(user.email)) return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/my/:path*',
    '/onboarding/:path*',
    '/admin/:path*',
    '/dev/design-system/:path*',
  ],
}
