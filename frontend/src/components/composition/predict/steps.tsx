import { cn } from '@/lib/utils'

export type StepKey = 'score' | 'pick' | 'confirm'

/** descMulti는 더블 매치위크(한 세션에 경기 2개)에서만 쓰는 대체 설명 — 스코어도 픽도 경기별로 입력한다. */
export const STEP_META: { key: StepKey; name: string; desc: string; descMulti?: string }[] = [
  { key: 'score',   name: '경기 예측', desc: '이번 주 경기 스코어를 예측해보세요', descMulti: '이번 주 두 경기의 스코어를 예측해보세요' },
  { key: 'pick',    name: '선수 픽',   desc: '포지션별로 이번 주 활약할 선수를 골라보세요', descMulti: '포지션별로 각 경기에서 활약할 선수를 골라보세요' },
  { key: 'confirm', name: '확인',      desc: '제출하기 전, 예측 내용을 확인해보세요' },
]

function stepDesc(step: (typeof STEP_META)[number], multi: boolean): string {
  return multi && step.descMulti ? step.descMulti : step.desc
}

type NodeState = 'done' | 'active' | 'pending'

function nodeState(index: number, currentIndex: number): NodeState {
  return index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'pending'
}

function StepCircle({ state }: { state: NodeState }) {
  if (state === 'done') {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-brand-solid text-caption-2 font-black text-on-solid">
        ✓
      </span>
    )
  }
  return (
    <span
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-pill border-2 bg-surface',
        state === 'active' ? 'border-brand-solid' : 'border-neutral-weak',
      )}
    >
      {state === 'active' && <span className="h-2 w-2 rounded-pill bg-brand-solid" />}
    </span>
  )
}

/** 모바일 상단 가로 트랙 — 원형 노드와 커넥터만(라벨은 StepHero로 분리). */
export function StepTrack({ current }: { current: StepKey }) {
  const currentIndex = STEP_META.findIndex(s => s.key === current)
  return (
    <div className="flex w-1/2 items-center">
      {STEP_META.map((step, i) => (
        <div key={step.key} className="flex flex-1 items-center last:flex-none">
          <StepCircle state={nodeState(i, currentIndex)} />
          {i < STEP_META.length - 1 && (
            <div className={cn('mx-1.5 h-0.5 flex-1', i < currentIndex ? 'bg-brand-solid' : 'bg-neutral-weak')} />
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * 현재 단계 타이틀/설명. 기본 바깥 여백은 `mt-5`(트랙 바로 아래 붙는 자리 기준) —
 * 펼친 스텝 카드 안에 넣는 등 자리가 다르면 `className`으로 여백만 덮어써서 재사용한다.
 */
export function StepHero({
  current,
  multi = false,
  className,
}: {
  current: StepKey
  multi?: boolean
  className?: string
}) {
  const step = STEP_META.find(s => s.key === current)!
  return (
    <div className={cn('text-left', className ?? 'mt-5')}>
      <p className="text-headline-1 font-extrabold text-brand">{step.name}</p>
      <p className="mt-1 text-label-2 text-neutral-muted">{stepDesc(step, multi)}</p>
    </div>
  )
}

/** 데스크탑 사이드바 — 세로 트랙. 설명은 활성 단계에만 붙는다. */
export function StepTrackVertical({ current, multi = false }: { current: StepKey; multi?: boolean }) {
  const currentIndex = STEP_META.findIndex(s => s.key === current)
  return (
    <div className="flex flex-col">
      {STEP_META.map((step, i) => {
        const state = nodeState(i, currentIndex)
        return (
          <div key={step.key}>
            <div className="flex items-start gap-3">
              <StepCircle state={state} />
              <div>
                <span
                  className={cn(
                    'text-label-1-normal font-bold',
                    state === 'pending' ? 'text-neutral-muted' : 'text-neutral',
                  )}
                >
                  {step.name}
                </span>
                {state === 'active' && (
                  <p className="mt-1 max-w-[168px] text-caption-1 text-neutral-muted">{stepDesc(step, multi)}</p>
                )}
              </div>
            </div>
            {i < STEP_META.length - 1 && (
              <div className={cn('my-0.5 ml-[9px] h-6 w-0.5', i < currentIndex ? 'bg-brand-solid' : 'bg-neutral-weak')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
