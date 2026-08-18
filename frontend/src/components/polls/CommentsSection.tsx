'use client'

import { useState, useTransition } from 'react'
import { Check, Send, ThumbsUp, X } from 'lucide-react'
import type { CommentItem } from '@/lib/queries/comments'
import type { PollStatus, PollType } from '@/types/database'
import { deleteComment, submitComment, toggleLike, updateComment } from '@/lib/actions/comments'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface CommentsSectionProps {
  pollId: string
  pollType: PollType
  pollStatus: PollStatus
  creatorType: 'admin' | 'user'
  initialComments: CommentItem[]
  isMockMode?: boolean
  myVotedOptionLabel?: string | null  // 현재 유저의 투표 항목 (입력 힌트용)
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min  = Math.floor(diff / 60000)
  if (min < 1)   return '방금 전'
  if (min < 60)  return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 24)    return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 30)    return `${d}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

type LocalComment = CommentItem & { _local?: boolean }

export function CommentsSection({
  pollId,
  pollType,
  pollStatus,
  creatorType,
  initialComments,
  isMockMode = false,
  myVotedOptionLabel = null,
}: CommentsSectionProps) {
  const [comments, setComments]   = useState<LocalComment[]>(initialComments)
  const [text, setText]           = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [isPending, start]        = useTransition()

  function handleSubmit() {
    if (!text.trim()) return
    const content = text.trim()

    start(async () => {
      const result = await submitComment(pollId, content)
      if ('success' in result) {
        trackEvent('comment_submitted', {
          source_page: 'poll_detail',
          poll_id: pollId,
          poll_type: pollType,
          poll_status: pollStatus,
          creator_type: creatorType,
          comment_length: content.length,
        })
        setComments(prev => [{
          ...result.comment,
          voted_option_label: result.comment.voted_option_label ?? myVotedOptionLabel ?? null,
        }, ...prev])
        setText('')
      }
    })
  }

  function startEditing(comment: LocalComment) {
    setEditingId(comment.id)
    setEditingText(comment.content)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditingText('')
  }

  function handleUpdate(commentId: string) {
    const content = editingText.trim()
    if (!content) return

    start(async () => {
      const result = await updateComment(commentId, pollId, content)
      if ('success' in result) {
        setComments(prev => prev.map(comment => (
          comment.id === commentId
            ? {
              ...comment,
              content: result.comment.content,
              user: result.comment.user,
              is_mine: result.comment.is_mine,
              voted_option_label: result.comment.voted_option_label ?? comment.voted_option_label,
            }
            : comment
        )))
        cancelEditing()
      }
    })
  }

  function handleDelete(commentId: string) {
    if (!window.confirm('댓글을 삭제할까요?')) return

    start(async () => {
      const result = await deleteComment(commentId, pollId)
      if ('success' in result) {
        setComments(prev => prev.filter(comment => comment.id !== commentId))
      }
    })
  }

  function handleLike(commentId: string) {
    const target = comments.find(comment => comment.id === commentId)
    if (!target?.is_liked) {
      trackEvent('comment_liked', {
        source_page: 'poll_detail',
        poll_id: pollId,
        poll_type: pollType,
        poll_status: pollStatus,
        creator_type: creatorType,
        comment_id: commentId,
      })
    }
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, is_liked: !c.is_liked, like_count: c.is_liked ? c.like_count - 1 : c.like_count + 1 }
        : c
    ))
    if (!isMockMode) {
      start(async () => { await toggleLike(commentId, pollId) })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 댓글 입력 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, 300))}
            placeholder="이번 투표에 대한 생각을 남겨주세요…"
            rows={2}
            className="h-[62px] flex-1 resize-none rounded-lg border border-border bg-surface px-[13px] py-[11px]
                       text-label-1-reading text-foreground placeholder:text-muted-foreground
                       focus:border-primary focus:outline-none"
          />
          <Button
            size="icon"
            className="h-10 w-10 flex-shrink-0 rounded-full bg-disabled text-muted-foreground hover:bg-disabled disabled:opacity-100"
            onClick={handleSubmit}
            disabled={!text.trim() || isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* 투표 항목 표시 힌트 */}
        {myVotedOptionLabel && (
          <p className="text-caption-2 text-muted-foreground flex items-center gap-1.5 px-1">
            <span className="opacity-60">💬</span>
            댓글에{' '}
            <CommentOptionBadge>{myVotedOptionLabel}</CommentOptionBadge>
            {' '}항목이 함께 표시됩니다
          </p>
        )}

        {text.length > 200 && (
          <p className="text-caption-1 text-muted-foreground text-right">{text.length} / 300</p>
        )}
      </div>

      {/* 댓글 목록 */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-g200">
        <div className="px-4 pb-3 pt-5">
          <p className="text-label-2 font-bold text-gray-1">
            댓글
          </p>
        </div>

        {comments.length === 0 ? (
          <p className="px-4 pb-6 pt-2 text-center text-label-1-normal text-muted-foreground">
            첫 번째 댓글을 남겨보세요
          </p>
        ) : (
          <div>
            {comments.map((comment, index) => {
              const name    = comment.user.display_name ?? '익명'
              const initial = name[0]?.toUpperCase() ?? '?'
              const isEditing = editingId === comment.id

              return (
                <div key={comment.id}>
                  <div className="flex gap-2 px-4 py-3">
                    <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
                      <AvatarFallback className="bg-secondary text-caption-1 font-bold text-secondary-foreground">
                        {initial}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5 leading-none">
                          <span className="text-caption-1 font-semibold text-foreground leading-none">{name}</span>
                          {/* 댓글 작성자의 투표 항목 칩 */}
                          {comment.voted_option_label && (
                            <CommentOptionBadge className="flex-shrink-0">
                              {comment.voted_option_label}
                            </CommentOptionBadge>
                          )}
                          <span className="text-caption-2 text-muted-foreground">
                            {formatRelative(comment.created_at)}
                          </span>
                          {comment._local && (
                            <span className="text-caption-2 text-primary">방금 등록</span>
                          )}
                        </div>
                        {comment.is_mine && !isEditing && (
                          <div className="flex flex-shrink-0 gap-2 text-caption-2 font-semibold text-muted-foreground">
                            <button type="button" onClick={() => startEditing(comment)} className="hover:text-foreground">
                              수정
                            </button>
                            <button type="button" onClick={() => handleDelete(comment.id)} className="hover:text-negative">
                              삭제
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={editingText}
                            onChange={event => setEditingText(event.target.value.slice(0, 300))}
                            rows={2}
                            className="resize-none rounded-sm border border-border bg-surface px-3 py-2 text-label-1-reading text-foreground focus:border-primary focus:outline-none"
                          />
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" variant="outline" className="h-8 px-2 text-caption-1" onClick={cancelEditing} disabled={isPending}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" className="h-8 px-2 text-caption-1" onClick={() => handleUpdate(comment.id)} disabled={!editingText.trim() || isPending}>
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-label-1-reading text-foreground">{comment.content}</p>
                      )}
                      <CommentReactionButton
                        count={comment.like_count}
                        isLiked={comment.is_liked}
                        disabled={isEditing}
                        onClick={() => handleLike(comment.id)}
                      />
                    </div>
                  </div>
                  {index < comments.length - 1 && (
                    <div className="mx-4 h-px bg-border" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function CommentOptionBadge({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-pill border-0 bg-primary-dim px-[9px] py-[3px] text-caption-2 font-semibold text-primary-dark pointer-events-none',
        className,
      ].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  )
}

function CommentReactionButton({
  count,
  isLiked,
  disabled,
  onClick,
}: {
  count: number
  isLiked: boolean
  disabled: boolean
  onClick: () => void
}) {
  const toneClass = isLiked
    ? 'text-primary font-semibold'
    : 'text-muted-foreground hover:text-foreground'
  const disabledClass = disabled ? 'pointer-events-none opacity-50' : ''

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'mt-1.5 inline-flex h-7 items-center gap-1 rounded-pill bg-disabled px-2 text-caption-2 transition-all duration-100 active:scale-90',
        toneClass,
        disabledClass,
      ].filter(Boolean).join(' ')}
    >
      <ThumbsUp className={cn('h-3 w-3', isLiked && 'fill-primary')} />
      <span>{count}</span>
    </button>
  )
}
