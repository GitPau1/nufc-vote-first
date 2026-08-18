import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('players page keeps the Figma Pick One section above search', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /여러분의 선택은\?/)
  assert.match(file, /여러분의 선택이 이번주 오버롤에 반영됩니다\./)
  assert.match(file, /PickOneSection/)
})

test('players Pick One uses the approved card transition states', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /phase.*'idle'.*'confirming'.*'centered'/s)
  assert.match(file, /setTimeout[\s\S]*1000/)
  assert.match(file, /window\.setTimeout[\s\S]*120/)
  assert.match(file, /enter-right/)
  assert.match(file, /requestAnimationFrame\(\(\) => \{\s*window\.setTimeout/s)
  assert.match(file, /한 번 더 누르면 다음 선택으로 넘어갑니다\./)
  assert.match(file, /ring-4 ring-inset ring-primary/)
  assert.doesNotMatch(file, /Target/)
  assert.doesNotMatch(file, /PickOneResult/)
})

test('players page keeps original rank while filtering', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /rank: number/)
  assert.match(file, /<PlayerRow key=\{player\.id\} player=\{player\} \/>/)
  assert.match(file, /\{player\.rank\}/)
  assert.doesNotMatch(file, /rank=\{index \+ 1\}/)
})

test('players list shows seasons instead of squad status metadata', () => {
  const file = source('components/players/PlayersPageClient.tsx')
  const playerRow = file.slice(file.indexOf('function PlayerRow'))

  assert.match(playerRow, /\{player\.seasons\}/)
  assert.doesNotMatch(playerRow, /\{player\.meta\}/)
})

test('players Pick One starts from a weighted overall band around high-70s and low-80s', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /PICK_ONE_TARGET_OVERALL = 80/)
  assert.match(file, /PICK_ONE_PREFERRED_MIN = 78/)
  assert.match(file, /PICK_ONE_PREFERRED_MAX = 83/)
  assert.match(file, /function getPickOneWeight/)
  assert.match(file, /function getWeightedInitialMatchup/)
  assert.match(file, /weightedRandomPlayer/)
  assert.match(file, /useState<Record<PickOneCardKey, PickOneCardState>>\(\(\) => \(\{\s*leftCard: \{ player: initialPlayers\[0\], slot: 'left' \}/s)
  assert.match(file, /useEffect\(\(\) => \{\s*const weightedPlayers = getWeightedInitialMatchup\(initialMatchupPlayersRef\.current\)/s)
})

test('players Pick One keeps the clicked matchup while the choice is saved', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /proceedSelection\(cardKey, winner, loser, winnerSlot, loserSlot\)/)
  assert.match(file, /function proceedSelection\(\s*cardKey: PickOneCardKey,\s*winner: PlayerListItem,\s*loser: PlayerListItem/s)
  assert.match(file, /\[cardKey\]: \{ player: winner, slot:/)
  assert.match(file, /\[otherKey\]: \{ player: loser, slot:/)
  assert.match(file, /const initialMatchupPlayersRef = useRef\(players\)/)
  assert.match(file, /useEffect\(\(\) => \{\s*const weightedPlayers = getWeightedInitialMatchup\(initialMatchupPlayersRef\.current\)[\s\S]*\}, \[\]\)/)
})

test('players Pick One uses the current visual slots when the winner stays on screen', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /const winnerSlot = cards\[cardKey\]\.slot/)
  assert.match(file, /const loserSlot = cards\[otherKey\]\.slot/)
  assert.doesNotMatch(file, /const selectedSlot: PickOneSlot = cardKey === 'leftCard' \? 'left' : 'right'/)
  assert.match(file, /\[cardKey\]: \{ player: winner, slot: winnerSlot \}/)
  assert.match(file, /\[otherKey\]: \{ player: loser, slot: loserSlot \}/)
})

test('players Pick One success feedback tells users to tap again', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /이번 주 선택에 저장됐습니다\. 한 번 더 누르면 다음 선택으로 넘어갑니다\./)
  assert.match(file, /이번 주 이미 반영된 매치업입니다\. 한 번 더 누르면 다음 선택으로 넘어갑니다\./)
})

test('players Pick One starts a fresh matchup after each completed choice', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /const nextPlayers = getNextMatchup\(players, \[winner\.id, cards\[otherKey\]\.player\.id\]\)/)
  assert.match(file, /setExitingCard\(\{ player: winner, slot: 'out-down' \}\)/)
  assert.match(file, /\[selectedCardKey\]: \{ player: nextPlayers\[0\], slot: 'enter-left' \}/)
  assert.match(file, /\[otherKey\]: \{ player: nextPlayers\[1\], slot: 'enter-right' \}/)
  assert.doesNotMatch(file, /\[selectedCardKey\]: \{ player: winner, slot: 'left' \}/)
})

test('players Pick One shows remaining daily participation count', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /getPickOneDailyChoiceStatus/)
  assert.match(file, /remainingChoices/)
  assert.match(file, /오늘 남은 선택/)
  assert.match(file, /setRemainingChoices\(result\.remaining\)/)
  assert.match(file, /확인 중/)
  assert.match(file, /로그인 후 참여 가능/)
  assert.doesNotMatch(file, /remainingChoices \?\? 5/)
})

test('players page applies the mobile layout foundation', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.match(file, /className="px-5 pt-4 pb-10 animate-enter"/)
  assert.match(file, /mb-3 overflow-hidden rounded-lg border border-border bg-surface/)
  assert.match(file, /overflow-hidden rounded-lg border border-border bg-surface/)
  assert.doesNotMatch(file, /<div className="overflow-hidden rounded-md border border-border bg-surface">/)
})

test('players page uses foundation typography and color tokens', () => {
  const file = source('components/players/PlayersPageClient.tsx')

  assert.doesNotMatch(file, /text-\[[^\]]+\]|leading-\[[^\]]+\]|tracking-\[[^\]]+\]/)
  assert.doesNotMatch(file, /bg-\[#|text-\[#|shadow-\[|ring-\[/)
})
