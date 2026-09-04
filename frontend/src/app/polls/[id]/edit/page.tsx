import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { getPollById } from '@/lib/queries/polls'
import { IS_MOCK } from '@/lib/config'
import { isAdmin } from '@/lib/admin'
import { canAccessPollEdit, getEditablePollFields } from '@/lib/polls/poll-edit-eligibility'
import { PollPageHeader } from '@/components/composition/polls/PollPageHeader'
import { UserPollEditForm } from '@/components/composition/polls/UserPollEditForm'

interface PollEditPageProps {
  params: Promise<{ id: string }>
}

// polls/[id]/page.tsx와 같은 인라인 auth 체크 — 공용 헬퍼로 안 뽑는 게 이 리포 관례
// (polls/create/page.tsx, polls/[id]/page.tsx도 각자 인라인). getHeaderAuth()(비캐시
// getUser + users 테이블 SELECT)를 또 부르지 않고, 여기서 얻은 user로 isAdmin(user.email)까지
// 직접 계산한다.
async function getCurrentUser() {
  if (IS_MOCK) {
    const cookieStore = await cookies()
    if (cookieStore.get('mock-auth')?.value === 'true') {
      // mock 유저는 email이 없어 isAdmin이 항상 false — 작성자 케이스는 fixture로 이미
      // 커버되므로 허용한다(polls/[id]/page.tsx와 같은 이유).
      return { id: 'mock-user', email: undefined as string | undefined }
    }
    return null
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
}

export default async function PollEditPage({ params }: PollEditPageProps) {
  const { id } = await params
  // poll 조회와 auth 확인을 병렬로 — 형제 페이지(polls/[id]/page.tsx)와 같은 패턴.
  const [poll, user] = await Promise.all([getPollById(id), getCurrentUser()])
  if (!poll) notFound()

  const editPoll = {
    status: poll.status,
    closes_at: poll.closes_at,
    created_by: poll.created_by ?? null,
  }
  const actor = { userId: user?.id ?? null, isAdmin: isAdmin(user?.email) }

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
