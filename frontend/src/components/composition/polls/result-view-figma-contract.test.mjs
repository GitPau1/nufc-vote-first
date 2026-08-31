import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const resultView = readFileSync(new URL('./ResultView.tsx', import.meta.url), 'utf8')
const commentsSection = readFileSync(new URL('./CommentsSection.tsx', import.meta.url), 'utf8')
// 결과 막대(퍼센트 바 + 썸네일)는 ResultView.tsx에서 primitives/result-progress.tsx(ResultProgress)로
// 추출됐다 — 관련 리터럴은 이제 그쪽 파일에 있다. 아래 두 테스트가 이 파일을 같이 읽는다.
const resultProgress = readFileSync(new URL('../../primitives/result-progress.tsx', import.meta.url), 'utf8')

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

// 결과 화면 셸을 제출 화면(PredictionFlowClient) 컨벤션으로 정렬했다 —
// mx-auto max-w-[860px] 컨테이너 + 단일 Card(p-5 sm:p-7) 셸. 커버 이미지는 Card 밖 독립
// 블록으로 둔다(투표 화면 TypeBPollClient와 같은 처리 — 참여 전후로 커버 톤이 갈리지 않게).
test('result page shell matches the submission-screen container and single-Card convention', () => {
  assert.match(resultView, /mx-auto flex w-full max-w-\[860px\]/)
  assert.match(resultView, /from '@\/components\/primitives\/card'/)
  assert.match(resultView, /<Card className="p-5 sm:p-7">/)

  // 커버는 투표 화면과 동일하게 Card 밖 단독 블록 — 참여 전(TypeBPollClient)과 이미지 처리가 갈리면 안 된다.
  assert.match(resultView, /overflow-hidden rounded-lg bg-disabled/)

  // 예전 "이미지+본문을 한 보더 섹션에 합친" 셸은 사라졌다 — 그 셸의 클래스 조합이 리터럴로 남아있으면 안 된다.
  assert.doesNotMatch(resultView, /overflow-hidden rounded-lg border border-neutral-weak bg-surface/)
})

test('result panel sits in a card-safe gray panel, not a re-bordered white box', () => {
  // 흰 Card 안이라 제출 화면 SummarySection·WeekRankCard와 같은 "카드 안 회색 패널(bg-page)"을 쓴다
  // — 그 안 강조 면(막대 자체)은 ResultProgress의 bg-surface가 맡는다(이중 프레임 방지).
  assert.match(resultView, /rounded-lg bg-page px-4 py-5/)
  // 회색 패널에 보더가 재도입되면 흰 막대(bg-surface)와의 경계가 두 겹이 된다(이중 프레임 리그레션).
  assert.doesNotMatch(resultView, /rounded-lg border border-neutral-weak bg-page/)
})

test('result page renders all options as Figma-style percentage bars', () => {
  assert.match(resultView, /resultItems\.map/)
  assert.match(resultView, /<ResultProgress/)
  // 퍼센트 막대 자체의 width 계산은 ResultProgress로 옮겨갔다.
  assert.match(resultProgress, /width: `\$\{percent\}%`/)
  assert.doesNotMatch(resultView, /slice\(1\)/)
  assert.doesNotMatch(resultProgress, /text-\[40px\]/)
})

// 결과 막대는 이제 항상 bg-page 회색 패널 위에서만 그려진다 — 흰 막대(bg-surface)와
// 회색 배경의 명도 차이만으로 경계가 생기므로, 보더를 다시 얹으면 이중 프레임이 된다.
test('result progress bar drops its border now that it always sits on a gray panel', () => {
  assert.match(resultProgress, /rounded-pill bg-surface/)
  assert.doesNotMatch(resultProgress, /rounded-pill border border-neutral-weak bg-surface/)
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
  assert.match(commentsSection, /px-2 py-1 text-caption-2 font-semibold/)
  assert.match(commentsSection, /inline-flex items-center rounded-pill/)
  assert.doesNotMatch(commentsSection, /<Badge/)
  assert.doesNotMatch(commentsSection, /px-1\.5 py-0/)
  assert.doesNotMatch(commentsSection, /text-caption-3/)
})

test('comment composer keeps the Figma input proportions', () => {
  assert.match(commentsSection, /h-\[62px\]/)
  assert.match(commentsSection, /rounded-lg/)
  assert.doesNotMatch(commentsSection, /rounded-\[16px\]/)
})
