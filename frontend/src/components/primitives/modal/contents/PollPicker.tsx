'use client'

// 사용 도메인: polls (투표 생성 폼의 선수 선택 시트 — Modal 껍데기에 끼워 쓴다)
// 참고: poll 도메인 헬퍼(POSITION_ORDER·isSelectablePlayer 등)를 담으므로 이 content는
// polls 도메인 로직에 의존한다(사용자 결정 b안). 공용으로 쓰이는 PlayerPickMode·getPlayerMeta는
// UserPollCreateForm 본문도 쓰므로 여기서 export한다(순환 방지: 이 파일은 폼을 import하지 않는다).

import { useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import type { PollFormPlayer } from '@/lib/queries/polls'
import type { Position } from '@/types/database'
import { SheetHeader, SheetTitle, SheetDescription } from '../sheet'
import { Button } from '@/components/primitives/button'

export type PlayerPickMode = 'single' | 'multiple'
type PlayerFilter = 'all' | 'first_team' | 'loan' | 'u21'

const POSITION_ORDER: Array<Position | 'ETC'> = ['GK', 'DEF', 'MID', 'FWD', 'MGR', 'ETC']
const POSITION_LABEL: Record<Position | 'ETC', string> = {
  GK: '골키퍼',
  DEF: '수비수',
  MID: '미드필더',
  FWD: '공격수',
  MGR: '감독',
  ETC: '기타',
}

const PLAYER_FILTERS: Array<{ id: PlayerFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'first_team', label: '1군' },
  { id: 'loan', label: '임대' },
  { id: 'u21', label: 'U21' },
]

function isSelectablePlayer(player: PollFormPlayer): boolean {
  return player.is_active
}

export function getPlayerMeta(player: PollFormPlayer): string {
  const number = player.squad_number ? `#${player.squad_number}` : '번호 없음'
  const status = !player.is_active ? '구단 외' : player.squad_status === 'loan' ? '임대' : player.squad_status === 'u21' ? 'U21' : '1군'
  return `${player.position ?? '기타'} · ${number} · ${status}`
}

/**
 * 투표 생성 폼의 선수 선택 시트 **내용**(검색바 + 필터 + 포지션별 목록 + 선택 완료 버튼).
 * 껍데기(Modal)는 호출부가 씌운다 — 전체높이 시트라 호출부에서
 * `className="flex h-[82vh] max-h-[82vh] flex-col overflow-hidden p-0"`를 Modal에 준다.
 */
export function PollPickerContent({
  mode,
  players,
  selectedIds,
  onToggle,
  onDone,
}: {
  mode: PlayerPickMode
  players: PollFormPlayer[]
  selectedIds: string[]
  onToggle: (playerId: string) => void
  onDone: () => void
}) {
  const [query, setQuery] = useState('')
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('all')
  const normalizedQuery = query.trim().toLowerCase()

  const positionGroups = useMemo(() => {
    const filtered = players.filter(player => {
      if (!normalizedQuery) return true
      const haystack = `${player.name} ${player.position ?? ''} ${player.squad_number ?? ''}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    }).filter(player => {
      if (!isSelectablePlayer(player)) return false
      if (playerFilter === 'all') return true
      return player.squad_status === playerFilter
    })

    return POSITION_ORDER.map(position => ({
      key: position,
      label: POSITION_LABEL[position],
      players: filtered.filter(player => (player.position ?? 'ETC') === position),
    })).filter(positionGroup => positionGroup.players.length > 0)
  }, [players, normalizedQuery, playerFilter])

  return (
    <>
      <SheetHeader className="sr-only">
        <SheetTitle className="text-headline-1 font-semibold">선수 선택</SheetTitle>
        <SheetDescription className="text-caption-1">
          {mode === 'single' ? '투표 대상 선수 1명을 선택합니다.' : '투표 후보로 올릴 선수를 선택합니다.'}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-3 border-b border-neutral-weak px-4 py-3">
        {/* 오른쪽 여백은 껍데기의 X 닫기 버튼(우측 상단)을 피하려고 둔 것이다. X는 중앙 모달에만
            남았으므로(바텀시트는 드래그 핸들) Modal의 전환 기준과 같은 md(768px)부터만 준다. */}
        <div className="flex h-10 items-center gap-2 rounded-sm border border-neutral-weak bg-surface px-3 md:mr-10">
          <Search className="h-4 w-4 text-neutral-muted" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-label-2 font-medium outline-none"
            placeholder="선수 검색"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
          {PLAYER_FILTERS.map(filter => {
            const selected = filter.id === playerFilter
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setPlayerFilter(filter.id)}
                className={`shrink-0 rounded-pill border px-2.5 py-1 text-caption-2 font-medium transition-opacity hover:opacity-70 ${selected ? 'border-brand-solid bg-brand-solid text-on-solid' : 'border-neutral-weak bg-surface text-neutral-muted'}`}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto hide-scrollbar px-4 py-3">
        {positionGroups.length === 0 ? (
          <p className="py-12 text-center text-label-1-normal font-medium text-neutral">검색 결과가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {positionGroups.map(positionGroup => (
              <section key={positionGroup.key} className="space-y-1.5">
                <p className="px-0.5 text-caption-1 font-medium text-neutral-muted">{positionGroup.label}</p>
                {positionGroup.players.map(player => {
                  const selected = selectedIds.includes(player.id)
                  return (
                    <button
                      key={player.id}
                      type="button"
                      onClick={() => onToggle(player.id)}
                      className={`flex w-full items-center gap-3 rounded-sm border px-3 py-2 text-left transition-opacity hover:opacity-70 ${selected ? 'border-brand-solid bg-brand-weak' : 'border-neutral-weak bg-surface'}`}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-disabled text-caption-1 font-medium text-brand">
                        {player.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={player.photo_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          player.name.slice(0, 2)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-label-2 font-medium text-neutral">{player.name}</p>
                        <p className="mt-0.5 text-caption-2 font-medium text-neutral-muted">{getPlayerMeta(player)}</p>
                      </div>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border ${selected ? 'border-brand-solid bg-brand-solid text-on-solid' : 'border-neutral-weak text-transparent'}`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>
                  )
                })}
              </section>
            ))}
          </div>
        )}
      </div>
      {mode === 'multiple' && (
        <div className="border-t border-neutral-weak bg-surface px-4 py-3">
          <Button type="button" onClick={onDone} size="lg" className="w-full">
            {selectedIds.length}명 선택 완료
          </Button>
        </div>
      )}
    </>
  )
}
