# Component Foundation Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align NUFC Vote components to the approved Foundation Strict direction across shared primitives, repeated components, composite poll views, and utility screens.

**Architecture:** Keep existing page and data-flow architecture unchanged. Apply the foundation through Tailwind theme tokens, shared primitive defaults, local component class updates, and regression tests that prevent arbitrary typography and hardcoded visual colors from returning.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Node `node:test`, existing component primitives in `app/src/components/ui`.

---

## File Structure

- `app/tailwind.config.ts`: Defines Wanted typography role tokens.
- `app/src/app/globals.css`: Defines global helper classes for inputs and primary/secondary buttons.
- `app/src/components/ui/card.tsx`: Shared card radius and title/description typography.
- `app/src/components/ui/button.tsx`: Shared button typography.
- `app/src/components/ui/badge.tsx`: Shared badge typography.
- `app/src/components/ui/sheet.tsx`: Shared sheet title/description typography.
- `app/src/components/layout/AppHeader.tsx`: Tokenized app header border and logo type.
- `app/src/components/layout/BottomNav.tsx`: Tokenized bottom navigation labels.
- `app/src/components/layout/NavigationLoading.tsx`: Skeletons matching page margin/radius foundation.
- `app/src/components/layout/UserMenu.tsx`: Tokenized menu item typography.
- `app/src/components/polls/*.tsx`: Poll cards, list, detail, result, comments, rating, create, and confirm components.
- `app/src/components/players/PlayersPageClient.tsx`: Player list, Pick One card, and state treatment.
- `app/src/app/**/*.tsx`: Utility screens such as login, onboarding, admin, feedback, player changes, and poll create.
- `app/src/components/design-foundation.test.mjs`: Foundation regression tests.
- Existing page/component tests: Keep route-specific contracts updated when old pixel-specific expectations conflict with foundation tokens.

---

### Task 1: Add Foundation Regression Tests

**Files:**
- Create/Modify: `app/src/components/design-foundation.test.mjs`
- Modify: `app/src/components/players/players-page-client.test.mjs`
- Modify: `app/src/components/polls/result-view-figma-contract.test.mjs`

- [ ] **Step 1: Add shared primitive and source-wide foundation tests**

Add this structure to `app/src/components/design-foundation.test.mjs`:

```js
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
  assert.match(card, /rounded-lg border border-border bg-surface/)
  assert.match(card, /text-headline-1/)
  assert.match(card, /text-label-1-reading/)
  assert.match(button, /text-body-2-normal/)
  assert.match(badge, /text-caption-2/)
  assert.match(sheet, /text-headline-1/)
  assert.match(sheet, /text-label-1-reading/)
  assert.match(globals, /text-label-1-normal/)
  assert.match(globals, /text-body-2-normal/)
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
    'components/my/MyFeedbackForm.tsx',
    'components/my/MyPageClient.tsx',
    'components/players/PlayersPageClient.tsx',
    'components/polls/CommentsSection.tsx',
    'components/polls/ConfirmModal.tsx',
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
    assert.doesNotMatch(content, /text-\[[^\]]+\]|leading-\[[^\]]+\]|tracking-\[[^\]]+\]/)
    assert.doesNotMatch(content, /bg-\[#|text-\[#|border-\[#|from-\[#|to-\[#|shadow-\[|ring-\[|rounded-\[/)
  }
})
```

- [ ] **Step 2: Run tests and verify failures before implementation**

Run:

```bash
cd /Users/bugeon/.codex/worktrees/aebf/nufcpoll/app
node --test src/components/design-foundation.test.mjs
```

Expected before implementation: FAIL on missing typography tokens or arbitrary classes.

- [ ] **Step 3: Update route-specific expectations**

In `app/src/components/players/players-page-client.test.mjs`, replace any hardcoded selected-state expectation:

```js
assert.match(file, /ring-4 ring-inset ring-primary/)
```

In `app/src/components/polls/result-view-figma-contract.test.mjs`, update the comment composer radius expectation:

```js
assert.match(commentsSection, /rounded-lg/)
assert.doesNotMatch(commentsSection, /rounded-\[16px\]/)
```

- [ ] **Step 4: Commit**

```bash
git add app/src/components/design-foundation.test.mjs app/src/components/players/players-page-client.test.mjs app/src/components/polls/result-view-figma-contract.test.mjs
git commit -m "test: lock component foundation rules"
```

---

### Task 2: Add Tailwind Typography Tokens And Primitive Defaults

