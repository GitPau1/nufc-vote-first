import { createClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import { mockGetComments } from '@/lib/mock/queries'

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
  const voteMap = new Map<string, string>()

  if (commenterIds.length > 0) {
    const { data: voteData } = await supabase
      .from('votes')
      .select('user_id, option_id')
      .eq('poll_id', pollId)
      .in('user_id', commenterIds) as unknown as { data: VoteQueryRow[] | null }

    if (voteData && voteData.length > 0) {
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
        if (label) voteMap.set(vote.user_id, label)
      }
    }
  }

  const likedSet = new Set<string>()
  if (userId) {
    const commentIds = data.map(row => row.id)
    const { data: likeData } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .eq('user_id', userId)
      .in('comment_id', commentIds) as unknown as { data: LikeQueryRow[] | null }

    for (const like of likeData ?? []) likedSet.add(like.comment_id)
  }

  return data.map(row => ({
    id: row.id,
    poll_id: row.poll_id,
    content: row.content,
    created_at: row.created_at,
    user: {
      display_name: row.user?.display_name ?? null,
      avatar_url: row.user?.avatar_url ?? null,
    },
    like_count: row.like_count?.[0]?.count ?? 0,
    is_liked: likedSet.has(row.id),
    is_mine: userId === row.user_id,
    voted_option_label: voteMap.get(row.user_id) ?? null,
  }))
}
