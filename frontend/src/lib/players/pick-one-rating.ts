export const PICK_ONE_K_FACTOR = 1.2
export const PICK_ONE_RATING_SCALE = 12

export type PickOneChoiceInput = {
  winnerPlayerId: string
  loserPlayerId: string
}

export type WeeklyChoiceSummary = Record<string, {
  rating: number
  wins: number
  losses: number
}>

export function clampOverall(rating: number): number {
  return Math.min(99, Math.max(40, Math.round(rating)))
}

export function applyPickOneChoice(winnerRating: number, loserRating: number) {
  const expected = 1 / (1 + 10 ** ((loserRating - winnerRating) / PICK_ONE_RATING_SCALE))
  const winnerDelta = PICK_ONE_K_FACTOR * (1 - expected)

  return {
    winnerRating: winnerRating + winnerDelta,
    loserRating: loserRating - winnerDelta,
    winnerDelta,
    loserDelta: -winnerDelta,
  }
}

export function getKstWeekStart(date = new Date()): Date {
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstDate = new Date(date.getTime() + kstOffsetMs)
  const day = kstDate.getUTCDay()

  kstDate.setUTCHours(0, 0, 0, 0)
  kstDate.setUTCDate(kstDate.getUTCDate() - day)

  return new Date(kstDate.getTime() - kstOffsetMs)
}

export function summarizeWeeklyChoices({
  ratings,
  choices,
}: {
  ratings: Record<string, number>
  choices: PickOneChoiceInput[]
}): WeeklyChoiceSummary {
  const summary: WeeklyChoiceSummary = {}

  function ensurePlayer(playerId: string) {
    if (!summary[playerId]) {
      summary[playerId] = {
        rating: ratings[playerId] ?? 80,
        wins: 0,
        losses: 0,
      }
    }
    return summary[playerId]
  }

  for (const choice of choices) {
    const winner = ensurePlayer(choice.winnerPlayerId)
    const loser = ensurePlayer(choice.loserPlayerId)
    const result = applyPickOneChoice(winner.rating, loser.rating)

    winner.rating = result.winnerRating
    winner.wins += 1
    loser.rating = result.loserRating
    loser.losses += 1
  }

  return summary
}
