import type { PollStatus } from '@/types/database'
import { getEffectivePollStatus } from '@/lib/polls/status'

export type PollEditPoll = {
  status: PollStatus
  scheduled_at: string | null
  closes_at: string
  created_by: string | null
}

export type PollEditActor = {
  userId: string | null
  isAdmin: boolean
}

export type EditablePollField = 'title' | 'description' | 'thumbnail_url'

/** 진입 가능 여부: scheduled 제외 + 작성자 본인 또는 관리자만. */
export function canAccessPollEdit(poll: PollEditPoll, actor: PollEditActor, now = new Date()): boolean {
  const status = getEffectivePollStatus(poll, now)
  if (status === 'scheduled') return false
  if (actor.isAdmin) return true
  return !!actor.userId && actor.userId === poll.created_by
}

/** 상태별 저장 가능 필드. */
export function getEditablePollFields(poll: PollEditPoll, now = new Date()): EditablePollField[] {
  const status = getEffectivePollStatus(poll, now)
  if (status === 'active') return ['title', 'description', 'thumbnail_url']
  if (status === 'closed') return ['thumbnail_url']
  return []
}

/** 서버 액션이 payload 키를 검사할 때 쓴다 — 허용 안 된 키가 있으면 거절. */
export function validatePollEditPayload(
  poll: PollEditPoll,
  payloadKeys: string[],
  now = new Date()
): { ok: true } | { ok: false; disallowedKey: string } {
  const allowed = new Set(getEditablePollFields(poll, now))
  for (const key of payloadKeys) {
    if (!allowed.has(key as EditablePollField)) return { ok: false, disallowedKey: key }
  }
  return { ok: true }
}
