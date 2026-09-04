import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const file = source('predictions/[weekKey]/page.tsx')

// 경기 단위 수정(?edit=)·수정 대상 선택(?editSelect=)·제출 문맥 선택(?match=) 3개 쿼리 파라미터를
// 받는다(feature-spec.md §3.1·§3.5).
test('the week route reads edit, editSelect, and match search params', () => {
  assert.match(file, /searchParams: \{ edit\?: string; editSelect\?: string; match\?: string \}/)
})

// 이 주에 뭐라도 이미 제출됐으면(prediction truthy) 완료 허브(PredictionDone)로 보낸다 —
// pending.length === 0 으로만 판단하던 기존 조건보다 넓다(부분 제출 후에도 허브가 뜬다).
test('the done hub is reached whenever anything in the week has been submitted, not only when pending is empty', () => {
  assert.match(file, /const prediction = findWeekPrediction\(week, myPredictions\)/)
  assert.match(file, /else if \(prediction\) \{/)
})

// 더블 매치위크에서 아무것도 제출 안 한 첫 진입만 선택 화면으로 간다 — 그 외(edit/match 파라미터가
// 있거나 이미 뭔가 제출됨)는 선택 화면을 건너뛴다.
test('the match select screen only appears on a fresh double-matchweek entry with nothing submitted yet', () => {
  assert.match(file, /else if \(pending\.length > 1\) \{/)
  assert.match(file, /<PredictionMatchSelect week=\{week\} matches=\{pending\} mode="submit" \/>/)
})

// 수정 대상 선택 화면은 제출된 경기가 2개 이상일 때만 뜬다 — 1개면 바로 그 경기 수정으로 직행한다
// (PredictionDone.tsx의 editHref 분기와 대칭).
test('the edit-target select screen requires at least two submitted matches', () => {
  assert.match(file, /searchParams\.editSelect && submittedMatches\.length >= 2/)
})
