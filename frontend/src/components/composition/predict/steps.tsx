import { cn } from '@/lib/utils'

export type StepKey = 'score' | 'pick' | 'confirm'

/** descMulti는 더블 매치위크(한 세션에 경기 2개)에서만 쓰는 대체 설명 — 스코어도 픽도 경기별로 입력한다. */
export const STEP_META: { key: StepKey; name: string; desc: string; descMulti?: string }[] = [
  { key: 'score',   name: '경기 예측', desc: '이번 경기의 스코어를 예측해보세요', descMulti: '이번 주 두 경기의 스코어를 예측해보세요' },
  { key: 'pick',    name: '선수 예측', desc: '포지션별로 이번 주 활약할 선수를 골라보세요', descMulti: '포지션별로 각 경기에서 활약할 선수를 골라보세요' },
  { key: 'confirm', name: '제출 전 확인', desc: '마지막으로 예측 내용을 확인해보세요' },
]

/**
 * 예측 진행 상단 우측 진행 표시 — 3분할 pill(현재 단계까지 brand-solid, 나머지 neutral-weak).
 * 예측 플로우 개편(2026-08-31)에서 좌측 사이드바 세로 스텝 트랙을 대체했다.
 */
export function ProgressPips({ current }: { current: StepKey }) {
  const currentIndex = STEP_META.findIndex(s => s.key === current)
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 pt-1"
      role="img"
      aria-label={`${STEP_META.length}단계 중 ${currentIndex + 1}단계`}
    >
      {STEP_META.map((step, i) => (
        <span
          key={step.key}
          className={cn(
            'h-1.5 w-6 rounded-pill transition-colors duration-micro',
            i <= currentIndex ? 'bg-brand-solid' : 'bg-neutral-weak',
          )}
        />
      ))}
    </div>
  )
}
