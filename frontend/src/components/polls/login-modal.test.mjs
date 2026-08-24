import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = import.meta.dirname
const modalSource = fs.readFileSync(path.join(__dirname, 'LoginModal.tsx'), 'utf8')
const sheetSource = fs.readFileSync(path.join(__dirname, '../ui/sheet.tsx'), 'utf8')
const bottomSheetSource = fs.readFileSync(path.join(__dirname, '../ui/bottom-sheet.tsx'), 'utf8')
const menuActionsSource = fs.readFileSync(path.join(__dirname, '../../app/menu/MenuActions.tsx'), 'utf8')

/** LoginModal을 띄우는 모든 호출부 → 그 화면의 진입 맥락. */
const CALLSITES = [
  ['../layout/LoginButton.tsx', 'login'],
  ['../../app/menu/MenuActions.tsx', 'login'],
  ['../auth/RequireAuthModal.tsx', 'login'],
  ['./TypeAPollClient.tsx', 'vote'],
  ['./TypeBPollClient.tsx', 'vote'],
  ['./OverallRatingPollClient.tsx', 'vote'],
  ['../predict/PredictionFlowClient.tsx', 'predict'],
]

test('login modal no longer branches on an intent prop — BottomSheet decides by viewport', () => {
  assert.doesNotMatch(modalSource, /intent\?:|intent=/)
  assert.doesNotMatch(modalSource, /@radix-ui\/react-dialog/)
  assert.match(modalSource, /import { BottomSheet } from '@\/components\/ui\/bottom-sheet'/)
  assert.match(modalSource, /로그인이 필요해요/)
  assert.match(modalSource, /Google로 로그인/)
})

test('triggerAction splits the description copy — it is not analytics-only', () => {
  // 예전엔 어디서 열어도 "투표" 얘기가 나왔다. 헤더 로그인 버튼에서도 그랬다.
  assert.doesNotMatch(modalSource, /투표에 참여하려면 로그인이 필요합니다/)

  // 문구는 맵 한 곳에 모아두고 triggerAction으로 꺼낸다.
  assert.match(modalSource, /const TRIGGER_DESCRIPTION: Record<LoginTrigger, string> = \{/)
  assert.match(modalSource, /<SheetDescription>\{TRIGGER_DESCRIPTION\[triggerAction\]\}<\/SheetDescription>/)

  const map = modalSource.slice(
    modalSource.indexOf('const TRIGGER_DESCRIPTION'),
    modalSource.indexOf('interface LoginModalProps')
  )
  const copy = Object.fromEntries(
    [...map.matchAll(/^\s{2}(\w+): '([^']+)',$/gm)].map(([, key, text]) => [key, text])
  )

  // 케이스 1(일반 로그인)과 케이스 2(행동 유도)가 실제로 다른 문구여야 한다.
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
  assert.match(modalSource, /triggerAction: LoginTrigger/)
  assert.doesNotMatch(modalSource, /triggerAction\?:/)
  assert.doesNotMatch(modalSource, /triggerAction = '/)
  // 값 = 실제 호출부. 안 쓰는 값을 남기면 아무도 못 보는 문구가 같이 생긴다.
  assert.match(modalSource, /export type LoginTrigger = 'login' \| 'vote' \| 'predict'\n/)
})

test('the demo-mode branch is the CTA label only — it no longer overwrites the description', () => {
  assert.match(modalSource, /데모로 바로 로그인/)
  assert.doesNotMatch(modalSource, /데모 로그인으로 바로 참여할 수 있어요/)
  // 설명문 자체가 IS_MOCK 삼항으로 덮이지 않는다(맵 조회 한 줄뿐).
  assert.doesNotMatch(modalSource, /<SheetDescription>\s*\{IS_MOCK/)
})

test('each callsite passes the triggerAction that matches its entry context', () => {
  for (const [relativePath, expected] of CALLSITES) {
    const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8')
    const passed = [...source.matchAll(/triggerAction="([^"]+)"/g)].map(([, value]) => value)
    assert.deepEqual(passed, [expected], `${relativePath} should pass triggerAction="${expected}"`)
  }
})

test('login CTA uses the filled default button, not the outline/secondary style', () => {
  const ctaBlock = modalSource.slice(
    modalSource.indexOf('원탭 로그인 CTA'),
    modalSource.indexOf('닫기')
  )
  assert.doesNotMatch(ctaBlock, /variant="outline"/)
  assert.match(ctaBlock, /<Button\s+className="w-full h-12/)
})

test('BottomSheet switches between bottom (mobile) and center (desktop) variants by viewport width', () => {
  assert.match(bottomSheetSource, /matchMedia/)
  assert.match(bottomSheetSource, /\(min-width: 768px\)/)
  assert.match(bottomSheetSource, /isDesktop \? 'center' : 'bottom'/)
})

test('sheet.tsx center variant re-centers after tailwindcss-animate resets translate mid-animation', () => {
  assert.match(sheetSource, /center:/)
  // bottom과 동일한 버그(애니메이션 중 -translate-x/y-1/2가 0으로 리셋)를 center에서도 보정해야 한다.
  assert.match(sheetSource, /data-\[state=open\]:slide-in-from-left-1\/2/)
  assert.match(sheetSource, /data-\[state=open\]:slide-in-from-top-1\/2/)
})

test('menu no longer forces a special "direct" intent — the same LoginModal is used everywhere', () => {
  assert.doesNotMatch(menuActionsSource, /intent=/)
  assert.match(menuActionsSource, /<LoginModal open={loginOpen} onClose={closeLogin} triggerAction="login" \/>/)
})
