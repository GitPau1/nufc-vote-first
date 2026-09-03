import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const __dirname = import.meta.dirname
const formSource = fs.readFileSync(path.join(__dirname, 'OnboardingForm.tsx'), 'utf8')
const pageSource = fs.readFileSync(path.join(__dirname, 'page.tsx'), 'utf8')
const onboardingActionsSource = fs.readFileSync(
  path.join(__dirname, '../../lib/actions/onboarding.ts'),
  'utf8'
)

test('step 1 (terms) gates continuing on agreement — button disabled until checked', () => {
  assert.match(formSource, /useState<'terms' \| 'nickname'>\('terms'\)/)
  assert.match(formSource, /const \[agreed, setAgreed\] = useState\(false\)/)

  const termsStepBlock = formSource.slice(
    formSource.indexOf("if (step === 'terms')"),
    formSource.indexOf('🧑')
  )
  assert.match(termsStepBlock, /disabled=\{!agreed\}/)
  assert.match(termsStepBlock, /onClick=\{\(\) => setStep\('nickname'\)\}/)
  assert.match(termsStepBlock, /동의하고 계속하기/)
  // 약관/방침 링크는 새 탭으로 열려 체크 상태가 유지된다.
  assert.match(termsStepBlock, /href="\/terms" target="_blank"/)
  assert.match(termsStepBlock, /href="\/privacy" target="_blank"/)
})

test('step 2 (nickname) prefills the input from the server-provided display_name', () => {
  assert.match(formSource, /interface OnboardingFormProps \{/)
  assert.match(formSource, /initialDisplayName: string/)
  assert.match(formSource, /defaultValue=\{initialDisplayName\}/)
})

test('OnboardingPage looks up the current display_name and passes it down', () => {
  assert.match(pageSource, /\.select\('display_name'\)/)
  assert.match(pageSource, /<OnboardingForm initialDisplayName=\{displayName\}/)
})

test('saveNickname records terms_accepted_at alongside display_name', () => {
  const saveNicknameBlock = onboardingActionsSource.slice(
    onboardingActionsSource.indexOf('export async function saveNickname'),
    onboardingActionsSource.indexOf('export async function updateNickname')
  )
  assert.match(saveNicknameBlock, /terms_accepted_at: new Date\(\)\.toISOString\(\)/)
})

test('updateNickname (마이페이지 닉네임 수정) is left untouched — no terms_accepted_at write', () => {
  const updateNicknameBlock = onboardingActionsSource.slice(
    onboardingActionsSource.indexOf('export async function updateNickname')
  )
  assert.doesNotMatch(updateNicknameBlock, /terms_accepted_at/)
})
