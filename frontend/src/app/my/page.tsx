import { redirect } from 'next/navigation'
import { IS_MOCK } from '@/lib/config'
import { MOCK_PARTICIPATED } from '@/lib/mock/data'
import { getEffectivePollStatus } from '@/lib/polls/status'
import { MyPageClient } from '@/components/my/MyPageClient'

type PollStatusForMy = 'scheduled' | 'active' | 'closed'

export default async function MyPage() {
  // ── 목 모드: 데모 프로필 ─────────────────────────────────────
  if (IS_MOCK) {
    return (
      <MyPageClient
        displayName="뉴캐슬 팬"
        email="fan@nufcvote.com"
        avatarUrl={null}
        participatedPolls={MOCK_PARTICIPATED}
        isMockMode={true}
      />
    )
  }

  // ── 실제 모드 ─────────────────────────────────────────────────
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // public.users.display_name 우선, 없으면 Google 이름 폴백
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const displayName = profile?.display_name
    ?? (user.user_metadata?.name as string | undefined)
    ?? user.email
    ?? '사용자'
  const email     = user.email ?? ''
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null

  const { data: voteRows } = await supabase
    .from('votes')
    .select(`
      created_at,
      option:poll_options(label),
      poll:polls(id, title, status, scheduled_at, closes_at)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  type JoinedOne<T> = T | T[] | null
  type ParticipatedVoteRow = {
    created_at: string
    option: JoinedOne<{ label: string }>
    poll: JoinedOne<{ id: string; title: string; status: PollStatusForMy; scheduled_at: string | null; closes_at: string }>
  }

  function one<T>(value: JoinedOne<T>): T | null {
    return Array.isArray(value) ? value[0] ?? null : value
  }

  const votedPolls = ((voteRows ?? []) as ParticipatedVoteRow[])
    .flatMap(row => {
      const poll = one(row.poll)
      const option = one(row.option)
      if (!poll) return []
      return [{
        pollId: poll.id,
        pollTitle: poll.title,
        optionLabel: option?.label ?? '',
        votedAt: row.created_at,
        pollStatus: getEffectivePollStatus(poll),
      }]
    })

  const participatedPolls = votedPolls
    .sort((a, b) => new Date(b.votedAt).getTime() - new Date(a.votedAt).getTime())

  return (
    <MyPageClient
      displayName={displayName}
      email={email}
      avatarUrl={avatarUrl}
      participatedPolls={participatedPolls}
      isMockMode={false}
    />
  )
}
