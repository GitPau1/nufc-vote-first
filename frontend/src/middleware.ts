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

  // 로그인 필수 경로 → 미로그인 시 /login으로 리다이렉트
  if (!user && requiresAuth) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // /admin → 관리자만 허용
  if (requiresAdmin) {
    if (!user) return NextResponse.redirect(new URL('/login', request.url))
    if (!isAdmin(user.email)) return NextResponse.redirect(new URL('/', request.url))
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
