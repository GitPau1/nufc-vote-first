import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

function source(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

test('shared UI primitives use foundation radius and typography tokens', () => {
  const tailwind = fs.readFileSync(path.join(root, '../tailwind.config.ts'), 'utf8')
  const globals = source('app/globals.css')
  const card = source('components/ui/card.tsx')
  const button = source('components/ui/button.tsx')
  const badge = source('components/ui/badge.tsx')
  const sheet = source('components/ui/sheet.tsx')

  assert.match(tailwind, /"headline-1": \["18px", \{ lineHeight: "26px", letterSpacing: "-0\.002em" \}\]/)
  assert.match(tailwind, /"label-2": \["13px", \{ lineHeight: "18px", letterSpacing: "0\.0194em" \}\]/)
  assert.match(tailwind, /"caption-2": \["11px", \{ lineHeight: "14px", letterSpacing: "0\.0311em" \}\]/)
  assert.doesNotMatch(tailwind, /"caption-3"/)

  assert.match(card, /rounded-lg border border-border bg-surface/)
  assert.match(card, /text-headline-1/)
  assert.match(card, /text-label-1-reading/)
  assert.doesNotMatch(card, /rounded-md border border-border bg-surface text-card-foreground/)
  assert.doesNotMatch(card, /text-\[16px\]|text-\[14px\]|leading-\[1\.3\]/)

  assert.match(button, /text-body-2-normal/)
  assert.match(button, /sm: "h-9 px-3 text-label-2"/)
  assert.doesNotMatch(button, /text-\[15px\]|text-\[13px\]/)

  assert.match(badge, /text-caption-2/)
  assert.doesNotMatch(badge, /text-\[11px\]/)

  assert.match(sheet, /text-headline-1/)
  assert.match(sheet, /text-label-1-reading/)
  assert.doesNotMatch(sheet, /text-\[18px\]|text-\[14px\]|leading-\[1\.25\]/)

  assert.match(globals, /text-label-1-normal/)
  assert.match(globals, /text-body-2-normal/)
  assert.doesNotMatch(globals, /text-\[14px\]|text-\[15px\]/)
})

test('app and poll headers use color and typography foundations', () => {
  const appHeader = source('components/layout/AppHeader.tsx')
  const pollHeader = source('components/polls/PollPageHeader.tsx')

  assert.match(appHeader, /border-b border-border/)
  assert.match(appHeader, /text-title-3/)
  assert.match(appHeader, /text-foreground/)
  assert.doesNotMatch(appHeader, /border-\[#e1e7ef\]|text-\[#2b2b2b\]|text-\[24px\]|leading-\[22\.5px\]/)

  assert.match(pollHeader, /border-b border-border/)
  assert.match(pollHeader, /text-label-1-normal/)
  assert.doesNotMatch(pollHeader, /border-\[#e1e7ef\]/)
})

test('loading skeletons mirror the mobile layout foundation', () => {
  const loading = source('components/layout/NavigationLoading.tsx')

  assert.match(loading, /className="flex-1 px-5 pb-24 pt-4"/)
  assert.match(loading, /className="flex-1 px-5 pb-24 pt-6"/)
  assert.match(loading, /overflow-hidden rounded-lg border border-border bg-surface/)
  assert.match(loading, /grid grid-cols-2 gap-5/)
  assert.doesNotMatch(loading, /gap-\[49px\]/)
})

test('poll form and carousel surfaces use card radius foundation', () => {
  const form = source('components/polls/UserPollCreateForm.tsx')
  const carousel = source('components/polls/TypeBPollClient.tsx')

  assert.match(form, /rounded-lg border border-border bg-surface p-4 shadow-g200/)
  assert.doesNotMatch(form, /<section className="[^"]*rounded-md border border-border bg-surface p-4 shadow-g200/)
  assert.match(form, /text-label-2/)
  assert.match(form, /text-caption-1/)

  assert.match(carousel, /rounded-lg border border-border bg-surface text-left shadow-g200/)
  assert.match(carousel, /absolute inset-0 rounded-lg/)
  assert.match(carousel, /bg-primary-dark/)
  assert.match(carousel, /text-title-1/)
  assert.doesNotMatch(carousel, /rounded-md border border-border bg-surface text-left shadow-g200|rounded-md ring-inset|#0c2340|text-\[38px\]/)
})

test('image banners use a readable dark overlay for white text', () => {
  const globals = source('app/globals.css')
  const files = [
    'components/polls/PollListClient.tsx',
    'components/polls/TypeAPollClient.tsx',
    'components/polls/TypeBPollClient.tsx',
    'components/polls/OverallRatingPollClient.tsx',
    'components/polls/OverallRatingResultView.tsx',
  ]

  assert.match(globals, /\.banner-text-overlay/)
  assert.match(globals, /rgba\(0, 0, 0, 0\.52\)/)
  assert.match(globals, /rgba\(0, 0, 0, 0\.92\)/)

  for (const file of files) {
    const content = source(file)
    assert.match(content, /banner-text-overlay absolute inset-0/, `${file} should use a dark text overlay`)
    assert.doesNotMatch(content, /from-black\/10 via-black\/50 to-black\/90/, `${file} should not rely on black opacity utilities`)
    assert.doesNotMatch(content, /linear-gradient\(to bottom, rgba/, `${file} should not hide banner overlay in inline styles`)
  }
})

test('primary tab surfaces do not use arbitrary typography classes', () => {
  const files = [
    'app/menu/page.tsx',
    'components/layout/BottomNav.tsx',
    'components/players/PlayersPageClient.tsx',
    'components/polls/PollListClient.tsx',
    'components/polls/PollCard.tsx',
  ]

  for (const file of files) {
    const content = source(file)
    assert.doesNotMatch(
      content,
      /text-\[[0-9]+px\]|leading-\[[0-9.]+px\]|tracking-\[-?[0-9.]+px\]|text-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b|leading-(tight|snug|normal|relaxed)\b|tracking-(tight|wide|wider)\b/,
      `${file} should use foundation typography tokens`
    )
  }
})

test('application source does not use arbitrary typography or hardcoded visual colors', () => {
  const files = [
    'app/admin/page.tsx',
    'app/login/LoginPageClient.tsx',
    'app/my/feedback/page.tsx',
    'app/onboarding/page.tsx',
    'app/players/changes/page.tsx',
    'app/polls/create/page.tsx',
    'components/images/BannerImageInput.tsx',
    'components/layout/UserMenu.tsx',
    'components/layout/LoginButton.tsx',
    'components/my/MyFeedbackForm.tsx',
    'components/my/MyPageClient.tsx',
    'components/players/PlayersPageClient.tsx',
    'components/polls/CommentsSection.tsx',
    'components/polls/ConfirmModal.tsx',
    'components/polls/LoginModal.tsx',
    'components/polls/OverallRatingPollClient.tsx',
    'components/polls/OverallRatingResultView.tsx',
    'components/polls/PollCard.tsx',
    'components/polls/PollCreateLink.tsx',
    'components/polls/PollListClient.tsx',
    'components/polls/ResultView.tsx',
    'components/polls/TypeAPollClient.tsx',
    'components/polls/TypeBPollClient.tsx',
  ]

  for (const file of files) {
    const content = source(file)
    assert.doesNotMatch(
      content,
      /text-\[[^\]]+\]|leading-\[[^\]]+\]|tracking-\[[^\]]+\]|text-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b|leading-(tight|snug|normal|relaxed)\b|tracking-(tight|wide|wider)\b/,
      `${file} should use foundation typography tokens`
    )
    assert.doesNotMatch(
      content,
      /bg-\[#|bg-\[rgba|text-\[#|border-\[#|from-\[#|to-\[#|shadow-\[|ring-\[|rounded-\[/,
      `${file} should use foundation visual tokens`
    )
  }
})
