import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampOverall,
  getKstWeekStart,
  applyPickOneChoice,
  summarizeWeeklyChoices,
} from './pick-one-rating.ts'

test('pick one rating favors an upset more than an expected win', () => {
  const expected = applyPickOneChoice(88, 82)
  const upset = applyPickOneChoice(82, 88)

  assert.ok(expected.winnerDelta < upset.winnerDelta)
  assert.equal(Number(expected.winnerDelta.toFixed(6)), Number((-expected.loserDelta).toFixed(6)))
  assert.equal(Number(upset.winnerDelta.toFixed(6)), Number((-upset.loserDelta).toFixed(6)))
})

test('pick one overall display is clamped to the supported range', () => {
  assert.equal(clampOverall(120), 99)
  assert.equal(clampOverall(12), 40)
  assert.equal(clampOverall(82.49), 82)
  assert.equal(clampOverall(82.5), 83)
})

test('pick one week starts at Sunday 00:00 KST', () => {
  assert.equal(getKstWeekStart(new Date('2026-06-20T14:59:59.000Z')).toISOString(), '2026-06-13T15:00:00.000Z')
  assert.equal(getKstWeekStart(new Date('2026-06-20T15:00:00.000Z')).toISOString(), '2026-06-20T15:00:00.000Z')
})

test('weekly choices summarize player rating changes', () => {
  const summary = summarizeWeeklyChoices({
    ratings: {
      bruno: 88,
      schar: 82,
    },
    choices: [
      { winnerPlayerId: 'schar', loserPlayerId: 'bruno' },
      { winnerPlayerId: 'bruno', loserPlayerId: 'schar' },
    ],
  })

  assert.equal(summary.schar.wins, 1)
  assert.equal(summary.schar.losses, 1)
  assert.equal(summary.bruno.wins, 1)
  assert.equal(summary.bruno.losses, 1)
  assert.ok(summary.schar.rating > 82)
  assert.ok(summary.bruno.rating < 88)
})
