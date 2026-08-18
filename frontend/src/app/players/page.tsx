import { unstable_cache } from 'next/cache'
import { AppHeader } from '@/components/layout/AppHeader'
import { PlayersPageClient, type PlayerListItem } from '@/components/players/PlayersPageClient'
import { IS_MOCK } from '@/lib/config'
import { MOCK_PLAYERS } from '@/lib/mock/data'
import { getPlayerSeasonsFromSquadCsv } from '@/lib/players/season-data'
import { createPublicClient } from '@/lib/supabase/server'
import type { PlayerRow } from '@/types/database'

export const revalidate = 60

type PlayerWithRating = PlayerRow & {
  base_rating: number
  pick_one_rating?: number | null
}

function formatPlayedSeasons(seasons: Array<string | null | undefined>): string {
  const uniqueSeasons = Array.from(new Set(seasons.filter(Boolean) as string[])).sort()
  if (uniqueSeasons.length === 0) return ''
  if (uniqueSeasons.length === 1) return uniqueSeasons[0]

  const seasonSpells: string[][] = []
  for (const season of uniqueSeasons) {
    const currentStartYear = parseSeasonStartYear(season)
    const previousSpell = seasonSpells[seasonSpells.length - 1]
    const previousEndYear = previousSpell ? parseSeasonEndYear(previousSpell[previousSpell.length - 1]) : null

    if (!previousSpell || !currentStartYear || !previousEndYear || currentStartYear !== previousEndYear) {
      seasonSpells.push([season])
    } else {
      previousSpell.push(season)
    }
  }

  return seasonSpells.map(formatSeasonSpell).join(', ')
}

function formatSeasonSpell(seasons: string[]): string {
  const first = seasons[0]
  const last = seasons[seasons.length - 1]
  const firstYear = first.match(/\d{4}/)?.[0]
  const lastYear = parseSeasonEndYear(last)

  if (first === last) return first
  if (firstYear && lastYear) return `${firstYear}-${lastYear}`
  return `${first}-${last}`
}

function parseSeasonStartYear(season: string): number | null {
  const startYear = season.match(/\d{4}/)?.[0]
  return startYear ? Number(startYear) : null
}

function parseSeasonEndYear(season: string): number | null {
  const range = season.match(/^(\d{4})[-/](\d{2})$/)
  if (!range) return parseSeasonStartYear(season)

  const startYear = Number(range[1])
  const endSuffix = Number(range[2])
  const century = Math.floor(startYear / 100) * 100
  const endYear = century + endSuffix

  return endYear < startYear ? endYear + 100 : endYear
}

function toPlayerListItem(
  player: PlayerWithRating,
  index: number,
  seasonsByPlayerId = new Map<string, Array<string | null | undefined>>()
): PlayerListItem {
  const squadLabel = player.squad_status === 'first_team'
    ? '현 소속'
    : player.squad_status === 'loan'
      ? '임대'
      : 'U21'

  return {
    id: player.id,
    name: player.name,
    position: player.position,
    meta: player.squad_number ? `#${player.squad_number} · ${squadLabel}` : squadLabel,
    rank: index + 1,
    overall: Math.round(player.pick_one_rating ?? player.base_rating),
    photoUrl: player.photo_url,
    seasons: formatPlayedSeasons(seasonsByPlayerId.get(player.id) ?? getPlayerSeasonsFromSquadCsv(player.name)),
  }
}

async function getPlayersUncached(): Promise<PlayerListItem[]> {
  if (IS_MOCK) {
    return MOCK_PLAYERS
      .map((player, index) => ({ ...player, base_rating: 90 - index }))
      .map((player, index) => toPlayerListItem(player, index))
  }

  const supabase = createPublicClient()
  const { data } = await supabase
    .from('players')
    .select('id, name, position, squad_number, photo_url, base_rating, is_active, squad_status')
    .eq('is_active', true)
    .order('is_active', { ascending: false })
    .order('base_rating', { ascending: false })
    .order('name', { ascending: true })

  const players = (data ?? []) as PlayerWithRating[]
  const playerIds = players.map(player => player.id)
  const { data: pickOneRatings } = playerIds.length > 0
    ? await supabase
      .from('player_pick_one_ratings')
      .select('player_id, rating')
      .in('player_id', playerIds)
    : { data: [] }
  const ratingsByPlayerId = new Map(
    ((pickOneRatings ?? []) as Array<{ player_id: string; rating: number }>)
      .map(rating => [rating.player_id, rating.rating])
  )
  const seasonsByPlayerId = new Map<string, Array<string | null | undefined>>()

  return players
    .map(player => ({
      ...player,
      pick_one_rating: ratingsByPlayerId.get(player.id) ?? null,
    }))
    .sort((a, b) => (b.pick_one_rating ?? b.base_rating) - (a.pick_one_rating ?? a.base_rating) || a.name.localeCompare(b.name))
    .map((player, index) => toPlayerListItem(player, index, seasonsByPlayerId))
}

const getPlayers = unstable_cache(getPlayersUncached, ['players-ranking-v2'], {
  revalidate: 300,
})

export default async function PlayersPage() {
  const players = await getPlayers()

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="pb-24">
        <PlayersPageClient players={players} />
      </main>
    </>
  )
}
