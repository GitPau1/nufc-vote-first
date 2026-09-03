import { createClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import { mockGetComments } from '@/lib/mock/queries'
import { getProfileIconThresholds, resolveProfileIconUrl } from '@/lib/images/profile-icons'

export type CommentItem = {
  id: string
  poll_id: string
  content: string
  created_at: string
  user: { display_name: string | null; avatar_url: string | null }
  like_count: number
  is_liked: boolean
  is_mine: boolean
  voted_option_label: string | null
}

type CommentQueryRow = {
  id: string
  poll_id: string
  user_id: string
  content: string
  created_at: string
  user: { display_name: string | null; avatar_url: string | null } | null
  like_count: { count: number }[] | null
}

type VoteQueryRow = {
  user_id: string
  option_id: string
}

type OptionQueryRow = {
  id: string
  label: string
}

type LikeQueryRow = {
  comment_id: string
}

type SeasonPointsQueryRow = {
  user_id: string
  total_points: number
}

export async function getComments(
  pollId: string,
  userId: string | null,
): Promise<CommentItem[]> {
  if (IS_MOCK) return mockGetComments(pollId, userId)

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('comments')
    .select(`
      id, poll_id, user_id, content, created_at,
      user:public_profiles!comments_public_profiles_user_id_fkey(display_name, avatar_url),
      like_count:comment_likes(count)
    `)
    .eq('poll_id', pollId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(50) as unknown as { data: CommentQueryRow[] | null; error: Error | null }

  if (error || !data) return []

  const commenterIds = Array.from(new Set(data.map(row => row.user_id)))
  const commentIds = data.map(row => row.id)

  // votes→poll_options 체인, comment_likes, 등급 아이콘 계산(총점 조회+버킷 임계값)은 서로의
  // 결과를 안 쓴다. 순차로 기다릴 이유가 없어 나눠 보낸다.
  // (votes→poll_options는 option_id 의존이라 그 안에서는 순차가 맞다)
  const [voteMap, likedSet, avatarUrlMap] = await Promise.all([
    (async () => {
      const map = new Map<string, string>()
      if (commenterIds.length === 0) return map

      // votes는 본인 행만 RLS로 열려 있다(votes: select own). 댓글 작성자들이 어떤 선택지에
      // 투표했는지 라벨로 보여주려면 교차조회가 필요하므로 service_role로 서버에서만 읽는다.
      const { createClient: createServiceClient } = await import('@supabase/supabase-js')
      const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      )

      const { data: voteData } = await admin
        .from('votes')
        .select('user_id, option_id')
        .eq('poll_id', pollId)
        .in('user_id', commenterIds) as unknown as { data: VoteQueryRow[] | null }

      if (!voteData || voteData.length === 0) return map

      const optionIds = Array.from(new Set(voteData.map(vote => vote.option_id)))
      const { data: optionData } = await supabase
        .from('poll_options')
        .select('id, label')
        .in('id', optionIds) as unknown as { data: OptionQueryRow[] | null }

      const optionLabelMap = new Map<string, string>(
        (optionData ?? []).map(option => [option.id, option.label])
      )

      for (const vote of voteData) {
        const label = optionLabelMap.get(vote.option_id)
        if (label) map.set(vote.user_id, label)
      }
      return map
    })(),
    (async () => {
      const set = new Set<string>()
      if (!userId) return set

      const { data: likeData } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', userId)
        .in('comment_id', commentIds) as unknown as { data: LikeQueryRow[] | null }

      for (const like of likeData ?? []) set.add(like.comment_id)
      return set
    })(),
    (async () => {
      const map = new Map<string, string | null>()
      if (commenterIds.length === 0) return map

      // 등급 아이콘은 Storage 계산까지 포함해 서버(쿼리 파일)에서 끝낸다 — 클라이언트로는
      // 최종 아이콘 URL만 내려간다(profile-icons.ts 2절 근거와 동일 원칙).
      const [thresholds, { data: pointsData }] = await Promise.all([
        getProfileIconThresholds(),
        supabase
          .from('season_leaderboard')
          .select('user_id, total_points')
          .in('user_id', commenterIds) as unknown as Promise<{ data: SeasonPointsQueryRow[] | null }>,
      ])

      const pointsMap = new Map<string, number>(
        (pointsData ?? []).map(row => [row.user_id, row.total_points])
      )

      for (const commenterId of commenterIds) {
        map.set(commenterId, resolveProfileIconUrl(pointsMap.get(commenterId) ?? 0, thresholds))
      }
      return map
    })(),
  ])

  return data.map(row => ({
    id: row.id,
    poll_id: row.poll_id,
    content: row.content,
    created_at: row.created_at,
    user: {
      display_name: row.user?.display_name ?? null,
      avatar_url: avatarUrlMap.get(row.user_id) ?? null,
    },
    like_count: row.like_count?.[0]?.count ?? 0,
    is_liked: likedSet.has(row.id),
    is_mine: userId === row.user_id,
    voted_option_label: voteMap.get(row.user_id) ?? null,
  }))
}
