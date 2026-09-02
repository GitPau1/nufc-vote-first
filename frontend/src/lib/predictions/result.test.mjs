import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadResultModule() {
  const source = fs.readFileSync(path.join(__dirname, 'result.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: true },
  }).outputText

  const cjsModule = { exports: {} }
  new Function('exports', 'module', compiled)(cjsModule.exports, cjsModule)
  return cjsModule.exports
}

const { ratingTier, aggregateWeekResult, ourScoreOrder, matchResultState, matchHit, buildTop3Entries } =
  loadResultModule()

const match = (id, { finished = true, isHome = true } = {}) => ({
  id,
  competition: 'Premier League',
  opponent: 'Arsenal',
  opponentId: 9825,
  isHome,
  kickoff: '8/23',
  kickoffTime: '오후 8:00',
  kickoffAt: null,
  locked: true,
  finished,
  actual: finished ? [2, 0] : null,
})

const result = (matchPoints, pickPoints) => ({
  predicted: [2, 1],
  matchPoints,
  pickPoints,
  totalPoints: matchPoints + pickPoints,
  picks: {
    DEF: { playerId: 1, rating: 7.8, points: 5 },
    MID: { playerId: 2, rating: 6.2, points: 0 },
    FWD: { playerId: 3, rating: 5.4, points: 0 },
  },
})

test('ratingTier: 픽 점수 기준(7.0)과 중간 구간(6.0)에서 색이 갈린다', () => {
  assert.equal(ratingTier(7.0), 'good')
  assert.equal(ratingTier(6.9), 'mid')
  assert.equal(ratingTier(6.0), 'mid')
  assert.equal(ratingTier(5.9), 'bad')
  // 평점이 없으면(미출전/미집계) 색을 정하지 않는다
  assert.equal(ratingTier(null), null)
})

test('aggregateWeekResult: 더블 매치위크는 두 경기 점수를 모두 더한다', () => {
  const week = { matches: [match('101'), match('102')] }
  const results = { 101: result(3, 5), 102: result(2, 0) }
  const ranking = [
    { rank: 1, isMe: false },
    { rank: 2, isMe: true },
    { rank: 3, isMe: false },
  ]

  const agg = aggregateWeekResult(week, results, ranking)
  assert.deepEqual(agg, { matchPoints: 5, pickPoints: 5, totalPoints: 10, rank: 2, totalEntries: 3 })
})

test('aggregateWeekResult: 채점된 경기가 없으면 null(미참여)', () => {
  const week = { matches: [match('101')] }
  assert.equal(aggregateWeekResult(week, {}, []), null)
})

test('aggregateWeekResult: 랭킹에 내 행이 없으면 rank는 null이고 인원수는 그대로 센다', () => {
  const week = { matches: [match('101')] }
  const agg = aggregateWeekResult(week, { 101: result(2, 3) }, [{ rank: 1, isMe: false }])
  assert.equal(agg.rank, null)
  assert.equal(agg.totalEntries, 1)
})

test('ourScoreOrder: 원정 경기는 [홈, 원정] → [우리, 상대]로 뒤집는다', () => {
  assert.deepEqual(ourScoreOrder([2, 1], true), [2, 1])
  assert.deepEqual(ourScoreOrder([2, 1], false), [1, 2])
})

test('matchResultState: 같은 주차 안에서도 경기별로 상태가 갈린다', () => {
  const results = { 101: result(3, 0) }
  assert.equal(matchResultState(match('101'), results).kind, 'scored')
  // 끝났는데 채점 결과가 없으면 = 마감돼서 참여하지 못한 경기
  assert.equal(matchResultState(match('102'), results).kind, 'missed')
  // 아직 안 끝난 경기는 그 주 다른 경기만 끝난 상태
  assert.equal(matchResultState(match('103', { finished: false }), results).kind, 'pending')
})

test('matchHit: DB prediction_match_points와 같은 3단계로 갈린다', () => {
  // 스코어까지 정확 (8점)
  assert.equal(matchHit([2, 1], [2, 1]), 'exact')
  // 승패만 적중 (5점)
  assert.equal(matchHit([3, 1], [2, 1]), 'outcome')
  // 무승부 예측 + 무승부 결과는 스코어가 달라도 적중
  assert.equal(matchHit([1, 1], [2, 2]), 'outcome')
  // 승패가 어긋나면 미적중 (0점)
  assert.equal(matchHit([2, 1], [1, 2]), 'miss')
  // 무승부로 끝났는데 승리를 예측한 경우도 미적중
  assert.equal(matchHit([2, 1], [1, 1]), 'miss')
})

test('buildTop3Entries: 순서는 그대로 두고 내 픽에만 isMine을 붙인다', () => {
  const players = [
    { playerId: 1, name: '보트만', rating: 7.8, photoUrl: null },
    { playerId: 2, name: '리브라멘투', rating: 7.5, photoUrl: null },
    { playerId: 3, name: '스카르', rating: 6.9, photoUrl: null },
  ]
  const entries = buildTop3Entries(players, 2)
  assert.deepEqual(
    entries.map(e => [e.playerId, e.isMine]),
    [[1, false], [2, true], [3, false]],
  )
})

test('buildTop3Entries: 미참여(myPlayerId=null)면 전부 isMine: false', () => {
  const players = [{ playerId: 1, name: '보트만', rating: 7.8, photoUrl: null }]
  const entries = buildTop3Entries(players, null)
  assert.equal(entries[0].isMine, false)
})

test('buildTop3Entries: 빈 배열이 오면 빈 배열을 그대로 돌려준다(패딩 없음)', () => {
  assert.deepEqual(buildTop3Entries([], 1), [])
})
