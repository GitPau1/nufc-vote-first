import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const resultView = readFileSync(new URL('./ResultView.tsx', import.meta.url), 'utf8')
const commentsSection = readFileSync(new URL('./CommentsSection.tsx', import.meta.url), 'utf8')

test('result page keeps the Figma-sized cover image', () => {
  assert.match(resultView, /h-\[252px\]/)
  assert.doesNotMatch(resultView, /h-\[188px\]/)
})

test('result page uses a Figma-specific header instead of the shared poll header', () => {
  assert.doesNotMatch(resultView, /PollPageHeader/)
})

test('result page omits sections that are not in the Figma result frame', () => {
  assert.doesNotMatch(resultView, /선수 정보/)
})

test('comments use the Figma thumbs-up reaction treatment', () => {
  assert.match(commentsSection, /ThumbsUp/)
  assert.match(commentsSection, /function CommentReactionButton/)
  assert.match(commentsSection, /text-caption-2/)
  assert.match(commentsSection, /\.filter\(Boolean\)\.join\(' '\)/)
  assert.doesNotMatch(commentsSection, /Heart/)
  assert.doesNotMatch(commentsSection, /text-caption-1 transition-all/)
  assert.doesNotMatch(commentsSection, /cn\(\s*'mt-1\.5 inline-flex[\s\S]*text-caption-2/)
})

test('comment option badges use the compact caption component', () => {
  assert.match(commentsSection, /function CommentOptionBadge/)
  assert.match(commentsSection, /<CommentOptionBadge/)
  assert.match(commentsSection, /px-\[9px\] py-\[3px\] text-caption-2 font-semibold/)
  assert.match(commentsSection, /inline-flex items-center rounded-pill/)
  assert.doesNotMatch(commentsSection, /<Badge/)
  assert.doesNotMatch(commentsSection, /px-1\.5 py-0/)
  assert.doesNotMatch(commentsSection, /text-caption-3/)
})

test('result page renders all options as Figma-style percentage bars', () => {
  assert.match(resultView, /resultItems\.map/)
  assert.match(resultView, /width: `\$\{item\.percent\}%`/)
  assert.doesNotMatch(resultView, /slice\(1\)/)
  assert.doesNotMatch(resultView, /text-\[40px\]/)
})

test('result page adds Figma-style option thumbnails only for image or player options', () => {
  assert.match(resultView, /getOptionThumb/)
  assert.match(resultView, /option\.image_url/)
  assert.match(resultView, /poll\.option_players/)
  assert.match(resultView, /size-\[40px\]/)
  assert.match(resultView, /thumb \?/ )
  assert.doesNotMatch(resultView, /placehold\.co\/40x40/)
})

test('comment composer keeps the Figma input proportions', () => {
  assert.match(commentsSection, /h-\[62px\]/)
  assert.match(commentsSection, /rounded-lg/)
  assert.doesNotMatch(commentsSection, /rounded-\[16px\]/)
})
