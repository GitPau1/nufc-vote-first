'use client'

import { usePathname } from 'next/navigation'

/**
 * 앱 전체를 감싸는 최상위 셸 컨테이너.
 *
 * 헤더가 있는 화면(AppHeader/PollPageHeader를 쓰는 거의 전부)은 이제 데스크탑에서 항상 같은
 * 풀와이드 GNB를 보여주므로, 배경도 함께 화면 전체 흰색으로 통일한다 — 폭 제한은 각 화면 내부에서
 * 스스로 건다(목록류는 --content-w 1140px, 랭킹·폼류는 --shell-w 480px, 투표 상세류는 --detail-w 680px).
 *
 * **셸(SHELL_PATHS만)**: 헤더 자체가 없는 독립 화면(온보딩)만 예외 — 모바일(<640px)에서는
 * 화면 폭 전체를 그대로 쓰는 카드형 뷰이고, 데스크탑(≥640px)에서는 --shell-w(480px)로 고정된 카드가
 * 중앙에 뜨고 좌우 여백은 body의 기본 배경(bg-page)이 그대로 드러난다. (예전엔 이 여백에
 * .shell-desktop-bg 장식 그라디언트를 깔았는데 안 쓰기로 해서 걷어냈다 — 2026-08-23.) (로그인은
 * 더 이상 페이지가 아니라 LoginModal이라 여기 나열할 대상 자체가 없다 — 어떤 화면 위에서든 모달로 뜬다.)
 *
 * 세로(top/bottom) 여백은 의도적으로 주지 않는다 — BottomNav, 스티키 액션바,
 * NavigationLoading 등 fixed 요소가 뷰포트 기준으로 위치하기 때문에,
 * 세로 마진을 주면 셸 카드 밖으로 삐져나온다.
 */
const SHELL_PATHS = ['/onboarding']

export function PageContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (!SHELL_PATHS.includes(pathname)) {
    return <div className="relative min-h-screen w-full bg-page">{children}</div>
  }

  return (
    <div className="relative min-h-screen w-full">
      <div className="relative mx-auto min-h-screen w-full max-w-shell bg-page sm:border-x sm:border-neutral-weak/60">
        {children}
      </div>
    </div>
  )
}
