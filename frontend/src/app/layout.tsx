import type { Metadata } from 'next'
import { Suspense } from 'react'
import './globals.css'
import { BottomNav } from '@/components/layout/BottomNav'
import { NavigationLoading } from '@/components/layout/NavigationLoading'
import { AuthCodeHandler } from '@/components/auth/AuthCodeHandler'
import { AppAnalytics } from '@/components/analytics/AppAnalytics'

export const metadata: Metadata = {
  title: 'NUFC Vote',
  description: '뉴캐슬 유나이티드 팬 투표 플랫폼',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-background min-h-screen">
        <div className="max-w-[480px] mx-auto min-h-screen bg-background relative">
          <AppAnalytics />
          <NavigationLoading />
          {children}
          <BottomNav />
          {/* OAuth 코드가 어느 페이지에 붙어 오든 세션 교환 처리 */}
          <Suspense fallback={null}>
            <AuthCodeHandler />
          </Suspense>
        </div>
      </body>
    </html>
  )
}
