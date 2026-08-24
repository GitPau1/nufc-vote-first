import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const resultView = readFileSync(new URL('./ResultView.tsx', import.meta.url), 'utf8')
const commentsSection = readFileSync(new URL('./CommentsSection.tsx', import.meta.url), 'utf8')
// 결과 막대(퍼센트 바 + 썸네일)는 ResultView.tsx에서 ui/result-progress.tsx(ResultProgress)로
// 추출됐다 — 관련 리터럴은 이제 그쪽 파일에 있다. 아래 두 테스트가 이 파일을 같이 읽는다.
const resultProgress = readFileSync(new URL('../ui/result-progress.tsx', import.meta.url), 'utf8')

test('result page keeps the Figma-sized cover image', () => {
  assert.match(resultView, /h-\[252px\]/)
  assert.doesNotMatch(resultView, /h-\[188px\]/)
})

test('result page uses the shared poll header for cross-screen GNB consistency', () => {
  // 예전엔 Figma 스펙대로 결과 화면 전용 "돌아가기" 헤더를 직접 그렸지만,
  // 데스크탑에서 모든 화면이 동일한 GNB를 보여줘야 한다는 요구로 PollPageHeader(AppHeader 래퍼)로 통일했다.
  assert.match(resultView, /PollPageHeader/)
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
  assert.match(resultView, /<ResultProgress/)
  // 퍼센트 막대 자체의 width 계산은 ResultProgress로 옮겨갔다.
  assert.match(resultProgress, /width: `\$\{percent\}%`/)
  assert.doesNotMatch(resultView, /slice\(1\)/)
  assert.doesNotMatch(resultProgress, /text-\[40px\]/)
})

test('result page adds Figma-style option thumbnails only for image or player options', () => {
  assert.match(resultView, /getOptionThumb/)
  assert.match(resultView, /option\.image_url/)
  assert.match(resultView, /poll\.option_players/)
  // 썸네일 렌더(size-[40px], thumb 삼항)는 ResultProgress로 옮겨갔다.
  assert.match(resultProgress, /size-\[40px\]/)
  assert.match(resultProgress, /thumb \?/ )
  assert.doesNotMatch(resultProgress, /placehold\.co\/40x40/)
})

test('comment composer keeps the Figma input proportions', () => {
  assert.match(commentsSection, /h-\[62px\]/)
  assert.match(commentsSection, /rounded-lg/)
  assert.doesNotMatch(commentsSection, /rounded-\[16px\]/)
})
