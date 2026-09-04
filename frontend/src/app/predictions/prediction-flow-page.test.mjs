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

// 킥오프된 경기는 서버가 이미 막지만, 수정 대상 선택 화면에도 잠긴 경기가 나오면 안 된다
// (더블 매치위크에서 한 경기만 킥오프됐을 때의 UI 전용 버그, 2026-09-05, TEA-33).
test('editableMatches excludes locked matches from submittedMatches', () => {
  assert.match(file, /const editableMatches = submittedMatches\.filter\(match => !match\.locked\)/)
})

// 수정 대상 선택 화면은 수정 가능(잠기지 않은)한 제출 경기가 2개 이상일 때만 뜬다 — 1개면 바로
// 그 경기 수정으로 직행한다(PredictionDone.tsx의 editHref 분기와 대칭). 화면에 넘기는 목록도
// editableMatches여야 잠긴 경기가 카드로 노출되지 않는다.
test('the edit-target select screen requires at least two editable matches, and only shows those', () => {
  assert.match(file, /searchParams\.editSelect && editableMatches\.length >= 2/)
  assert.match(file, /<PredictionMatchSelect week=\{week\} matches=\{editableMatches\} mode="edit" prediction=\{prediction\} \/>/)
})

// 버그: 같은 라우트(/predictions/[weekKey])에서 검색 파라미터만 바뀌는 클라이언트 내비게이션(예:
// 완료 허브 → ?edit=A → 완료 허브 → ?edit=B, 또는 새 제출 → 완료 허브 → 수정)은 React가
// <PredictionFlowClient>를 리마운트하지 않고 재사용한다 — key가 없으면 useState 초기값(scores/picks)이
// 최초 마운트 시점 값에 계속 고정돼, 이후 방문의 initialValues/matchIds가 무시된다("수정하기 들어가면
// 값이 초기화돼 있음", "제출할 때마다 incomplete"의 근본 원인). 매 렌더가 다루는 경기 조합이 바뀌면
// 반드시 리마운트되도록 matchIds(+ mode)를 key로 줘야 한다.
test('every PredictionFlowClient render is keyed by its match/mode identity, so a new session always remounts', () => {
  const opens = [...file.matchAll(/<PredictionFlowClient\b[^]*?(?:\/>|<\/PredictionFlowClient>)/g)]
  assert.equal(opens.length, 4, '페이지에 PredictionFlowClient 렌더가 4곳 있어야 한다(edit/match/submitted/single-fallback)')
  for (const [snippet] of opens) {
    assert.match(
      snippet,
      /key=/,
      `key prop 없이 렌더된 PredictionFlowClient가 있다 — 리마운트가 안 돼 상태가 이전 세션 것 그대로 남는다:\n${snippet}`,
    )
  }
})
