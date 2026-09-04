import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const file = source('components/composition/predict/steps.tsx')

// ProgressPips는 더블 매치위크 재설계(feature-spec.md §9.2)로 점 개수가 고정 3이 아니게 됐다 —
// total/activeIndex를 선택적으로 받되, current는 그대로 필수로 남겨 기존 Storybook 스토리
// (ProgressPips.stories.tsx, current만 넘김)가 그대로 동작해야 한다.
test('ProgressPips total/activeIndex are optional additions, current stays required', () => {
  assert.match(file, /current: StepKey\s*\n\s*\/\*\* 점 총 개수[\s\S]{0,40}total\?: number/)
  assert.match(file, /activeIndex\?: number/)
  assert.match(file, /const dotCount = total \?\? STEP_META\.length/)
  assert.match(file, /const currentIndex = activeIndex \?\? STEP_META\.findIndex\(s => s\.key === current\)/)
})
