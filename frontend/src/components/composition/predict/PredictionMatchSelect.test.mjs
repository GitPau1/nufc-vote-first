import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const file = source('components/composition/predict/PredictionMatchSelect.tsx')

// 제출/수정 공용 컴포넌트로 확장됐다(feature-spec.md §3.5) — mode prop으로 문맥을 가른다.
test('PredictionMatchSelect is a submit/edit dual-mode component', () => {
  assert.match(file, /mode: 'submit' \| 'edit'/)
})

// "둘 다 예측하기"는 경기가 정확히 2개일 때만 보인다 — 3개 이상은 확정된 카피가 없다
// (근거 미확인, feature-spec.md §3.5).
test('the combined "both" button only appears for exactly two matches, never in edit mode', () => {
  assert.match(file, /mode === 'submit' && matches\.length === 2/)
  assert.match(file, /둘 다 예측하기/)
})

// submit 문맥은 ?match=, edit 문맥은 ?edit=로 이동한다 — 서로 다른 서버 액션 경로로 갈라진다.
test('submit mode links to ?match= and edit mode links to ?edit=', () => {
  assert.match(file, /\?match=\$\{match\.id\}/)
  assert.match(file, /\?edit=\$\{match\.id\}/)
})

// edit 문맥 카드는 기존 제출 스코어를 같이 보여준다.
test('edit mode cards show the existing submitted score', () => {
  assert.match(file, /existing = prediction\?\.scores\[match\.id\]/)
  assert.match(file, /현재 예측/)
})

// 시안-v3.html 재설계 반영 확인(코드리뷰 2026-09-04 버그 수정) — 초기 가안(독립 흰 박스 + 가운데
// 정렬 헤더)이 아니라 PredictionFlowClient와 같은 Card 컨테이너 + 좌측정렬 헤더, 경기 카드는
// 데스크톱에서 가로 배열(sm:flex-row)해야 한다. 새 클래스를 만들지 않고 기존 Card/Button
// 프리미티브를 그대로 쓰는지도 함께 확인한다.
test('matches the 시안-v3.html redesign: single Card wrapper, left-aligned header, side-by-side cards on desktop', () => {
  assert.match(file, /import \{ Card \} from '@\/components\/primitives\/card'/)
  assert.match(file, /import \{ Button \} from '@\/components\/primitives\/button'/)
  assert.match(file, /<Card className="flex flex-col p-5 sm:p-7">/)
  // 헤더는 text-center로 감싸지 않는다(좌측정렬) — PredictionFlowClient 헤더와 같은 톤.
  assert.doesNotMatch(file, /mb-6 text-center/)
  assert.match(file, /className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4"/)
  // 경기 카드는 이제 독립된 흰 박스(border+bg-surface)가 아니라 카드 안 옅은 회색 패널이다.
  assert.doesNotMatch(file, /rounded-lg border border-neutral-weak bg-surface p-4/)
  assert.match(file, /className="flex flex-1 flex-col rounded-lg bg-page p-4"/)
  // 버튼은 새 클래스를 만들지 않고 기존 Button 컴포넌트(asChild로 Link 감싸기)를 그대로 쓴다.
  assert.match(file, /<Button asChild variant="outline" size="lg" className="w-full">/)
  assert.match(file, /<Button asChild className="w-full">/)
})
