import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

// "댓글은 투표 참여자만 작성 가능"은 이 서비스의 핵심 제약이고 네 겹(배치 / UI / 서버 액션 / RLS)으로
// 지켜진다. 이 파일은 그중 코드로 지키는 두 겹 — 서버 액션의 투표 여부 검사와, 실패를 사용자에게
// 보여주는 UI — 이 사라지지 않게 소스 문자열로 고정한다.
const action = readFileSync(new URL('../../lib/actions/comments.ts', import.meta.url), 'utf8')
const ui = readFileSync(new URL('./CommentsSection.tsx', import.meta.url), 'utf8')
const rls = readFileSync(
  new URL('../../../../supabase/migrations/20260527155049_initial_schema.sql', import.meta.url),
  'utf8',
)

test('submitComment rejects non-voters with a dedicated error code, not a generic failure', () => {
  // 에러 코드가 문자열 union으로 좁혀져 있어야 호출부에서 코드별 분기를 놓치지 않는다.
  assert.match(action, /type CommentErrorCode =[^\n]*'not_voted'/)
  assert.match(action, /{ error: CommentErrorCode }/)
  assert.doesNotMatch(action, /type CommentActionResult = .*\| { error: string }/)

  // 투표 여부 판정은 RLS와 같은 조건(votes에 이 유저 행) — poll_id + user_id 둘 다 걸어야 한다.
  assert.match(action, /async function hasVoted\(/)
  const helper = action.slice(action.indexOf('async function hasVoted('), action.indexOf('async function getVotedOptionLabel('))
  assert.match(helper, /\.from\('votes'\)/)
  assert.match(helper, /\.eq\('poll_id', pollId\)/)
  assert.match(helper, /\.eq\('user_id', userId\)/)

  // 실연동 경로: insert보다 먼저 검사해야 한다(RLS 거부를 'failed'로 뭉개면 안 된다).
  const submit = action.slice(
    action.indexOf('export async function submitComment('),
    action.indexOf('export async function updateComment('),
  )
  const guardAt = submit.indexOf("hasVoted(db, pollId, user.id)")
  const insertAt = submit.indexOf(".from('comments')")
  assert.ok(guardAt > -1, 'submitComment must check hasVoted before inserting')
  assert.ok(insertAt > -1)
  assert.ok(guardAt < insertAt, 'hasVoted 검사가 comments insert보다 앞에 있어야 한다')
  assert.match(submit.slice(guardAt - 80, insertAt), /return { error: 'not_voted' }/)

  // 목 모드도 같은 순서로 막는다 — 쿠키(mock-vote-{pollId}) 기반 투표 이력을 본다.
  const mockBranch = submit.slice(submit.indexOf('if (IS_MOCK)'), submit.indexOf('success: true'))
  assert.match(mockBranch, /mockGetMyVote/)
  assert.match(mockBranch, /return { error: 'not_voted' }/)
  assert.match(
    readFileSync(new URL('../../lib/mock/queries.ts', import.meta.url), 'utf8'),
    /mock-vote-\$\{pollId\}/,
  )
})

test('the DB layer keeps the same voter-only condition', () => {
  // 서버 액션 검사는 RLS를 대체하는 게 아니라 앞에 덧대는 층이다 — RLS가 남아 있어야 한다.
  assert.match(rls, /CREATE POLICY "comments: insert for voters"/)
  assert.match(rls, /SELECT 1 FROM public\.votes/)
})

test('CommentsSection surfaces a submit failure instead of silently swallowing it', () => {
  // 예전에는 성공 분기만 있어서 실패하면 입력 텍스트만 남고 아무것도 안 보였다.
  assert.match(ui, /if \(!\('success' in result\)\) {\s*\n\s*setSubmitError\(submitErrorMessage\(result\.error\)\)/)
  assert.match(ui, /const \[submitError, setSubmitError\] = useState<string \| null>\(null\)/)

  // 코드별 문구 — not_voted는 "투표 먼저"라는 사실을 알려줘야 한다.
  assert.match(ui, /not_voted: '투표에 참여한 뒤에 댓글을 쓸 수 있어요'/)
  assert.match(ui, /unauthenticated: '로그인한 뒤에 댓글을 쓸 수 있어요'/)
  assert.match(ui, /function submitErrorMessage\(/)
  assert.match(ui, /\?\? '댓글을 등록하지 못했어요/)  // 모르는 코드도 침묵하지 않는다

  // 렌더 — foundation 타이포/색 토큰만 쓰고, 스크린리더에도 알린다.
  assert.match(ui, /{submitError && \(/)
  assert.match(ui, /role="alert" className="text-caption-1 text-critical/)
  assert.doesNotMatch(ui, /text-red-|text-\[#/)
})
