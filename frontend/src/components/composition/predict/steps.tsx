import { cn } from '@/lib/utils'

export type StepKey = 'score' | 'pick' | 'confirm'

/** descMulti는 더블 매치위크(한 세션에 경기 2개)에서만 쓰는 대체 설명 — 스코어도 픽도 경기별로 입력한다. */
export const STEP_META: { key: StepKey; name: string; desc: string; descMulti?: string }[] = [
  { key: 'score',   name: '경기 예측', desc: '이번 경기의 스코어를 예측해보세요', descMulti: '이번 주 두 경기의 스코어를 예측해보세요' },
  { key: 'pick',    name: '선수 예측', desc: '포지션별로 이번 주 활약할 선수를 골라보세요', descMulti: '포지션별로 각 경기에서 활약할 선수를 골라보세요' },
  { key: 'confirm', name: '제출 전 확인', desc: '마지막으로 예측 내용을 확인해보세요' },
]

/**
 * 예측 진행 상단 우측 진행 표시 — N분할 pill(현재 단계까지 brand-solid, 나머지 neutral-weak).
 * 예측 플로우 개편(2026-08-31)에서 좌측 사이드바 세로 스텝 트랙을 대체했다.
 *
 * 기본은 STEP_META 3단계(`current`만으로 유도)지만, 더블 매치위크처럼 경기마다 score/pick을
 * 반복하는 세션은 점 개수가 고정 3이 아니다(feature-spec §9.2) — `total`/`activeIndex`를 넘기면
 * 그 값을 우선한다. 모양·색은 그대로이고 점 개수·활성 위치만 동적이다.
 */
export function ProgressPips({
  current,
  total,
  activeIndex,
}: {
  current: StepKey
  /** 점 총 개수. 생략하면 STEP_META.length(3). */
  total?: number
  /** 0-based 활성 위치. 생략하면 current로 STEP_META에서 유도. */
  activeIndex?: number
}) {
  const dotCount = total ?? STEP_META.length
  const currentIndex = activeIndex ?? STEP_META.findIndex(s => s.key === current)
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 pt-1"
      role="img"
      aria-label={`${dotCount}단계 중 ${currentIndex + 1}단계`}
    >
      {Array.from({ length: dotCount }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-6 rounded-pill transition-colors duration-micro',
            i <= currentIndex ? 'bg-brand-solid' : 'bg-neutral-weak',
          )}
        />
      ))}
    </div>
  )
}
