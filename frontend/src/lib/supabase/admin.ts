import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { getServiceRoleClient } from '@/lib/supabase/service-client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySupabase = any

export async function requireAdminClient(): Promise<AnySupabase> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user?.email)) {
    throw new Error('권한이 없습니다.')
  }

  return (await getServiceRoleClient()) as AnySupabase
}

