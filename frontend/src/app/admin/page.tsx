import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarChart3, PlusCircle, Star } from 'lucide-react'
import { AppHeader } from '@/components/composition/common/AppHeader'
import { AdminSyncButton } from '@/components/composition/admin/AdminSyncButton'
import { Button } from '@/components/primitives/button'
import { RequireAuthModal } from '@/components/composition/auth/RequireAuthModal'
import { getHeaderAuth } from '@/lib/actions/auth'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
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

  return (
    <>
      <AppHeader auth={auth} />
      <main className="mx-auto min-h-[calc(100vh-56px)] max-w-shell bg-page px-4 pt-6 pb-24">
        <div className="mb-5">
          <p className="text-heading-2 font-semibold text-neutral">관리자 페이지</p>
          <p className="mt-1 text-label-1-reading text-neutral-muted">
            투표 생성·목록과 경기 결과·선수 평점을 관리할 수 있어요.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild size="lg" className="justify-start">
            <Link href="/polls/create">
              <PlusCircle className="h-4 w-4" />
              투표 만들기
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg" className="justify-start">
            <Link href="/polls">
              <BarChart3 className="h-4 w-4" />
              투표 목록 보기
            </Link>
          </Button>

          <Button asChild variant="outline" size="lg" className="justify-start">
            <Link href="/admin/ratings">
              <Star className="h-4 w-4" />
              경기별 선수 평점 입력
            </Link>
          </Button>

          <AdminSyncButton />
        </div>
      </main>
    </>
  )
}
