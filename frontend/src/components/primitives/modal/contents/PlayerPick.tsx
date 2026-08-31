'use client'

// 사용 도메인: predict (승부예측 포지션별 선수 선택 — Modal 껍데기에 끼워 쓴다)
// 참고: predict 도메인의 PlayerPhoto를 쓰므로 이 content는 composition/predict에 의존한다(사용자 결정 b안).

import { PlayerPhoto, ToonCost } from '@/components/composition/predict/shared'
import { cn } from '@/lib/utils'
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
  /** 툰 비용(1~3). 옛 배당을 대체한다. */
  cost: number
}

interface PlayerPickContentProps {
  /** 모달 타이틀에 쓰일 라벨 — "미드필더 선택" */
  positionLabel: string
  players: PlayerPickCandidate[]
  /** 이미 이 포지션에 픽한 선수가 있으면(재오픈 케이스) 하이라이트 */
  selectedPlayerId?: number | null
  /**
   * 이 포지션에 쓸 수 있는 남은 툰(= 5 − 다른 두 포지션 비용 합). 비용이 이보다 큰 후보는
   * 선택 불가(흐림)로 막는다. 생략 시 제한 없음(Storybook 등).
   */
  remainingBudget?: number
  /**
   * 선수를 선택했을 때 호출된다. 선택과 동시에 닫지 않으므로,
   * 호출부에서 상태 반영 후 onOpenChange(false)까지 함께 호출해줘야 한다.
   */
  onSelect: (player: PlayerPickCandidate) => void
}

/**
 * 포지션별 선수 선택 모달의 **내용**(타이틀 + 목록). 껍데기(Modal)는 호출부가 씌운다.
 *
 * 스크롤은 **목록 영역만** 한다 — 타이틀(과 시트의 드래그 핸들)은 제자리에 고정된다.
 * 그래서 껍데기 쪽 높이 제한은 `overflow-y-auto`가 아니라 세로 flex + `overflow-hidden`으로 주입한다
 * (`flex max-h-[78vh] flex-col overflow-hidden sm:max-h-[80vh]`, PollPicker와 같은 구조).
 * 껍데기가 통째로 스크롤되면 목록을 내려볼 때 타이틀·핸들까지 화면 밖으로 밀려 올라간다.
 */
export function PlayerPickContent({
  positionLabel,
  players,
  selectedPlayerId,
  remainingBudget = Infinity,
  onSelect,
}: PlayerPickContentProps) {
  return (
    <>
      <SheetTitle className="mb-3 shrink-0 text-headline-2 font-semibold text-neutral">{positionLabel} 선택</SheetTitle>

      {/* 스크롤 영역 — 타이틀·드래그 핸들은 밖에 두어 고정된다. min-h-0이 없으면
          flex 항목의 min-content 하한 때문에 목록이 줄지 않고 시트가 넘친다. */}
      <div className="min-h-0 flex-1 overflow-y-auto hide-scrollbar">
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
                // 현재 선택된 선수는 예산을 넘겨도 다시 고를 수 있어야 한다(재오픈).
                disabled={player.cost > remainingBudget && player.id !== selectedPlayerId}
                onSelect={() => onSelect(player)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function PlayerPickRow({
  player,
  selected,
  disabled,
  onSelect,
}: {
  player: PlayerPickCandidate
  selected: boolean
  disabled: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-center justify-between gap-2.5 rounded-md border border-neutral-weak bg-surface px-3.5 py-2.5 text-left transition-[border-color,background-color,transform] duration-micro',
        selected
          ? 'border-brand-solid bg-brand-weak'
          : disabled
            ? 'cursor-not-allowed opacity-50'
            : 'hover:-translate-y-px hover:border-neutral-strong',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="w-5 shrink-0 text-center text-label-2 font-medium text-neutral-muted">
          {player.squadNumber ?? '–'}
        </span>
        <PlayerPhoto url={player.photoUrl} />
        <span className="min-w-0">
          <p className="m-0 truncate text-body-2-normal font-semibold text-neutral">{player.name}</p>
          <p className="m-0 mt-px text-caption-1 text-neutral-muted">
            {[player.nationality, player.age === null ? null : `${player.age}세`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </span>
      </span>
      <ToonCost cost={player.cost} className="shrink-0" />
    </button>
  )
}
