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

  // 요청 바디의 userIds를 무조건 믿지 않는다 — 시크릿이 새도 실제 24시간 지난 계정만 지울 수 있게 제한.
  const { data: dueUsers } = await supabase
    .from('users')
    .select('id')
    .in('id', userIds)
    .not('deleted_at', 'is', null)
    .lte('deleted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const dueIds = (dueUsers ?? []).map((u: { id: string }) => u.id)

  const results = await Promise.allSettled(dueIds.map((id: string) => supabase.auth.admin.deleteUser(id)))
  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ purged: dueIds.length - failed, failed, skipped: userIds.length - dueIds.length })
}
