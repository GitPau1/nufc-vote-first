import { getHeaderAuth } from '@/lib/actions/auth'
import { AppHeader } from '@/components/layout/AppHeader'
import { MenuActions } from './MenuActions'

export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  const auth = await getHeaderAuth()

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="mx-auto min-h-[calc(100vh-56px)] max-w-shell bg-background px-5 pt-6 pb-24">
        <div className="mb-5">
          <p className="text-heading-2 font-black text-foreground">메뉴</p>
          <p className="mt-1 text-label-1-reading text-muted-foreground">
            {auth ? '계정과 서비스 메뉴를 관리할 수 있어요.' : '로그인하면 내 투표와 참여 기록을 확인할 수 있어요.'}
          </p>
        </div>

        <MenuActions isLoggedIn={Boolean(auth)} isAdmin={Boolean(auth?.isAdmin)} />
      </main>
    </>
  )
}
