import type { PollStatus } from '@/types/database'
import { getEffectivePollStatus } from '@/lib/polls/status'

export type PollEditPoll = {
  status: PollStatus
  closes_at: string
  created_by: string | null
}

export type PollEditActor = {
  userId: string | null
  isAdmin: boolean
}

export type EditablePollField = 'title' | 'description' | 'thumbnail_url'

/** 진입 가능 여부: 작성자 본인 또는 관리자만.
 *  now는 더 이상 이 함수에서 쓰이지 않지만, resolvePollEditUpdate 등 호출부가 다른 함수와
 *  같은 시그니처로 맞춰 넘기고 있어 그대로 받는다. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function canAccessPollEdit(poll: PollEditPoll, actor: PollEditActor, now = new Date()): boolean {
  if (actor.isAdmin) return true
  return !!actor.userId && actor.userId === poll.created_by
}

/** 상태별 저장 가능 필드. */
export function getEditablePollFields(poll: PollEditPoll, now = new Date()): EditablePollField[] {
  const status = getEffectivePollStatus(poll, now)
  return status === 'active' ? ['title', 'description', 'thumbnail_url'] : ['thumbnail_url']
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

/** updateUserPoll(실연동)·mockUpdatePoll(mock) 공통부 — 권한 확인 → payload 구성 →
 *  상태별 허용 필드 검사 → 제목 필수 검사까지 한 번에 처리하는 순수 함수. FormData 파싱과
 *  실제 저장(DB update/스토리지 정리)은 호출부 몫이다.
 *
 *  `fieldsPresent`의 각 값은 "그 키가 폼에 존재했을 때의 문자열 값"이고, `undefined`는
 *  "그 키가 폼에 아예 없었다"는 뜻이다(closed 상태에서는 title/description input 자체가
 *  없어 formData.has()가 false) — 값이 아니라 존재 여부로 부분 업데이트를 구성해야 하므로
 *  이 구분이 필요하다. */
export function resolvePollEditUpdate(
  poll: PollEditPoll,
  actor: PollEditActor,
  fieldsPresent: { title?: string; description?: string; thumbnail_url?: string },
  now = new Date()
): { ok: true; payload: Record<string, string | null> } | { ok: false; error: string } {
  if (!canAccessPollEdit(poll, actor, now)) {
    return { ok: false, error: '수정 권한이 없습니다.' }
  }

  const payload: Record<string, string | null> = {}
  if (fieldsPresent.title !== undefined) payload.title = fieldsPresent.title.trim()
  if (fieldsPresent.description !== undefined) payload.description = fieldsPresent.description.trim() || null
  if (fieldsPresent.thumbnail_url !== undefined) payload.thumbnail_url = fieldsPresent.thumbnail_url.trim() || null

  const check = validatePollEditPayload(poll, Object.keys(payload), now)
  if (!check.ok) return { ok: false, error: '수정할 수 없는 항목입니다.' }

  if ('title' in payload && !payload.title) return { ok: false, error: '투표 제목을 입력해주세요.' }

  return { ok: true, payload }
}
