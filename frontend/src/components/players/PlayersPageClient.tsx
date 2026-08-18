'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import { getPickOneDailyChoiceStatus, submitPickOneChoice } from '@/lib/actions/player-pick-one'
import { trackEvent } from '@/lib/analytics/mixpanel'

export type PlayerListItem = {
  id: string
  name: string
  position: string
  meta: string
  rank: number
  overall: number
  photoUrl: string | null
  seasons: string
}

type PlayersPageClientProps = {
  players: PlayerListItem[]
}

const positionTone: Record<string, string> = {
  GK: 'bg-primary-dim text-primary',
  DEF: 'bg-positive-dim text-positive',
  MID: 'bg-primary-dim text-primary-dark',
  FWD: 'bg-negative-dim text-negative',
  MGR: 'bg-disabled text-gray-2',
}

export function PlayersPageClient({ players }: PlayersPageClientProps) {
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()

  const filteredPlayers = useMemo(() => {
    if (!normalizedQuery) return players
    return players.filter(player =>
      `${player.name} ${player.position} ${player.meta} ${player.seasons}`.toLowerCase().includes(normalizedQuery)
    )
  }, [normalizedQuery, players])

  return (
    <div className="px-5 pt-4 pb-10 animate-enter">
      {players.length >= 2 && <PickOneSection players={players} />}

      <div className="mb-3 flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3">
        <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="선수 검색"
          className="h-full min-w-0 flex-1 bg-transparent text-label-2 font-medium text-foreground outline-none placeholder:text-gray-3"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3.5 pb-2 pt-3 text-caption-2 font-medium text-gray-3">
          <div className="flex items-center gap-[66px]">
            <span>순위</span>
            <span>이름</span>
          </div>
          <span>오버롤</span>
        </div>

        {filteredPlayers.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredPlayers.map(player => (
              <PlayerRow key={player.id} player={player} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 py-20">
            <p className="text-label-1-normal font-semibold text-foreground">검색 결과가 없습니다</p>
            <p className="text-caption-1 text-muted-foreground">다른 이름이나 포지션으로 찾아보세요</p>
          </div>
        )}
      </div>
    </div>
  )
}

type PickOnePhase = 'idle' | 'confirming' | 'centered'
type PickOneCardKey = 'leftCard' | 'rightCard'
type PickOneSlot = 'left' | 'right' | 'center' | 'out-left' | 'out-right' | 'out-down' | 'enter-left' | 'enter-right'
type PickOneCardState = {
  player: PlayerListItem
  slot: PickOneSlot
}

const slotClass: Record<PickOneSlot, string> = {
  left: 'translate-x-[12.5px]',
  right: 'translate-x-[calc(100%_+_36.5px)]',
  center: 'translate-x-[calc(50%_+_24.5px)]',
  'out-left': '-translate-x-[calc(100%_+_32px)] opacity-0',
  'out-right': 'translate-x-[calc(200%_+_75px)] opacity-0',
  'out-down': 'translate-x-[calc(50%_+_24.5px)] translate-y-[180px] opacity-0',
  'enter-left': '-translate-x-[calc(100%_+_32px)] opacity-0',
  'enter-right': 'translate-x-[calc(200%_+_75px)] opacity-0',
}

const PICK_ONE_TARGET_OVERALL = 80
const PICK_ONE_PREFERRED_MIN = 78
const PICK_ONE_PREFERRED_MAX = 83

function PickOneSection({ players }: { players: PlayerListItem[] }) {
  const initialPlayers = useMemo(() => getInitialMatchup(players), [players])
  const [phase, setPhase] = useState<PickOnePhase>('idle')
  const [selectedCardKey, setSelectedCardKey] = useState<PickOneCardKey | null>(null)
  const [feedback, setFeedback] = useState('')
  const [remainingChoices, setRemainingChoices] = useState<number | null>(null)
  const [choiceStatusLoaded, setChoiceStatusLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [cards, setCards] = useState<Record<PickOneCardKey, PickOneCardState>>(() => ({
    leftCard: { player: initialPlayers[0], slot: 'left' },
    rightCard: { player: initialPlayers[1], slot: 'right' },
  }))
  const [exitingCard, setExitingCard] = useState<PickOneCardState | null>(null)
  const initialMatchupPlayersRef = useRef(players)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const weightedPlayers = getWeightedInitialMatchup(initialMatchupPlayersRef.current)
    setCards({
      leftCard: { player: weightedPlayers[0], slot: 'left' },
      rightCard: { player: weightedPlayers[1], slot: 'right' },
    })
    setSelectedCardKey(null)
    setPhase('idle')
    trackEvent('pick_one_viewed', {
      source_page: 'players',
      left_player_id: weightedPlayers[0].id,
      right_player_id: weightedPlayers[1].id,
      left_overall: weightedPlayers[0].overall,
      right_overall: weightedPlayers[1].overall,
    })
  }, [])

  useEffect(() => {
    getPickOneDailyChoiceStatus().then(status => {
      setRemainingChoices(status.remaining)
      setChoiceStatusLoaded(true)
    })
  }, [])

  function proceedSelection(
    cardKey: PickOneCardKey,
    winner: PlayerListItem,
    loser: PlayerListItem,
    winnerSlot: PickOneSlot,
    loserSlot: PickOneSlot
  ) {
    const otherKey: PickOneCardKey = cardKey === 'leftCard' ? 'rightCard' : 'leftCard'

    setSelectedCardKey(cardKey)
    setPhase('confirming')
    setCards({
      [cardKey]: { player: winner, slot: winnerSlot },
      [otherKey]: { player: loser, slot: loserSlot },
    } as Record<PickOneCardKey, PickOneCardState>)

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setCards({
        [cardKey]: { player: winner, slot: 'center' },
        [otherKey]: { player: loser, slot: loserSlot === 'left' ? 'out-left' : 'out-right' },
      } as Record<PickOneCardKey, PickOneCardState>)
      setPhase('centered')
    }, 1000)
  }

  function selectCard(cardKey: PickOneCardKey) {
    if (phase !== 'idle' || isPending) return

    const otherKey: PickOneCardKey = cardKey === 'leftCard' ? 'rightCard' : 'leftCard'
    const winner = cards[cardKey].player
    const loser = cards[otherKey].player
    const winnerSlot = cards[cardKey].slot
    const loserSlot = cards[otherKey].slot
    setFeedback('')
    setSelectedCardKey(cardKey)
    setPhase('confirming')

    startTransition(async () => {
      const result = await submitPickOneChoice(winner.id, loser.id)
      if ('success' in result) {
        setRemainingChoices(result.remaining)
        trackEvent('pick_one_submitted', {
          source_page: 'players',
          winner_player_id: winner.id,
          loser_player_id: loser.id,
          winner_overall: winner.overall,
          loser_overall: loser.overall,
          result_state: 'saved',
        })
        setFeedback('이번 주 선택에 저장됐습니다. 한 번 더 누르면 다음 선택으로 넘어갑니다.')
        proceedSelection(cardKey, winner, loser, winnerSlot, loserSlot)
      } else if ('duplicate' in result) {
        setRemainingChoices(result.remaining)
        trackEvent('pick_one_submitted', {
          source_page: 'players',
          winner_player_id: winner.id,
          loser_player_id: loser.id,
          winner_overall: winner.overall,
          loser_overall: loser.overall,
          result_state: 'duplicate',
        })
        setFeedback('이번 주 이미 반영된 매치업입니다. 한 번 더 누르면 다음 선택으로 넘어갑니다.')
        proceedSelection(cardKey, winner, loser, winnerSlot, loserSlot)
      } else if (result.error === 'unauthenticated') {
        trackEvent('player_pick_one_auth_required', {
          source_page: 'players',
          trigger_action: 'player_pick_one',
        })
        setFeedback('로그인 후 선택을 기록할 수 있습니다.')
        setSelectedCardKey(null)
        setPhase('idle')
      } else if (result.error === 'daily_limit') {
        setRemainingChoices(result.remaining ?? 0)
        setFeedback('오늘 가능한 선택 5회를 모두 사용했습니다.')
        setSelectedCardKey(null)
        setPhase('idle')
      } else {
        setFeedback('선택을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.')
        setSelectedCardKey(null)
        setPhase('idle')
      }
    })
  }

  function showNextMatchup() {
    if (phase !== 'centered' || !selectedCardKey) return

    const winner = cards[selectedCardKey].player
    const otherKey: PickOneCardKey = selectedCardKey === 'leftCard' ? 'rightCard' : 'leftCard'
    const nextPlayers = getNextMatchup(players, [winner.id, cards[otherKey].player.id])
    setExitingCard({ player: winner, slot: 'center' })

    trackEvent('pick_one_next_clicked', {
      source_page: 'players',
      winner_player_id: winner.id,
      next_opponent_player_id: nextPlayers[1].id,
    })
    trackEvent('pick_one_viewed', {
      source_page: 'players',
      left_player_id: nextPlayers[0].id,
      right_player_id: nextPlayers[1].id,
      left_overall: nextPlayers[0].overall,
      right_overall: nextPlayers[1].overall,
    })
    setFeedback('')
    setSelectedCardKey(null)
    setPhase('idle')
    setCards({
      [selectedCardKey]: { player: nextPlayers[0], slot: 'enter-left' },
      [otherKey]: { player: nextPlayers[1], slot: 'enter-right' },
    } as Record<PickOneCardKey, PickOneCardState>)

    requestAnimationFrame(() => {
      window.setTimeout(() => {
        setExitingCard({ player: winner, slot: 'out-down' })
        setCards(current => ({
          ...current,
          [selectedCardKey]: { ...current[selectedCardKey], slot: 'left' },
          [otherKey]: { ...current[otherKey], slot: 'right' },
        }))
        window.setTimeout(() => setExitingCard(null), 700)
      }, 120)
    })
  }

  return (
    <section className="mb-3 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex justify-center border-b border-border px-3.5 pb-3 pt-3">
        <p className="whitespace-nowrap text-body-1-normal font-bold text-gray-1">
          여러분의 선택은?
        </p>
      </div>
      <div className="flex items-center justify-center px-4 pt-3 text-caption-1 font-semibold text-gray-2">
        {getRemainingChoiceLabel(choiceStatusLoaded, remainingChoices)}
      </div>

      <div className="relative h-[168px] overflow-hidden">
        {exitingCard && (
          <PickOneCard
            key={`exiting-${exitingCard.player.id}`}
            card={exitingCard}
            isPicked={false}
            isDimmed={false}
            onClick={() => {}}
          />
        )}
        <PickOneCard
          key={cards.leftCard.player.id}
          card={cards.leftCard}
          isPicked={selectedCardKey === 'leftCard'}
          isDimmed={(phase === 'confirming' && selectedCardKey === 'rightCard') || isPending}
          onClick={() => phase === 'centered' ? showNextMatchup() : selectCard('leftCard')}
        />
        <div className={`absolute left-1/2 top-[72px] flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-pill bg-disabled text-label-1-normal font-medium text-gray-3 transition-opacity duration-300 ${phase === 'centered' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
          vs
        </div>
        <PickOneCard
          key={cards.rightCard.player.id}
          card={cards.rightCard}
          isPicked={selectedCardKey === 'rightCard'}
          isDimmed={(phase === 'confirming' && selectedCardKey === 'leftCard') || isPending}
          onClick={() => phase === 'centered' ? showNextMatchup() : selectCard('rightCard')}
        />
      </div>

      <p className="px-4 pb-4 pt-2 text-center text-caption-1 text-gray-2">
        {feedback ||
          (phase === 'centered'
          ? '한 번 더 누르면 다음 선택으로 넘어갑니다.'
          : '여러분의 선택이 이번주 오버롤에 반영됩니다.')}
      </p>
      <Link
        href="/players/changes"
        onClick={() => trackEvent('player_rating_changes_clicked', { source_page: 'players' })}
        className="mx-4 mb-4 flex h-10 items-center justify-center rounded-md bg-disabled text-label-2 font-bold text-gray-1 active:bg-disabled"
      >
        이번주 변경 내역
      </Link>
    </section>
  )
}

function getRemainingChoiceLabel(loaded: boolean, remainingChoices: number | null): string {
  if (!loaded) return '오늘 남은 선택 확인 중'
  if (remainingChoices === null) return '로그인 후 참여 가능'
  return `오늘 남은 선택 ${remainingChoices}/5`
}

function getInitialMatchup(players: PlayerListItem[]): [PlayerListItem, PlayerListItem] {
  const sortedPlayers = players.slice().sort((a, b) => getPickOneWeight(b) - getPickOneWeight(a))
  return [sortedPlayers[0]!, sortedPlayers[1] ?? getNextOpponent(players, sortedPlayers[0]!)]
}

function getWeightedInitialMatchup(players: PlayerListItem[]): [PlayerListItem, PlayerListItem] {
  const left = weightedRandomPlayer(players)
  const right = weightedRandomPlayer(players.filter(player => player.id !== left.id))
  return [left, right]
}

function getNextMatchup(players: PlayerListItem[], excludedPlayerIds: string[]): [PlayerListItem, PlayerListItem] {
  const availablePlayers = players.filter(player => !excludedPlayerIds.includes(player.id))
  const pool = availablePlayers.length >= 2 ? availablePlayers : players

  return getWeightedInitialMatchup(pool)
}

function getPickOneWeight(player: PlayerListItem): number {
  if (player.overall >= PICK_ONE_PREFERRED_MIN && player.overall <= PICK_ONE_PREFERRED_MAX) {
    return 8
  }

  const distance = Math.min(
    Math.abs(player.overall - PICK_ONE_PREFERRED_MIN),
    Math.abs(player.overall - PICK_ONE_PREFERRED_MAX),
    Math.abs(player.overall - PICK_ONE_TARGET_OVERALL)
  )
  return 1 / (distance + 1)
}

function weightedRandomPlayer(players: PlayerListItem[]): PlayerListItem {
  const weightedPlayers = players.map(player => ({
    player,
    weight: getPickOneWeight(player),
  }))
  const totalWeight = weightedPlayers.reduce((sum, item) => sum + item.weight, 0)
  let cursor = Math.random() * totalWeight

  for (const item of weightedPlayers) {
    cursor -= item.weight
    if (cursor <= 0) return item.player
  }

  return players[0]!
}

function getNextOpponent(players: PlayerListItem[], basePlayer: PlayerListItem, currentOpponent?: PlayerListItem): PlayerListItem {
  const comparablePlayers = players.filter(player =>
    player.id !== basePlayer.id &&
    Math.abs(player.overall - basePlayer.overall) <= 2
  )
  const pool = comparablePlayers.length > 0
    ? comparablePlayers
    : players.filter(player => player.id !== basePlayer.id)
  const currentIndex = currentOpponent
    ? pool.findIndex(player => player.id === currentOpponent.id)
    : -1

  return pool[(currentIndex + 1) % pool.length]!
}

function PickOneCard({
  card,
  isPicked,
  isDimmed,
  onClick,
}: {
  card: PickOneCardState
  isPicked: boolean
  isDimmed: boolean
  onClick: () => void
}) {
  const player = card.player

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute left-0 top-5 flex h-32 w-[calc((100%_-_49px)/2)] flex-col items-center justify-center gap-2.5 rounded-lg bg-gray-1 p-3 text-left transition-[transform,opacity,filter,box-shadow] duration-700 ease-in-out will-change-transform ${slotClass[card.slot]} ${isPicked ? 'ring-4 ring-inset ring-primary' : ''} ${isDimmed ? 'opacity-[0.34] saturate-[0.35] duration-1000' : ''}`}
      aria-label={`${player.name} 선택`}
    >
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-pill border border-border bg-background">
        {player.photoUrl ? (
          <img src={player.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-caption-1 font-semibold text-primary">{player.position}</span>
        )}
      </div>
      <div className="w-full text-center">
        <p className="truncate text-label-1-reading font-semibold text-white">
          {player.name}
        </p>
        <div className="flex items-center justify-center gap-3 text-caption-2 text-disabled">
          <span>{player.position}</span>
          {player.seasons && <span className="truncate">{player.seasons}</span>}
        </div>
      </div>
    </button>
  )
}

function PlayerRow({ player }: { player: PlayerListItem }) {
  const tone = positionTone[player.position] ?? 'bg-disabled text-gray-2'

  return (
    <div className="flex h-[68px] items-center gap-2.5 px-3.5 py-2.5">
      <div className="relative h-6 w-6 flex-shrink-0">
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-label-2 font-semibold text-gray-2">
          {player.rank}
        </span>
      </div>

      <div className={`flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center overflow-hidden rounded-pill ${player.photoUrl ? 'bg-disabled' : tone}`}>
        {player.photoUrl ? (
          <img src={player.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="text-caption-1 font-medium">{player.position}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-label-1-reading font-semibold text-foreground">
          {player.name}
        </p>
        <div className="flex items-center gap-3 text-caption-2 text-gray-2">
          <span>{player.position}</span>
          {player.seasons && <span className="truncate">{player.seasons}</span>}
        </div>
      </div>

      <div className="w-8 flex-shrink-0 text-center text-body-1-normal font-semibold text-foreground">
        {player.overall}
      </div>
    </div>
  )
}
