'use client'

// 사용 도메인: predict (승부예측 포지션별 선수 선택 — Modal 껍데기에 끼워 쓴다)
// 참고: predict 도메인의 PlayerPhoto를 쓰므로 이 content는 composition/predict에 의존한다(사용자 결정 b안).

import { PlayerPhoto } from '@/components/predict/shared'
import { cn } from '@/lib/utils'
import { badgeVariants } from '@/components/primitives/badge'
import { SheetTitle } from '../sheet'

export interface PlayerPickCandidate {
  /** season_squads.fotmob_player_id */
  id: number
  name: string
  /** 등번호 미정이면 null */
  squadNumber: number | null
  /** 없으면 실루엣 원형으로 대체된다 */
  photoUrl: string | null
  nationality: string | null
  age: number | null
  /** 선택 시 점수 배당(예: ×1.7) */
  multiplier: number
}

interface PlayerPickContentProps {
  /** 모달 타이틀에 쓰일 라벨 — "미드필더 선택" */
  positionLabel: string
  players: PlayerPickCandidate[]
  /** 이미 이 포지션에 픽한 선수가 있으면(재오픈 케이스) 하이라이트 */
  selectedPlayerId?: number | null
  /**
   * 선수를 선택했을 때 호출된다. 선택과 동시에 닫지 않으므로,
   * 호출부에서 상태 반영 후 onOpenChange(false)까지 함께 호출해줘야 한다.
   */
  onSelect: (player: PlayerPickCandidate) => void
}

/**
 * 포지션별 선수 선택 모달의 **내용**(타이틀 + 목록). 껍데기(Modal)는 호출부가 씌운다.
 * 목록 스크롤 높이는 껍데기 골격이 정하지 않으므로 호출부에서 Modal의 className으로 주입한다
 * (`max-h-[78vh] overflow-y-auto hide-scrollbar sm:max-h-[80vh]`).
 */
export function PlayerPickContent({
  positionLabel,
  players,
  selectedPlayerId,
  onSelect,
}: PlayerPickContentProps) {
  return (
    <>
      <SheetTitle className="mb-3 text-headline-2 font-extrabold text-neutral">{positionLabel} 선택</SheetTitle>

      {players.length === 0 ? (
        <p className="py-8 text-center text-caption-1 text-neutral-muted">
          선택할 수 있는 선수가 없어요
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {players.map(player => (
            <PlayerPickRow
              key={player.id}
              player={player}
              selected={player.id === selectedPlayerId}
              onSelect={() => onSelect(player)}
            />
          ))}
        </div>
      )}
    </>
  )
}

function PlayerPickRow({
  player,
  selected,
  onSelect,
}: {
  player: PlayerPickCandidate
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center justify-between gap-2.5 rounded-md border border-neutral-weak bg-surface px-3.5 py-2.5 text-left transition-[border-color,background-color,transform] duration-micro',
        selected ? 'border-brand-solid bg-brand-weak' : 'hover:-translate-y-px hover:border-neutral-strong'
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="w-5 shrink-0 text-center text-label-2 font-extrabold text-neutral-muted">
          {player.squadNumber ?? '–'}
        </span>
        <PlayerPhoto url={player.photoUrl} />
        <span className="min-w-0">
          <p className="m-0 truncate text-body-2-normal font-bold text-neutral">{player.name}</p>
          <p className="m-0 mt-px text-caption-1 text-neutral-muted">
            {[player.nationality, player.age === null ? null : `${player.age}세`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </span>
      </span>
      {/* 행 전체가 <button>이라 Badge(div) 대신 badgeVariants()를 span에 얹는다. */}
      <span className={cn(badgeVariants(), 'shrink-0')}>×{player.multiplier.toFixed(1)}</span>
    </button>
  )
}
