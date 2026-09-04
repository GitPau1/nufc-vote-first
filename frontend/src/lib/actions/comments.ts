'use server'

import { revalidatePath } from 'next/cache'
import { IS_MOCK } from '@/lib/config'
import type { AnySupabase } from '@/lib/supabase/admin'
import type { CommentItem } from '@/lib/queries/comments'
import { getServiceRoleClient } from '@/lib/supabase/service-client'

/**
 * `not_voted` = 투표에 참여하지 않은 사용자의 댓글 작성 시도.
 * DB의 `comments: insert for voters` RLS와 같은 조건을 서버 액션에서 먼저 판정해,
 * UI를 우회한 호출도 'failed'라는 뭉뚱그린 코드가 아니라 이유를 받게 한다.
 */
type CommentErrorCode = 'empty' | 'unauthenticated' | 'not_voted' | 'forbidden' | 'failed'

type CommentActionResult = { success: true; comment: CommentItem } | { error: CommentErrorCode }
type ActionResult = { success: true } | { error: CommentErrorCode }
type SupabaseLike = Pick<AnySupabase, 'from'>

/** 투표 참여 여부 — comments RLS와 동일하게 votes에 이 유저 행이 있는지만 본다(마감 여부는 무관). */
async function hasVoted(
  supabase: SupabaseLike,
  pollId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('votes')
    .select('id')
    .eq('poll_id', pollId)
    .eq('user_id', userId)
    .maybeSingle()

  return !!data
}

async function getVotedOptionLabel(
  supabase: SupabaseLike,
  pollId: string,
  userId: string,
): Promise<string | null> {
  const { data: vote } = await supabase
    .from('votes')
    .select('option_id')
    .eq('poll_id', pollId)
    .eq('user_id', userId)
    .single()

  if (!vote?.option_id) return null

  const { data: option } = await supabase
    .from('poll_options')
    .select('label')
    .eq('id', vote.option_id)
    .single()

  return option?.label ?? null
}

async function buildCommentItem(
  supabase: SupabaseLike,
  comment: { id: string; poll_id: string; user_id: string; content: string; created_at: string },
  currentUserId: string,
): Promise<CommentItem> {
  const { data: profile } = await supabase
    .from('public_profiles')
    .select('display_name, avatar_url')
    .eq('id', comment.user_id)
    .single()
  const { data: userProfile } = profile?.display_name
    ? { data: null }
    : await supabase
      .from('users')
      .select('display_name, avatar_url')
      .eq('id', comment.user_id)
      .single()

  return {
    id: comment.id,
    poll_id: comment.poll_id,
    content: comment.content,
    created_at: comment.created_at,
    user: {
      display_name: profile?.display_name ?? userProfile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? userProfile?.avatar_url ?? null,
    },
    like_count: 0,
    is_liked: false,
    is_mine: comment.user_id === currentUserId,
    voted_option_label: await getVotedOptionLabel(supabase, comment.poll_id, comment.user_id),
  }
}

export async function submitComment(
  pollId: string,
  content: string,
): Promise<CommentActionResult> {
  if (!content.trim()) return { error: 'empty' }

  if (IS_MOCK) {
    // 목 모드의 투표 이력은 mock-vote-{pollId} 쿠키에만 있다(userId는 쓰이지 않는다).
    // 실연동 모드와 같은 순서로 막아, 목에서만 통과하는 경로가 생기지 않게 한다.
    const { mockGetMyVote } = await import('@/lib/mock/queries')
    if (!(await mockGetMyVote(pollId, 'mock-user'))) return { error: 'not_voted' }

    revalidatePath(`/polls/${pollId}`)
    return {
      success: true,
      comment: {
        id: `mock-${Date.now()}`,
        poll_id: pollId,
        content: content.trim(),
        created_at: new Date().toISOString(),
        user: { display_name: '나', avatar_url: null },
        like_count: 0,
        is_liked: false,
        is_mine: true,
        voted_option_label: null,
      },
    }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  const db = supabase as AnySupabase
  // 투표 참여자만 댓글을 쓸 수 있다. RLS도 같은 조건을 걸지만, 여기서 먼저 판정해야
  // 거부 이유가 'failed'로 뭉개지지 않고 UI가 사용자에게 설명할 수 있다.
  if (!(await hasVoted(db, pollId, user.id))) return { error: 'not_voted' }

  const { data: comment, error } = await db
    .from('comments')
    .insert({ poll_id: pollId, user_id: user.id, content: content.trim() })
    .select('id, poll_id, user_id, content, created_at')
    .single()

  if (error || !comment) return { error: 'failed' }

  revalidatePath(`/polls/${pollId}`)
  return { success: true, comment: await buildCommentItem(db, comment, user.id) }
}

export async function updateComment(
  commentId: string,
  pollId: string,
  content: string,
): Promise<CommentActionResult> {
  if (!content.trim()) return { error: 'empty' }

  if (IS_MOCK) {
    revalidatePath(`/polls/${pollId}`)
    return {
      success: true,
      comment: {
        id: commentId,
        poll_id: pollId,
        content: content.trim(),
        created_at: new Date().toISOString(),
        user: { display_name: '나', avatar_url: null },
        like_count: 0,
        is_liked: false,
        is_mine: true,
        voted_option_label: null,
      },
    }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  const serviceSupabase = await getServiceRoleClient()

  const { data: existing } = await serviceSupabase
    .from('comments')
    .select('id, user_id')
    .eq('id', commentId)
    .eq('poll_id', pollId)
    .single()

  if (!existing || existing.user_id !== user.id) return { error: 'forbidden' }

  const { data: comment, error } = await serviceSupabase
    .from('comments')
    .update({ content: content.trim() })
    .eq('id', commentId)
    .select('id, poll_id, user_id, content, created_at')
    .single()

  if (error || !comment) return { error: 'failed' }

  revalidatePath(`/polls/${pollId}`)
  return { success: true, comment: await buildCommentItem(serviceSupabase, comment, user.id) }
}

export async function deleteComment(
  commentId: string,
  pollId: string,
): Promise<ActionResult> {
  if (IS_MOCK) {
    revalidatePath(`/polls/${pollId}`)
    return { success: true }
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  const serviceSupabase = await getServiceRoleClient()

  const { data: existing } = await serviceSupabase
    .from('comments')
    .select('id, user_id')
    .eq('id', commentId)
    .eq('poll_id', pollId)
    .single()

  if (!existing || existing.user_id !== user.id) return { error: 'forbidden' }

  const { error } = await serviceSupabase
    .from('comments')
    .update({ is_hidden: true })
    .eq('id', commentId)

  if (error) return { error: 'failed' }

  revalidatePath(`/polls/${pollId}`)
  return { success: true }
}

export async function toggleLike(
  commentId: string,
  pollId: string,
): Promise<ActionResult> {
  if (IS_MOCK) return { success: true }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('comment_likes')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('comment_likes').delete().eq('id', existing.id)
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('comment_likes').insert({ comment_id: commentId, user_id: user.id })
  }

  revalidatePath(`/polls/${pollId}`)
  return { success: true }
}
