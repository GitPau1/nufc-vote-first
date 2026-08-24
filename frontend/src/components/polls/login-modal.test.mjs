import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = import.meta.dirname
const modalSource = fs.readFileSync(path.join(__dirname, 'LoginModal.tsx'), 'utf8')
const sheetSource = fs.readFileSync(path.join(__dirname, '../ui/sheet.tsx'), 'utf8')
const bottomSheetSource = fs.readFileSync(path.join(__dirname, '../ui/bottom-sheet.tsx'), 'utf8')
const menuActionsSource = fs.readFileSync(path.join(__dirname, '../../app/menu/MenuActions.tsx'), 'utf8')

test('login modal no longer branches on an intent prop — BottomSheet decides by viewport', () => {
  assert.doesNotMatch(modalSource, /intent\?:|intent=/)
  assert.doesNotMatch(modalSource, /@radix-ui\/react-dialog/)
  assert.match(modalSource, /import { BottomSheet } from '@\/components\/ui\/bottom-sheet'/)
  assert.match(modalSource, /로그인이 필요해요/)
  assert.match(modalSource, /Google로 로그인/)
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