**Files:**
- Modify: `app/tailwind.config.ts`
- Modify: `app/src/app/globals.css`
- Modify: `app/src/components/ui/card.tsx`
- Modify: `app/src/components/ui/button.tsx`
- Modify: `app/src/components/ui/badge.tsx`
- Modify: `app/src/components/ui/sheet.tsx`

- [ ] **Step 1: Add Wanted typography role tokens**

In `app/tailwind.config.ts`, inside `theme.extend`, add:

```ts
fontSize: {
  "display-1": ["56px", { lineHeight: "72px", letterSpacing: "-0.0319em" }],
  "display-2": ["40px", { lineHeight: "52px", letterSpacing: "-0.0282em" }],
  "title-1": ["36px", { lineHeight: "48px", letterSpacing: "-0.027em" }],
  "title-2": ["28px", { lineHeight: "38px", letterSpacing: "-0.0236em" }],
  "title-3": ["24px", { lineHeight: "32px", letterSpacing: "-0.023em" }],
  "heading-1": ["22px", { lineHeight: "30px", letterSpacing: "-0.0194em" }],
  "heading-2": ["20px", { lineHeight: "28px", letterSpacing: "-0.012em" }],
  "headline-1": ["18px", { lineHeight: "26px", letterSpacing: "-0.002em" }],
  "headline-2": ["17px", { lineHeight: "24px", letterSpacing: "0em" }],
  "body-1-normal": ["16px", { lineHeight: "24px", letterSpacing: "0.0057em" }],
  "body-1-reading": ["16px", { lineHeight: "26px", letterSpacing: "0.0057em" }],
  "body-2-normal": ["15px", { lineHeight: "22px", letterSpacing: "0.0096em" }],
  "body-2-reading": ["15px", { lineHeight: "24px", letterSpacing: "0.0096em" }],
  "label-1-normal": ["14px", { lineHeight: "20px", letterSpacing: "0.0145em" }],
  "label-1-reading": ["14px", { lineHeight: "22px", letterSpacing: "0.0145em" }],
  "label-2": ["13px", { lineHeight: "18px", letterSpacing: "0.0194em" }],
  "caption-1": ["12px", { lineHeight: "16px", letterSpacing: "0.0252em" }],
  "caption-2": ["11px", { lineHeight: "14px", letterSpacing: "0.0311em" }],
},
```

- [ ] **Step 2: Update global helper classes**

In `app/src/app/globals.css`, update:

```css
.input-field {
  @apply w-full rounded-sm border border-border bg-white px-3 py-2 text-label-1-normal text-foreground outline-none focus:border-primary;
}
.btn-primary {
  @apply w-full rounded-sm bg-primary py-3.5 text-body-2-normal font-bold text-white shadow-w200 transition-opacity hover:opacity-70 active:opacity-50 disabled:bg-disabled disabled:text-gray-3 disabled:opacity-100;
}
.btn-secondary {
  @apply w-full rounded-sm border border-gray-4 bg-transparent py-3.5 text-body-2-normal font-bold text-foreground transition-opacity hover:opacity-70 active:opacity-50 disabled:bg-disabled disabled:text-gray-3 disabled:opacity-100;
}
```

- [ ] **Step 3: Update shared primitives**

Use these mappings:

```tsx
// card.tsx
"rounded-lg border border-border bg-surface text-card-foreground shadow-g200"
"text-headline-1 font-bold"
"text-label-1-reading text-muted-foreground"

// button.tsx
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-body-2-normal font-bold ..."
sm: "h-9 px-3 text-label-2"

// badge.tsx
"inline-flex items-center rounded-pill border px-[9px] py-[3px] text-caption-2 font-semibold ..."

// sheet.tsx
"text-headline-1 font-bold text-foreground"
"text-label-1-reading text-muted-foreground"
```

- [ ] **Step 4: Verify**

Run:

```bash
node --test src/components/design-foundation.test.mjs
```

Expected: primitive tests PASS, source-wide arbitrary class test may still FAIL until later tasks.

- [ ] **Step 5: Commit**

```bash
git add app/tailwind.config.ts app/src/app/globals.css app/src/components/ui/card.tsx app/src/components/ui/button.tsx app/src/components/ui/badge.tsx app/src/components/ui/sheet.tsx
git commit -m "feat: add foundation typography primitives"
```

---

### Task 3: Align Navigation, Feed, And Player Components

**Files:**
- Modify: `app/src/components/layout/AppHeader.tsx`
- Modify: `app/src/components/layout/BottomNav.tsx`
- Modify: `app/src/components/layout/NavigationLoading.tsx`
- Modify: `app/src/components/layout/UserMenu.tsx`
- Modify: `app/src/components/polls/PollListClient.tsx`
- Modify: `app/src/components/polls/PollCard.tsx`
- Modify: `app/src/components/players/PlayersPageClient.tsx`

