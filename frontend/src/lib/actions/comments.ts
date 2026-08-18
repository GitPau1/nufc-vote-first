'use server'

import { revalidatePath } from 'next/cache'
import { IS_MOCK } from '@/lib/config'
import type { AnySupabase } from '@/lib/supabase/admin'
import type { CommentItem } from '@/lib/queries/comments'

type CommentActionResult = { success: true; comment: CommentItem } | { error: string }
type ActionResult = { success: true } | { error: string }
type SupabaseLike = Pick<AnySupabase, 'from'>

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

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

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

  const { createClient: createServiceClient } = await import('@supabase/supabase-js')
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

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
