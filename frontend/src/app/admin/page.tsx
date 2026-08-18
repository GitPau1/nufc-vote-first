import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BarChart3, PlusCircle } from 'lucide-react'
import { AppHeader } from '@/components/layout/AppHeader'
import { Button } from '@/components/ui/button'
import { getHeaderAuth } from '@/lib/actions/auth'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const auth = await getHeaderAuth()

  if (!auth) redirect('/login')
  if (!auth.isAdmin) redirect('/')

  return (
    <>
      <AppHeader auth={auth} />
      <main className="min-h-[calc(100vh-62px)] bg-background px-4 pt-6 pb-24">
        <div className="mb-5">
          <p className="text-heading-2 font-black text-foreground">관리자 페이지</p>
          <p className="mt-1 text-label-2 text-muted-foreground">
            투표 생성과 공개된 투표 목록을 관리할 수 있어요.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild className="h-12 justify-start">
            <Link href="/polls/create">
              <PlusCircle className="h-4 w-4" />
              투표 만들기
            </Link>
          </Button>

          <Button asChild variant="outline" className="h-12 justify-start">
            <Link href="/polls">
              <BarChart3 className="h-4 w-4" />
              투표 목록 보기
            </Link>
          </Button>
        </div>
      </main>
    </>
  )
}
