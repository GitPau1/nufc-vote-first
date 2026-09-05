import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const file = source('components/composition/predict/PredictionDone.tsx')

// 완료 화면은 제출됨/유예됨/마감됨 3분류 허브다(feature-spec.md §3.2) — deferredMatches가
// missedMatches에서 분리됐다(아직 안 잠긴 미제출 vs 마감된 미제출).
test('PredictionDone classifies matches into submitted / deferred / missed', () => {
  assert.match(file, /const submittedMatches = week\.matches\.filter\(match => prediction\.scores\[match\.id\]\)/)
  assert.match(
    file,
    /const deferredMatches = week\.matches\.filter\(match => !prediction\.scores\[match\.id\] && !match\.locked\)/,
  )
  assert.match(
    file,
    /const missedMatches = week\.matches\.filter\(match => !prediction\.scores\[match\.id\] && match\.locked\)/,
  )
})

// 킥오프된 경기는 서버(action·RLS)가 이미 막지만, UI에서도 수정 대상 목록에서 빼야 한다 —
// 잠긴 제출 경기는 "수정 가능" 목록에 남으면 안 된다(2026-09-05 결정, TEA-33).
test('editableMatches excludes locked matches from submittedMatches', () => {
  assert.match(file, /const editableMatches = submittedMatches\.filter\(match => !match\.locked\)/)
})

// 유예 카드는 "지금 예측하기" CTA로 제출 문맥 단일 경기 진입(?match=)을 연다.
test('deferred match cards link to the submit-context single-match flow', () => {
  assert.match(file, /아직 예측하지 않았어요/)
  assert.match(file, /지금 예측하기/)
  assert.match(file, /\?match=\$\{match\.id\}/)
})

// 카드별 소형 "수정" 링크는 없다 — 하단에 큰 "수정하기" 버튼 하나만 둔다(2026-09-04 결정 변경).
// 공유하기는 이번 스코프에서 완전히 제거됐다.
test('there is no per-card edit link; ShareButton is removed in favor of a single bottom edit button', () => {
  assert.doesNotMatch(file, /ShareButton/)
  assert.match(file, /수정하기/)
  assert.match(
    file,
    /editableMatches\.length === 1\s*\? `\/predictions\/\$\{week\.weekKey\}\?edit=\$\{editableMatches\[0\]\.id\}`\s*: `\/predictions\/\$\{week\.weekKey\}\?editSelect=1`/,
  )
})

// 제출된 경기가 없거나, 있어도 전부 킥오프돼 잠겼으면 수정할 게 없으니 버튼 자체를 숨긴다.
test('the edit button is hidden when nothing is left editable (none submitted, or all submitted are locked)', () => {
  assert.match(file, /editableMatches\.length > 0 && \(/)
})

// 끝난 경기 미리보기(TEA-34): 완료 허브에서 종료된 경기는 결과 화면과 같은 판정 블록을 그대로 쓴다.
// 정산 게이트(주차 결과)를 기다리지 않고 경기 단위 채점 결과를 보여준다.
test('a finished match in the done hub renders MatchResultBlock wired to fixtureResults', () => {
  assert.match(file, /if \(match\.finished\) \{/)
  assert.match(file, /<MatchResultBlock\b/)
  assert.match(file, /state=\{matchResultState\(match, fixtureResults\)\}/)
  assert.match(
    file,
    /pickPointsReady=\{fixtureResults\[match\.id\]\?\.ratingsSettled \?\? false\}/,
  )
})

// 아직 끝나지 않았지만 이미 킥오프돼 잠긴 경기는 결과를 기다리는 중임을 캡션 한 줄로 알린다
// (design-brief.md §8-1 후보 1, 5단계 확정).
test('a locked-but-unfinished match shows a "waiting for result" caption', () => {
  assert.match(file, /\{match\.locked && \(/)
  assert.match(file, /결과를 기다리는 중이에요/)
})