- [ ] **Step 1: Update headers and navigation**

Use:

```tsx
// AppHeader.tsx
<header className="sticky top-0 z-50 w-full border-b border-border bg-gradient-to-b from-white to-white/75 backdrop-blur">
<span className="text-title-3 font-black text-foreground">

// BottomNav.tsx
className={`flex flex-1 flex-col items-center gap-0.5 text-caption-2 font-semibold transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}

// UserMenu.tsx
className="block px-4 py-2.5 text-label-2 font-medium text-foreground border-b border-border hover:bg-secondary"
className="block w-full text-left px-4 py-2.5 text-label-2 font-medium text-negative hover:bg-negative-dim"
```

- [ ] **Step 2: Update loading skeletons**

Use `px-5` for primary tab skeletons and `rounded-lg` for list/card shells:

```tsx
<div aria-hidden="true" className="flex-1 px-5 pb-24 pt-4">
<div className="grid grid-cols-2 gap-5">
<div className="overflow-hidden rounded-lg border border-border bg-surface">
<div aria-hidden="true" className="flex-1 px-5 pb-24 pt-6">
```

- [ ] **Step 3: Update poll feed components**

Use:

```tsx
// PollListClient.tsx
<div className="px-5 pt-4 pb-10 animate-enter">
<span className="inline-flex h-[21px] items-center rounded-pill bg-primary/55 px-[9px] text-caption-2 font-semibold text-white backdrop-blur-[2px]">
<p className="truncate text-headline-2 font-bold text-white">{poll.title}</p>
<p className="mt-1 truncate text-caption-1 text-white/75">{poll.description}</p>
className={`h-8 flex-1 border-b px-2.5 pb-[13px] text-center text-label-2 font-bold transition-colors ...`}

// PollCard.tsx
<p className="truncate text-body-2-normal font-bold text-foreground">{poll.title}</p>
<p className="mt-0.5 line-clamp-1 text-caption-1 text-gray-2">
```

- [ ] **Step 4: Update player list and Pick One**

Use:

```tsx
<div className="px-5 pt-4 pb-10 animate-enter">
<div className="overflow-hidden rounded-lg border border-border bg-surface">
<p className="truncate text-label-1-reading font-semibold text-foreground">
<div className="flex items-center gap-3 text-caption-2 text-gray-2">
<div className="w-8 flex-shrink-0 text-center text-body-1-normal font-semibold text-foreground">
className={`... rounded-lg bg-gray-1 ... ${isPicked ? 'ring-4 ring-inset ring-primary' : ''} ...`}
```

- [ ] **Step 5: Verify**

Run:

```bash
node --test src/components/players/players-page-client.test.mjs src/components/polls/poll-list-client.test.mjs src/components/layout/navigation-loading.test.mjs src/components/layout/bottom-nav.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/layout/AppHeader.tsx app/src/components/layout/BottomNav.tsx app/src/components/layout/NavigationLoading.tsx app/src/components/layout/UserMenu.tsx app/src/components/polls/PollListClient.tsx app/src/components/polls/PollCard.tsx app/src/components/players/PlayersPageClient.tsx
git commit -m "feat: align feed and player components to foundation"
```

---

### Task 4: Align Composite Poll, Result, Comment, And Utility Screens

**Files:**
- Modify: `app/src/components/polls/UserPollCreateForm.tsx`
- Modify: `app/src/components/polls/TypeAPollClient.tsx`
- Modify: `app/src/components/polls/TypeBPollClient.tsx`
- Modify: `app/src/components/polls/OverallRatingPollClient.tsx`
- Modify: `app/src/components/polls/OverallRatingResultView.tsx`
- Modify: `app/src/components/polls/ResultView.tsx`
- Modify: `app/src/components/polls/CommentsSection.tsx`
- Modify: `app/src/components/polls/ConfirmModal.tsx`
- Modify: `app/src/components/polls/PollCreateLink.tsx`
- Modify: `app/src/app/login/LoginPageClient.tsx`
- Modify: `app/src/app/onboarding/page.tsx`
- Modify: `app/src/app/admin/page.tsx`
- Modify: `app/src/app/my/feedback/page.tsx`
- Modify: `app/src/app/players/changes/page.tsx`
- Modify: `app/src/components/images/BannerImageInput.tsx`
- Modify: `app/src/components/my/MyFeedbackForm.tsx`
- Modify: `app/src/components/my/MyPageClient.tsx`

- [ ] **Step 1: Align form and create surfaces**

Use `rounded-lg` for outer form sections and token text:

```tsx
<section className="space-y-2.5 rounded-lg border border-border bg-surface p-4 shadow-g200">
<p className="text-label-2 font-bold text-foreground">
<button className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-disabled px-2.5 text-caption-1 font-bold text-foreground">
```

- [ ] **Step 2: Align poll detail/rating headers**

Use:

```tsx
<Badge className="bg-white/20 text-white border-0 backdrop-blur-sm text-caption-2 font-semibold pointer-events-none">
<h1 className="text-headline-1 font-black text-white">{poll.title}</h1>
<span className="max-w-[38%] truncate text-right text-caption-1 font-bold text-white/80">
```

- [ ] **Step 3: Align result and comment surfaces**

Use:

```tsx
// CommentsSection.tsx
className="h-[62px] flex-1 resize-none rounded-lg border border-border bg-surface px-[13px] py-[11px] text-label-1-reading text-foreground ..."
<div className="overflow-hidden rounded-lg border border-border bg-surface shadow-g200">
<p className="text-label-2 font-bold tracking-wide text-gray-1">

