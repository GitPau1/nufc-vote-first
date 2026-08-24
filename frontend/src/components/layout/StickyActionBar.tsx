import { cn } from '@/lib/utils'

interface StickyActionBarProps {
  className?: string
  children: React.ReactNode
}

/**
 * 화면 하단 제출 버튼 바.
 * TypeAPollClient·TypeBPollClient·OverallRatingPollClient(투표 3종)와 PredictionFlowClient
 * (승부예측 제출)에 거의 동일하게 복붙돼 있던 마크업을 통합한 것.
 * 폭·데스크탑 정렬처럼 화면마다 다른 부분은 `className`으로 넘긴다(예측 플로우는 더 좁은 폭 +
 * 데스크탑 가운데 고정폭 버튼). 공유하는 건 "모바일 fixed → 데스크탑 static" 전환 로직이다.
 *
 * 모바일(<640px): 뷰포트 기준 fixed로 하단 고정 — 앱 패턴.
 * 데스크탑(≥640px): fixed를 풀고 컨텐츠 흐름 안에 자연스럽게 놓는다 — 계속 화면에 붙어있는 게
 * 데스크탑 폼에서는 어색하고, max-w-detail(680px)로 폭이 잘린 흰 카드가 하단 가운데 떠 있는 것처럼
 * 보이는 문제가 있었다(피드백 반영). 일반 웹 폼의 "맨 아래 제출 버튼"과 동일한 자리에 둔다.
 *
 * 모바일 fixed 상태는 뷰포트 기준이므로 PageContainer에 세로 마진을 주면 카드 밖으로 삐져나온다
 * (자세한 이유는 PageContainer 주석 참고).
 */
export function StickyActionBar({ className, children }: StickyActionBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-0 left-1/2 z-30 w-full max-w-detail -translate-x-1/2 border-t bg-surface-translucent p-4 backdrop-blur',
        'sm:static sm:left-0 sm:z-auto sm:mx-auto sm:w-full sm:max-w-detail sm:translate-x-0 sm:border-t-0 sm:bg-transparent sm:p-0 sm:pb-10 sm:backdrop-blur-none',
        className
      )}
    >
      {children}
    </div>
  )
}
