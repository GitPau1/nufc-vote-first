import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { AppHeader } from '@/components/layout/AppHeader'
import { RequireAuthModal } from '@/components/auth/RequireAuthModal'
import { AdminRatingsForm } from '@/components/admin/AdminRatingsForm'
import { getHeaderAuth } from '@/lib/actions/auth'
import { getFixtureWeeks } from '@/lib/queries/fixtures'
import { getFixtureRatings } from '@/lib/queries/predictions'
import { getPickCandidates } from '@/lib/queries/squads'
import { NUFC_LABEL } from '@/lib/predictions/week'

export const dynamic = 'force-dynamic'

/**
 * 경기별 선수 평점 입력(관리자 전용, 최소 형태).
 * 이 평점이 곧 선수 픽 점수의 입력값이다 — 행이 없는 선수는 0점으로 계산되므로, 경기가 끝나면
 * 여기서 평점을 넣어야 결과·랭킹 화면이 의미를 갖는다(`prediction_pick_points`).
 *
 * 자동화(sofascore 스크래핑)로 대체될 자리라 화면은 최소로 둔다 — 경기 하나 고르고, 픽 후보
 * 전원(DEF/MID/FWD)의 평점을 손으로 넣는 것까지.
 */
export default async function AdminRatingsPage({
  searchParams,
}: {
  searchParams: { fixture?: string }
}) {
  const auth = await getHeaderAuth()

  if (!auth) {
    return (
      <>
        <AppHeader />
        <RequireAuthModal />
      </>
    )
  }
  if (!auth.isAdmin) redirect('/')

  const weeks = await getFixtureWeeks()
  // 평점은 끝난 경기에만 넣는다. 최근 경기가 위로 오게 뒤집는다(막 끝난 경기를 가장 자주 입력한다).
  const finished = weeks
    .flatMap(week => week.matches.map(match => ({ week, match })))
    .filter(({ match }) => match.finished)
    .reverse()

  const selectedId = searchParams.fixture ?? finished[0]?.match.id
  const selected = finished.find(({ match }) => match.id === selectedId)

  const [candidates, ratings] = await Promise.all([
    getPickCandidates(),
    selected ? getFixtureRatings(selected.match.id) : Promise.resolve({}),
  ])

  return (
    <>
      <AppHeader auth={auth} />
      <main className="mx-auto min-h-[calc(100vh-62px)] max-w-shell bg-page px-4 pb-24 pt-6">
        <Link href="/admin" className="inline-flex items-center gap-1 text-label-2 font-bold text-neutral-muted">
          <ChevronLeft className="h-4 w-4" />
          관리자 페이지
        </Link>

        <div className="mb-5 mt-3">
          <p className="text-heading-2 font-black text-neutral">경기별 선수 평점</p>
          {/* 페이지 제목 아래 설명문은 읽기용 토큰(text-label-1-reading)으로 통일한다 —
              admin/menu/폼 페이지가 전부 이 토큰을 쓴다. */}
          <p className="mt-1 text-label-1-reading text-neutral-muted">
            평점을 넣지 않은 선수는 그 경기 픽 점수가 0점으로 계산돼요.
          </p>
        </div>

        {finished.length === 0 ? (
          <p className="text-label-1-normal text-neutral-muted">아직 종료된 경기가 없어요.</p>
        ) : (
          <AdminRatingsForm
            fixtures={finished.map(({ week, match }) => ({
              id: match.id,
              label: `${match.kickoff} ${weekLabel(week.weekNo)} ${NUFC_LABEL} vs ${match.opponent}${
                match.actual ? ` (${match.actual[0]}-${match.actual[1]})` : ''
              }`,
            }))}
            selectedFixtureId={selected?.match.id ?? ''}
            candidates={candidates}
            ratings={ratings}
          />
        )}
      </main>
    </>
  )
}

function weekLabel(weekNo: number): string {
  return `${weekNo}주차`
}
