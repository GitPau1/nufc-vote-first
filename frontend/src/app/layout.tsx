import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { BottomNav } from '@/components/layout/BottomNav'
import { NavigationLoading } from '@/components/layout/NavigationLoading'
import { PageContainer } from '@/components/layout/PageContainer'
import { AuthCodeHandler } from '@/components/auth/AuthCodeHandler'
import { AppAnalytics } from '@/components/analytics/AppAnalytics'

export const metadata: Metadata = {
  title: 'NUFC Vote',
  description: '뉴캐슬 유나이티드 팬 투표 플랫폼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background">
        <PageContainer>
          <AppAnalytics />
          <NavigationLoading />
          {children}
          <BottomNav />
          {/* OAuth 코드가 어느 페이지에 붙어 오든 세션 교환 처리 */}
          <Suspense fallback={null}>
            <AuthCodeHandler />
          </Suspense>
        </PageContainer>
      </body>
    </html>
  )
}
