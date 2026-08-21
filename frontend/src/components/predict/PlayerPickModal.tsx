'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

// 프로토타입 .badge / .badge-default 그대로 (선수 배당 표시용)
const BADGE_DEFAULT_CLASS =
  'inline-flex shrink-0 items-center rounded-pill bg-primary-dim px-[9px] py-[3px] text-caption-2 font-bold text-primary-dark'

export interface PlayerPickCandidate {
  id: string
  name: string
  squadNumber: number
  photoUrl: string
  nationality: string
  age: number
  /** 선택 시 점수 배당(예: ×1.7) */
  multiplier: number
}

interface PlayerPickModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 모달 타이틀에 쓰일 라벨 — "미드필더 선택" */
  positionLabel: string
  players: PlayerPickCandidate[]
  /** 이미 이 포지션에 픽한 선수가 있으면(재오픈 케이스) 하이라이트 */
  selectedPlayerId?: string | null
  /**
   * 선수를 선택했을 때 호출된다. 프로토타입은 선택과 동시에 모달을 닫으므로,
   * 호출부에서 상태 반영 후 onOpenChange(false)까지 함께 호출해줘야 한다.
   */
  onSelect: (player: PlayerPickCandidate) => void
}

/**
 * "예측하기" 플로우의 포지션별 선수 선택 모달.
 * 모바일: 하단 바텀시트(드래그 핸들 표시) / 데스크탑(sm+): 중앙 다이얼로그로 전환.
 * ui/sheet.tsx의 바텀시트는 항상 하단 고정이라 이 반응형 전환을 표현할 수 없어서
 * Radix Dialog를 직접 써서 이 컴포넌트 전용 variant로 구성했다(다른 모달에 영향 없음).
 * 덕분에 포커스 트랩·ESC 닫기는 프로토타입엔 없던 접근성 개선으로 함께 따라온다.
 */
export function PlayerPickModal({
  open,
  onOpenChange,
  positionLabel,
  players,
  selectedPlayerId,
  onSelect,
}: PlayerPickModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/*
          위치 정렬은 여기(Overlay)의 flex가 전부 담당한다 — Content 쪽에 별도의
          left-1/2/-translate-x-1/2 같은 중앙정렬용 transform을 두면, 진입 애니메이션이
          같은 transform 속성을 덮어써서 "정렬이 풀렸다가 스냅되는" 것처럼 보인다(예전 버그).
          모바일=하단 정렬, 데스크탑(sm+)=중앙 정렬, 모션은 Content에서 가볍게만 얹는다.
        */}
        <DialogPrimitive.Overlay
          className={cn(
            'fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150'
          )}
        >
          <DialogPrimitive.Content
            className={cn(
              'relative w-full max-w-shell max-h-[78vh] overflow-y-auto rounded-t-lg bg-surface px-4 py-5',
              'sm:max-w-[420px] sm:max-h-[80vh] sm:rounded-lg',
              // 가벼운 페이드 + 살짝 위로(8px) 올라오는 모션 하나로 모바일/데스크탑 공통 처리.
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 data-[state=open]:duration-200 data-[state=open]:ease-out',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-2 data-[state=closed]:duration-150'
            )}
          >
            {/* 드래그 핸들 — 모바일 바텀시트 전용. 자리를 차지하지 않게 절대 위치(top:8px)로 띄워서
                타이틀-상단 거리가 sheet padding(20px)만으로 결정되게 한다. */}
            <div className="absolute left-1/2 top-2 h-[5px] w-10 -translate-x-1/2 rounded-pill bg-gray-4 sm:hidden" />

            <DialogPrimitive.Title className="m-0 mb-3 text-headline-2 font-extrabold">
              {positionLabel} 선택
            </DialogPrimitive.Title>

            {players.length === 0 ? (
              <p className="py-8 text-center text-caption-1 text-gray-2">
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
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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
        'flex w-full items-center justify-between gap-2.5 rounded-md border border-gray-4 bg-surface px-3.5 py-2.5 text-left transition-[border-color,background-color,transform]',
        selected ? 'border-primary bg-primary-dim' : 'hover:-translate-y-px hover:border-gray-3'
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="w-5 shrink-0 text-center text-label-2 font-extrabold text-gray-3">
          {player.squadNumber}
        </span>
        <img
          src={player.photoUrl}
          alt=""
          className="h-16 w-16 shrink-0 rounded-full bg-disabled object-cover"
        />
        <span className="min-w-0">
          <p className="m-0 truncate text-body-2-normal font-bold text-black">{player.name}</p>
          <p className="m-0 mt-px text-caption-1 text-gray-3">
            {player.nationality} · {player.age}세
          </p>
        </span>
      </span>
      <span className={BADGE_DEFAULT_CLASS}>×{player.multiplier.toFixed(1)}</span>
    </button>
  )
}
