import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const secret = process.env.ACCOUNT_PURGE_SECRET
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || token !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { userIds?: unknown } | null
  const userIds = Array.isArray(body?.userIds) ? body.userIds.filter((id): id is string => typeof id === 'string') : []
  if (userIds.length === 0) {
    return NextResponse.json({ purged: 0 })
  }

  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const results = await Promise.allSettled(userIds.map(id => supabase.auth.admin.deleteUser(id)))
  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ purged: userIds.length - failed, failed })
}
