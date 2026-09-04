import assert from 'node:assert/strict'
import test from 'node:test'
import { competitionColorBucket, COMPETITION_GLOW, COMPETITION_WASH, COMPETITION_BADGE, weekGlowClass, WEEK_GLOW_BRAND } from './competitionColor.ts'

test('Premier League → violet', () => {
  assert.equal(competitionColorBucket('Premier League'), 'violet')
})
test('Club Friendlies → yellow', () => {
  assert.equal(competitionColorBucket('Club Friendlies'), 'yellow')
})
test('알려진 컵 대회 5종 → green', () => {
  for (const name of ['EFL Cup', 'FA Cup', 'Europa League', 'Europa Conference League', 'Champions League']) {
    assert.equal(competitionColorBucket(name), 'green', name)
  }
})
test('목록에 없는 새 값 → green (fallback)', () => {
  assert.equal(competitionColorBucket('Some New Cup'), 'green')
})
test('null/undefined/빈 문자열 → green (확정 B안)', () => {
  assert.equal(competitionColorBucket(null), 'green')
  assert.equal(competitionColorBucket(undefined), 'green')
  assert.equal(competitionColorBucket(''), 'green')
})
test('룩업 3개는 버킷 3종을 전부 덮고 클래스명 접두어가 맞다', () => {
  for (const [table, prefix] of [[COMPETITION_GLOW, 'competition-glow-'], [COMPETITION_WASH, 'competition-wash-'], [COMPETITION_BADGE, 'competition-badge-']]) {
    for (const bucket of ['violet', 'green', 'yellow']) {
      assert.equal(table[bucket], `${prefix}${bucket}`)
    }
  }
})

test('weekGlowClass: Premier League 하나 → competition-wash-violet', () => {
  assert.equal(weekGlowClass(['Premier League']), 'competition-wash-violet')
})
test('weekGlowClass: EFL Cup + FA Cup(같은 버킷) → competition-wash-green', () => {
  assert.equal(weekGlowClass(['EFL Cup', 'FA Cup']), 'competition-wash-green')
})
test('weekGlowClass: Club Friendlies 하나 → competition-wash-yellow', () => {
  assert.equal(weekGlowClass(['Club Friendlies']), 'competition-wash-yellow')
})
test('weekGlowClass: [null] → competition-wash-green (fallback)', () => {
  assert.equal(weekGlowClass([null]), 'competition-wash-green')
})
test('weekGlowClass: Premier League + EFL Cup(버킷 2종) → spotlight-glow-brand', () => {
  assert.equal(weekGlowClass(['Premier League', 'EFL Cup']), WEEK_GLOW_BRAND)
})
test('weekGlowClass: 경기 없음([]) → spotlight-glow-brand', () => {
  assert.equal(weekGlowClass([]), WEEK_GLOW_BRAND)
})
