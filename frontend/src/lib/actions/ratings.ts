'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import { canSubmitVote } from '@/lib/polls/vote-eligibility'

type RatingInput = {
  playerId: string
  score: number
  comment?: string
}

type RatingSubmitResult =
  | { success: true }
  | { error: 'unauthenticated' | 'already_voted' | 'closed' | 'incomplete' | 'setup_required' | 'failed' }

function isMissingRatingSchemaError(error: { message?: string } | null | undefined): boolean {
  const message = String(error?.message ?? '')
  return (
    message.includes('rating_votes') ||
    message.includes('schema cache') ||
    message.includes('does not exist')
  )
}

export async function submitRatingVotes(pollId: string, ratings: RatingInput[]): Promise<RatingSubmitResult> {
  if (IS_MOCK) {
    const { cookies } = await import('next/headers')
    const jar = await cookies()
    jar.set(`mock-rating-vote-${pollId}`, 'true', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
    })
    revalidatePath(`/polls/${pollId}`)
    return { success: true }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: poll, error: pollError } = await db
    .from('polls')
    .select('type, status, scheduled_at, closes_at')
    .eq('id', pollId)
    .single()

  if (pollError || !poll || poll.type !== 'overall_rating') {
    console.error('submitRatingVotes poll lookup failed:', pollError)
    return { error: 'failed' }
  }
  if (!canSubmitVote(poll)) return { error: 'closed' }

  const { data: options, error: optionError } = await db
    .from('poll_options')
    .select('player_id')
    .eq('poll_id', pollId) as { data: { player_id: string | null }[] | null; error: { message?: string } | null }

  if (optionError || !options) {
    console.error('submitRatingVotes option lookup failed:', optionError)
    return { error: 'failed' }
  }

  const targetIds = options.map(option => option.player_id).filter((id): id is string => !!id)
  const ratingMap = new Map(ratings.map(rating => [rating.playerId, rating]))
  const hasEveryTarget = targetIds.length > 0 && targetIds.every(playerId => ratingMap.has(playerId))
  if (!hasEveryTarget || ratingMap.size !== targetIds.length) return { error: 'incomplete' }

  const rows = targetIds.map(playerId => {
    const rating = ratingMap.get(playerId)
    const score = Number(rating?.score)
    if (!Number.isInteger(score) || score < 0 || score > 5) return null
    const comment = rating?.comment?.trim() ?? ''
    return {
      poll_id: pollId,
      user_id: user.id,
      target_player_id: playerId,
      score,
      comment: comment ? comment.slice(0, 500) : null,
    }
  })

  if (rows.some(row => row === null)) return { error: 'incomplete' }

  const { error } = await db
    .from('rating_votes')
    .insert(rows)

  if (error) {
    if (error.code === '23505') return { error: 'already_voted' }
    if (isMissingRatingSchemaError(error)) return { error: 'setup_required' }
    console.error('submitRatingVotes insert failed:', error)
    return { error: 'failed' }
  }

  revalidatePath(`/polls/${pollId}`)
  return { success: true }
}

export async function toggleRatingCommentLike(ratingVoteId: string, pollId: string): Promise<{ error?: string }> {
  if (IS_MOCK) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'unauthenticated' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const { data: existing } = await db
    .from('rating_vote_likes')
    .select('id')
    .eq('rating_vote_id', ratingVoteId)
    .eq('user_id', user.id)
    .maybeSingle() as { data: { id: string } | null }

  if (existing) {
    const { error } = await db
      .from('rating_vote_likes')
      .delete()
      .eq('id', existing.id)
    if (error) return { error: 'failed' }
  } else {
    const { error } = await db
      .from('rating_vote_likes')
      .insert({ rating_vote_id: ratingVoteId, user_id: user.id })
    if (error) return { error: 'failed' }
  }

  revalidatePath(`/polls/${pollId}`)
  return {}
}
