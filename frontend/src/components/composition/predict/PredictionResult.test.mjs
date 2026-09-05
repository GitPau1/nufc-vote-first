import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const file = source('components/composition/predict/PredictionResult.tsx')

// 마감돼서 참여 못한 경기(결과 행 없음, mock 9002)는 results[match.id]가 undefined다.
// MatchResultBlock의 pickPointsReady 기본값은 true(평점 유무와 무관하게 TOP3를 보여준다)이므로,
// 결과 행이 없을 때는 그 기본값을 그대로 살려야 한다 — false로 떨어지면 평점이 다 들어와도
// "평점 집계 중이에요"가 영구히 뜬다(TEA-34 리뷰 발견).
test('pickPointsReady falls back to true (not false) when there is no result row, so a missed match still shows TOP3', () => {
  assert.match(file, /pickPointsReady=\{results\[match\.id\]\?\.ratingsSettled \?\? true\}/)
})
