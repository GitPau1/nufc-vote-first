import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RankingEntry {
  rank: number
  name: string
  totalPoints: number
  isMe?: boolean
  avatarUrl?: string | null
  /** null/undefined = 변동 표시 안 함. 양수 = ▲(상승), 음수 = ▼(하락) */
  delta?: number | null
}

export type RankingCardVariant = 'top3' | 'mine'

interface RankingCardProps {
  variant: RankingCardVariant
  /**
   * 시즌 누적 랭킹 전체(또는 필요한 범위) — variant="top3"는 이 중 상위 `limit`명을,
   * variant="mine"은 isMe 항목 하나를 뽑아 보여준다. 같은 배열을 두 variant에 그대로
   * 넘기면 된다(전체 랭킹/내 순위가 하나의 컴포넌트로 상태만 다르게 렌더되는 이유).
   */
  entries: RankingEntry[]
  /** variant="top3"일 때 노출할 인원 수 (기본 3) */
  limit?: number
  className?: string
}

export function RankingCard({ variant, entries, limit = 3, className }: RankingCardProps) {
  const rows = variant === 'top3' ? entries.slice(0, limit) : entriesOf(entries.find(e => e.isMe))
  const title = variant === 'top3' ? `전체 랭킹 TOP ${limit}` : '내 순위'
  // "내 순위" 미참여 상태는 프로토타입에도 있던 케이스. "TOP N 비어있음"은 참여자가 아직
  // 한 명도 없는 시즌 초반을 가정한 방어적 추가(프로토타입은 항상 156명짜리 목데이터라 이 경우가 없었다).
  const emptyMessage = variant === 'top3' ? '아직 랭킹 데이터가 없어요' : '아직 참여 기록이 없어요'

  return (
    <div className={cn('rounded-lg border border-neutral-weak bg-surface p-4 text-left', className)}>
      <p className="m-0 mb-3 text-body-2-normal font-bold text-neutral">{title}</p>

      {rows.length === 0 ? (
        <p className="m-0 text-caption-1 text-neutral-muted">{emptyMessage}</p>
      ) : (
        <>
          {variant === 'top3' && <RankHeaderRow />}
          {rows.map(entry => (
            <RankRow key={entry.rank} entry={entry} />
          ))}
        </>
      )}
    </div>
  )
}

function entriesOf(entry: RankingEntry | undefined): RankingEntry[] {
  return entry ? [entry] : []
}

function RankHeaderRow() {
  return (
    <div className="flex items-center gap-2 px-1 pb-2.5">
      <span className="w-8 shrink-0 text-center text-caption-2 font-bold text-neutral-muted">순위</span>
      <span className="h-7 w-7 shrink-0" />
      <span className="min-w-0 flex-1" />
      <span className="w-12 shrink-0 text-center text-caption-2 font-bold text-neutral-muted">총점</span>
    </div>
  )
}

function RankRow({ entry }: { entry: RankingEntry }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-b border-neutral-weak px-1 py-2.5 last:border-b-0',
        entry.isMe && 'rounded-md border-b-0 bg-brand-weak px-2'
      )}
    >
      <span className="flex w-8 shrink-0 flex-col items-center">
        <span className={cn('text-body-1-normal font-black text-neutral', entry.isMe && 'text-brand')}>
          {entry.rank}
        </span>
        <RankDelta delta={entry.delta} />
      </span>

      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-disabled text-neutral-subtle">
        {entry.avatarUrl ? (
          <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <User className="h-3.5 w-3.5" />
        )}
      </span>

      <span className="min-w-0 flex-1 truncate text-label-2 font-bold text-neutral">{entry.name}</span>

      <span className="w-12 shrink-0 text-center text-body-2-normal font-black text-brand">
        {entry.totalPoints}점
      </span>
    </div>
  )
}

function RankDelta({ delta }: { delta: RankingEntry['delta'] }) {
  if (delta === null || delta === undefined) return null
  // 한국식 상승/하락 관용 표기(▲ 상승=적색, ▼ 하락=회색) — 프로토타입 그대로 유지.
  // text-critical("되돌릴 수 없는 동작·위험"용 적색)이 "상승"에 쓰이는 점은 이름과 용법이
  // 어긋나 보일 수 있어 그대로 남겨둔다(Foundations/Color의 유일한 예외 사용처).
  return delta >= 0 ? (
    <span className="text-caption-2 font-bold text-critical">▲{delta}</span>
  ) : (
    <span className="text-caption-2 font-bold text-neutral-subtle">▼{Math.abs(delta)}</span>
  )
}