// ResultView.tsx
<div className="flex min-h-screen flex-col bg-background">
<section className="overflow-hidden rounded-lg border border-border bg-surface">
<h1 className="break-keep text-heading-2 font-bold text-foreground">
<div className="mx-4 w-[calc(100%-32px)] rounded-lg bg-disabled p-5 text-center text-label-1-normal font-medium text-muted-foreground">
```

- [ ] **Step 4: Align utility screens**

Use token headings and labels:

```tsx
// login
<h1 className="text-heading-1 font-black text-foreground text-center mb-2">

// admin / feedback / poll create / menu section headers
<p className="text-heading-2 font-black text-foreground">
<p className="mt-1 text-label-2 text-muted-foreground">

// onboarding
<label className="text-label-2 font-semibold text-foreground">
<span className="text-caption-2 text-muted-foreground">
```

- [ ] **Step 5: Verify arbitrary visual classes are gone**

Run:

```bash
rg -n "text-\[[^\]]+\]|leading-\[[^\]]+\]|tracking-\[[^\]]+\]|bg-\[#|text-\[#|border-\[#|from-\[#|to-\[#|shadow-\[|ring-\[|rounded-\[" app/src
```

Expected: no matches.

- [ ] **Step 6: Verify tests**

Run:

```bash
node --test src/components/design-foundation.test.mjs src/components/polls/result-view-figma-contract.test.mjs src/app/login/login-next.test.mjs src/app/admin/admin-page.test.mjs src/app/players/pick-one-weekly-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/polls app/src/app/login/LoginPageClient.tsx app/src/app/onboarding/page.tsx app/src/app/admin/page.tsx app/src/app/my/feedback/page.tsx app/src/app/players/changes/page.tsx app/src/components/images/BannerImageInput.tsx app/src/components/my/MyFeedbackForm.tsx app/src/components/my/MyPageClient.tsx
git commit -m "feat: align composite components to foundation"
```

---

### Task 5: Final Verification

**Files:**
- No code changes expected unless verification finds a regression.

- [ ] **Step 1: Run full tests**

Run:

```bash
cd /Users/bugeon/.codex/worktrees/aebf/nufcpoll/app
node --test $(rg --files src | rg 'test\.mjs$')
```

Expected: all tests PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: build succeeds. Existing `<img>` warnings are acceptable unless this task explicitly expands into image optimization.

- [ ] **Step 3: Restart dev server after build**

If the dev server is running while `npm run build` runs, restart it so `_next/static` assets are not stale:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3017
```

Expected: stylesheet and chunks respond with `200 OK`.

- [ ] **Step 4: Confirm served page has no arbitrary visual classes**

Run:

```bash
curl -s http://127.0.0.1:3017/players | rg "text-\[[^\]]+\]|leading-\[[^\]]+\]|tracking-\[[^\]]+\]|bg-\[#|text-\[#|shadow-\[|ring-\[|rounded-\["
```

Expected: no matches.

- [ ] **Step 5: Commit final verification updates**

If verification required follow-up edits:

```bash
git add <changed-files>
git commit -m "chore: verify component foundation alignment"
```

If no follow-up edits were required, do not create an empty commit.

---

## Self-Review

- Spec coverage: All spec rules are covered by Tasks 1-5. Typography, colors, radius, component scope, exceptions, and verification each have explicit tasks.
- Placeholder scan: No `TBD`, `TODO`, undefined later work, or open-ended test instructions remain.
- Type consistency: The plan uses existing file names and class names from the current codebase. No new functions or public APIs are introduced.
