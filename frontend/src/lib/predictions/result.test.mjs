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

const { ratingTier, aggregateWeekResult, ourScoreOrder, matchResultState } = loadResultModule()

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
