import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { BottomNav } from '@/components/composition/common/BottomNav'
import { FeedbackFab } from '@/components/composition/common/FeedbackFab'
import { NavigationLoading } from '@/components/primitives/navigation-loading'
import { PageContainer } from '@/components/primitives/page-container'
import { AuthCodeHandler } from '@/components/composition/auth/AuthCodeHandler'
import { AppAnalytics } from '@/components/composition/common/AppAnalytics'

export const metadata: Metadata = {
  title: 'NUFC Vote',
  description: '뉴캐슬 유나이티드 팬 투표 플랫폼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-page">
        <PageContainer>
          <AppAnalytics />
          <NavigationLoading />
          {children}
          <BottomNav />
          <FeedbackFab />
          {/* OAuth 코드가 어느 페이지에 붙어 오든 세션 교환 처리 */}
          <Suspense fallback={null}>
            <AuthCodeHandler />
          </Suspense>
        </PageContainer>
      </body>
    </html>
  )
}
