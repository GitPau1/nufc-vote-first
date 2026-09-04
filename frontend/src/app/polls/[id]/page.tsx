import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { getPollById, getVoteCounts, getMyVote, getMyRatingVoteCount, getRatingResults } from '@/lib/queries/polls'
import { getComments } from '@/lib/queries/comments'
import { PollClient } from '@/components/composition/polls/PollClient'
import { OverallRatingPollClient } from '@/components/composition/polls/OverallRatingPollClient'
import { OverallRatingResultView } from '@/components/composition/polls/OverallRatingResultView'
import { ResultView } from '@/components/composition/polls/ResultView'
import { IS_MOCK } from '@/lib/config'
import { isAdmin } from '@/lib/admin'
import { canAccessPollEdit } from '@/lib/polls/poll-edit-eligibility'

interface PollPageProps {
  params: Promise<{ id: string }>
}

async function getCurrentUser() {
  if (IS_MOCK) {
    const cookieStore = await cookies()
    if (cookieStore.get('mock-auth')?.value === 'true') {
      // email 없음(mock 유저는 이메일 개념이 없다) — isAdmin(undefined)는 항상 false라
      // mock 모드에서 관리자 케이스는 재현할 수 없다. 작성자 본인 케이스는
      // poll-1/poll-4 fixture(created_by: 'mock-user')로 이미 커버되므로 허용한다.
      return { id: 'mock-user', email: undefined as string | undefined, user_metadata: { name: '뉴캐슬 팬', avatar_url: null } }
    }
    return null
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
}

export default async function PollPage({ params }: PollPageProps) {
  const { id } = await params
  const pollPromise = getPollById(id)
  const userPromise = getCurrentUser()
  const [user, poll] = await Promise.all([userPromise, pollPromise])

  if (!poll) notFound()

  const isClosed = poll.status === 'closed'
  // getHeaderAuth()(비캐시 getUser + users 테이블 SELECT)를 또 부르지 않는다 — 위에서 이미
  // 얻은 user로 충분하다(createUserPoll·sync-fixtures.ts가 이미 쓰는 방식과 동일).
  const canEdit = canAccessPollEdit(
    { status: poll.status, closes_at: poll.closes_at, created_by: poll.created_by ?? null },
    { userId: user?.id ?? null, isAdmin: isAdmin(user?.email) }
  )

  if (poll.type === 'overall_rating') {
    const targetCount = poll.poll_options.filter(option => option.player_id).length
    const ratingVoteCount = user || IS_MOCK ? await getMyRatingVoteCount(id, user?.id ?? 'mock-user') : 0
    const hasRated = targetCount > 0 && ratingVoteCount >= targetCount

    if (isClosed || hasRated) {
      const results = await getRatingResults(poll, user?.id ?? null)
      return <OverallRatingResultView poll={poll} results={results} hasVoted={hasRated} canEdit={canEdit} />
    }

    return <OverallRatingPollClient poll={poll} isAuthenticated={!!user} canEdit={canEdit} />
  }

  // 내 투표 여부 확인
  // mock 모드: 로그인 여부와 무관하게 쿠키 확인 (투표 후 로그아웃해도 결과 유지)
  const myOptionId = IS_MOCK
    ? await getMyVote(id, 'mock-user')
    : user ? await getMyVote(id, user.id) : null
  const hasVoted = !!myOptionId

  // 결과 표시 조건: 마감됐거나 이미 투표함
  const showResult = isClosed || hasVoted

  if (showResult) {
    const [voteCounts, comments] = await Promise.all([
      getVoteCounts(id),
      getComments(id, user?.id ?? null),
    ])
    return (
      <ResultView
        poll={poll}
        voteCounts={voteCounts}
        myOptionId={myOptionId}
        comments={comments}
        canEdit={canEdit}
      />
    )
  }

  // 아직 투표 전
  return <PollClient poll={poll} isAuthenticated={!!user} canEdit={canEdit} />
}
