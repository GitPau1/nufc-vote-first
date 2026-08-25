import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서는 쿠키 설정 불가 — middleware에서 처리
          }
        },
      },
    }
  )
}

/**
 * 현재 로그인 사용자. `auth.getUser()`는 Auth 서버로 나가는 네트워크 왕복이라, 한 요청에서
 * 여러 쿼리가 각자 부르면 그만큼 왕복이 쌓인다(결과 화면 기준 3회). React.cache로 감싸
 * 요청 스코프 안에서 1회로 합친다 — 요청 사이에는 공유되지 않으므로 남의 세션이 새지 않는다.
 *
 * 반환은 user 객체 그대로다. 호출부가 id만 쓰는 곳도 있고 email(관리자 판정)을 쓰는 곳도 있다.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
