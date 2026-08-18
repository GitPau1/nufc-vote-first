import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabase = any

export async function requireAdminClient(): Promise<AnySupabase> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user?.email)) {
    throw new Error('권한이 없습니다.')
  }

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as AnySupabase
}

