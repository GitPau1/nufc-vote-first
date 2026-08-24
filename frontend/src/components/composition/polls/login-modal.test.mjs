import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = import.meta.dirname
// LoginModal은 껍데기(Modal) + 내용(LoginContent)으로 분리됐다.
const contentSource = fs.readFileSync(path.join(__dirname, '../../primitives/modal/contents/Login.tsx'), 'utf8')
const sheetSource = fs.readFileSync(path.join(__dirname, '../../primitives/modal/sheet.tsx'), 'utf8')
const modalSource = fs.readFileSync(path.join(__dirname, '../../primitives/modal/Modal.tsx'), 'utf8')
const menuActionsSource = fs.readFileSync(path.join(__dirname, '../../../app/menu/MenuActions.tsx'), 'utf8')

/** LoginContent를 띄우는 모든 호출부 → 그 화면의 진입 맥락. */
const CALLSITES = [
  ['../common/LoginButton.tsx', 'login'],
  ['../../../app/menu/MenuActions.tsx', 'login'],
  ['../auth/RequireAuthModal.tsx', 'login'],
  ['./TypeAPollClient.tsx', 'vote'],
  ['./TypeBPollClient.tsx', 'vote'],
  ['./OverallRatingPollClient.tsx', 'vote'],
  ['../predict/PredictionFlowClient.tsx', 'predict'],
]

test('login content is pure content — no intent prop, no shell, no direct radix dialog', () => {
  assert.doesNotMatch(contentSource, /intent\?:|intent=/)
  assert.doesNotMatch(contentSource, /@radix-ui\/react-dialog/)
  // 껍데기(Modal/BottomSheet)를 내용이 직접 들지 않는다 — 호출부가 조립한다.
  assert.doesNotMatch(contentSource, /import \{ (Modal|BottomSheet) \}/)
  assert.match(contentSource, /로그인이 필요해요/)
  assert.match(contentSource, /Google로 로그인/)
})

test('triggerAction splits the description copy — it is not analytics-only', () => {
  // 예전엔 어디서 열어도 "투표" 얘기가 나왔다. 헤더 로그인 버튼에서도 그랬다.
  assert.doesNotMatch(contentSource, /투표에 참여하려면 로그인이 필요합니다/)

  // 문구는 맵 한 곳에 모아두고 triggerAction으로 꺼낸다.
  assert.match(contentSource, /const TRIGGER_DESCRIPTION: Record<LoginTrigger, string> = \{/)
  assert.match(contentSource, /<SheetDescription>\{TRIGGER_DESCRIPTION\[triggerAction\]\}<\/SheetDescription>/)

  const map = contentSource.slice(
    contentSource.indexOf('const TRIGGER_DESCRIPTION'),
    contentSource.indexOf('interface LoginContentProps')
  )
  const copy = Object.fromEntries(
    [...map.matchAll(/^\s{2}(\w+): '([^']+)',$/gm)].map(([, key, text]) => [key, text])
  )

  assert.deepEqual(Object.keys(copy).sort(), ['login', 'predict', 'vote'])
  assert.notEqual(copy.login, copy.vote)
  assert.notEqual(copy.login, copy.predict)
  assert.notEqual(copy.vote, copy.predict)

  // 케이스 1은 특정 행동을 전제하지 않고, "필요"보다 로그인의 이득을 말한다.
  assert.doesNotMatch(copy.login, /필요/)
  assert.match(copy.login, /수 있어요$/)

  // 케이스 2는 막힌 행동을 문구에 담는다.
  assert.match(copy.vote, /^투표에 참여하려면/)
  assert.match(copy.predict, /^승부예측에 참여하려면/)
})

test('triggerAction has no default — every callsite states its own context', () => {
  assert.match(contentSource, /triggerAction: LoginTrigger/)
  assert.doesNotMatch(contentSource, /triggerAction\?:/)
  assert.doesNotMatch(contentSource, /triggerAction = '/)
  assert.match(contentSource, /export type LoginTrigger = 'login' \| 'vote' \| 'predict'\n/)
})

test('the demo-mode branch is the CTA label only — it no longer overwrites the description', () => {
  assert.match(contentSource, /데모로 바로 로그인/)
  assert.doesNotMatch(contentSource, /데모 로그인으로 바로 참여할 수 있어요/)
  assert.doesNotMatch(contentSource, /<SheetDescription>\s*\{IS_MOCK/)
})

test('each callsite passes matching triggerAction, and mounts login as a centered modal (form="default")', () => {
  for (const [relativePath, expected] of CALLSITES) {
    const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
    const passed = [...source.matchAll(/triggerAction="([^"]+)"/g)].map(([, value]) => value)
    assert.deepEqual(passed, [expected], `${relativePath} should pass triggerAction="${expected}"`)
    // 로그인은 모바일에서도 중앙 모달 — 껍데기를 form="default"로 씌운다.
    assert.match(source, /form="default"/, `${relativePath} should mount login with form="default"`)
  }
})

test('login CTA uses the filled default button, not the outline/secondary style', () => {
  const ctaBlock = contentSource.slice(
    contentSource.indexOf('원탭 로그인 CTA'),
    contentSource.indexOf('닫기')
  )
  assert.doesNotMatch(ctaBlock, /variant="outline"/)
  assert.match(ctaBlock, /<Button className="w-full h-12/)
})

test('Modal shell switches between sheet (mobile) and center (desktop) for responsive by viewport width', () => {
  assert.match(modalSource, /matchMedia/)
  assert.match(modalSource, /\(min-width: 768px\)/)
  assert.match(modalSource, /form === 'responsive' && !isDesktop/)
})

test('sheet.tsx center variant re-centers after tailwindcss-animate resets translate mid-animation', () => {
  assert.match(sheetSource, /center:/)
  assert.match(sheetSource, /data-\[state=open\]:slide-in-from-left-1\/2/)
  assert.match(sheetSource, /data-\[state=open\]:slide-in-from-top-1\/2/)
})

test('menu uses the shared Modal + LoginContent, not a special intent', () => {
  assert.doesNotMatch(menuActionsSource, /intent=/)
  assert.match(menuActionsSource, /<LoginContent triggerAction="login"/)
  assert.match(menuActionsSource, /form="default"/)
})
