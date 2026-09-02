import { notFound, redirect } from 'next/navigation'
import { getPollById } from '@/lib/queries/polls'
import { getHeaderAuth } from '@/lib/actions/auth'
import { canAccessPollEdit, getEditablePollFields } from '@/lib/polls/poll-edit-eligibility'
import { PollPageHeader } from '@/components/composition/polls/PollPageHeader'
import { UserPollEditForm } from '@/components/composition/polls/UserPollEditForm'

interface PollEditPageProps {
  params: Promise<{ id: string }>
}

export default async function PollEditPage({ params }: PollEditPageProps) {
  const { id } = await params
  const poll = await getPollById(id)
  if (!poll) notFound()

  const auth = await getHeaderAuth()
  const editPoll = {
    status: poll.status,
    scheduled_at: poll.scheduled_at ?? null,
    closes_at: poll.closes_at,
    created_by: poll.created_by ?? null,
  }
  const actor = { userId: auth?.userId ?? null, isAdmin: auth?.isAdmin ?? false }

  // 클라이언트가 내려받은 canEdit을 신뢰하지 않는다 — URL 직접 접근 방어를 위해 서버에서 재검증.
  if (!canAccessPollEdit(editPoll, actor)) redirect(`/polls/${id}`)

  const editableFields = getEditablePollFields(editPoll)
  // DB status가 아직 'active'여도 closes_at이 지났으면 getEditablePollFields가 이미
  // effective status 기준으로 title을 잠근다 — poll.status를 따로 보면 그 시점에서
  // 문구·배너가 실제 편집 가능 필드와 어긋난다(자동 마감 처리 전 구간). editableFields를
  // 그대로 판정 근거로 재사용해 UserPollEditForm의 판정과 항상 같은 기준을 쓴다.
  const isClosed = !editableFields.includes('title')

  return (
    <>
      {/* 이 화면 안에서 또 "수정"을 누를 이유가 없어 action 없이 기본형("돌아가기"만) 그대로 둔다. */}
      <PollPageHeader />
      <main className="mx-auto max-w-detail px-4 pt-4 pb-24 animate-enter">
        <div className="mb-3">
          <h1 className="text-heading-2 sm:text-heading-1 font-semibold text-neutral">투표 수정</h1>
          <p className="mt-1 text-label-1-reading text-neutral-muted">
            {isClosed
              ? '대표 이미지만 수정할 수 있어요.'
              : '제목·설명·대표 이미지만 수정할 수 있어요. 투표 유형·선택지·마감시간은 투표 신뢰성을 위해 바꿀 수 없어요.'}
          </p>
        </div>
        <UserPollEditForm poll={poll} editableFields={editableFields} />
      </main>
    </>
  )
}
