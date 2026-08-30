import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FEEDBACK_CATEGORIES,
  isFeedbackCategory,
  pathToCategory,
} from './categories.ts'

test('pathToCategory: 투표 경로 → vote', () => {
  assert.equal(pathToCategory('/'), 'vote')
  assert.equal(pathToCategory('/polls'), 'vote')
  assert.equal(pathToCategory('/polls/123'), 'vote')
})

test('pathToCategory: 승부예측 경로 → prediction', () => {
  assert.equal(pathToCategory('/predictions'), 'prediction')
  assert.equal(pathToCategory('/predictions/2026-w3'), 'prediction')
})

test('pathToCategory: 역대선수 경로 → player', () => {
  assert.equal(pathToCategory('/players'), 'player')
  assert.equal(pathToCategory('/players/changes'), 'player')
})

test('pathToCategory: 매핑 안 되는 경로 → etc', () => {
  assert.equal(pathToCategory('/menu'), 'etc')
  assert.equal(pathToCategory('/my'), 'etc')
  assert.equal(pathToCategory('/anything'), 'etc')
})

test('isFeedbackCategory: 허용 집합만 통과', () => {
  for (const c of FEEDBACK_CATEGORIES) assert.equal(isFeedbackCategory(c), true)
  assert.equal(isFeedbackCategory('bogus'), false)
  assert.equal(isFeedbackCategory(null), false)
  assert.equal(isFeedbackCategory(3), false)
})
