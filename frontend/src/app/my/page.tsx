import { IS_MOCK } from '@/lib/config'
import { MOCK_PARTICIPATED } from '@/lib/mock/data'
import { getEffectivePollStatus } from '@/lib/polls/status'
import { getMySeasonRow } from '@/lib/queries/predictions'
import { getProfileIconThresholds, resolveProfileIconUrl } from '@/lib/images/profile-icons'
import { AppHeader } from '@/components/composition/common/AppHeader'
import { MyPageClient } from '@/components/composition/my/MyPageClient'
import { RequireAuthModal } from '@/components/composition/auth/RequireAuthModal'

type PollStatusForMy = 'scheduled' | 'active' | 'closed'

export default async function MyPage() {
  // ── 목 모드: 데모 프로필 ─────────────────────────────────────
  if (IS_MOCK) {
    return (
      <>
        <AppHeader mobileBack />
        <MyPageClient
          displayName="뉴캐슬 팬"
          email="fan@nufcvote.com"
          avatarUrl={null}
          participatedPolls={MOCK_PARTICIPATED}
          isMockMode={true}
          totalPoints={0}
          profileGrades={[]}
        />
      </>
    )
  }

  // ── 실제 모드 ─────────────────────────────────────────────────
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <>
        <AppHeader mobileBack />
        <RequireAuthModal />
      </>
    )
  }

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

  // 예측 미참여 유저는 season_leaderboard에 행 자체가 없을 수 있다 — 이 경우 0점(기본 등급)으로 간주(plan 6-4).
  const mySeasonRow = await getMySeasonRow(user.id)
  const totalPoints = mySeasonRow?.total_points ?? 0
  const profileIconThresholds = await getProfileIconThresholds()
  const avatarUrl = resolveProfileIconUrl(totalPoints, profileIconThresholds)

  // 등급 안내 모달(마이페이지 아바타 탭)에 넘길 전체 등급 목록 — 임계점수 + 아이콘 URL만(plan 6-2).
  const profileGrades: { threshold: number; iconUrl: string }[] = profileIconThresholds
    .map(threshold => ({ threshold, iconUrl: resolveProfileIconUrl(threshold, profileIconThresholds) }))
    .filter((grade): grade is { threshold: number; iconUrl: string } => grade.iconUrl !== null)

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
    <>
      <AppHeader mobileBack />
      <MyPageClient
        displayName={displayName}
        email={email}
        avatarUrl={avatarUrl}
        participatedPolls={participatedPolls}
        isMockMode={false}
        totalPoints={totalPoints}
        profileGrades={profileGrades}
      />
    </>
  )
}
