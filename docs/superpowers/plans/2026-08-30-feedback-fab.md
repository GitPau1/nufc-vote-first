# 피드백 FAB + 모달 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자에게 모든(admin·onboarding 제외) 화면 우측 하단에 피드백 FAB를 띄우고, 누르면 만족도(선택)·카테고리·내용을 담은 모달로 피드백을 남기며 남긴 페이지 경로를 자동 저장한다.

**Architecture:** 이미 존재하는 `user_feedback` 테이블·`submitFeedback` 액션·`Modal` 껍데기를 재사용/확장한다. 테이블에 `category`/`rating`/`page_path` 3컬럼을 추가하고, 액션 시그니처를 객체로 바꾼다. FAB는 `HeaderAuthStatus`와 동일하게 클라이언트에서 `getHeaderAuth()`로 로그인 여부를 판정한다. 경로→카테고리 매핑은 순수 함수로 분리해 단위 테스트한다.

**Tech Stack:** Next.js 14 App Router, Supabase(Postgres/RLS), Tailwind(시맨틱 토큰), node:test(`*.test.mjs`, `--experimental-strip-types`).

**참고 설계 문서:** `docs/superpowers/specs/2026-08-30-feedback-fab-design.md`

---

## File Structure

**생성:**
- `frontend/src/lib/feedback/categories.ts` — 카테고리 상수/타입/라벨 + `pathToCategory` 순수 함수. 서버·클라이언트 공유(‘use server’ 파일은 상수를 export할 수 없어 별도 모듈).
- `frontend/src/lib/feedback/categories.test.mjs` — `pathToCategory`·`isFeedbackCategory` 동작 테스트.
- `supabase/migrations/20260830170000_extend_user_feedback.sql` — 3컬럼 추가.
- `supabase/rollback/revert_extend_user_feedback.sql` — 롤백(컬럼 drop).
- `frontend/src/components/primitives/modal/contents/Feedback.tsx` — 모달 본문(만족도+카테고리+내용).
- `frontend/src/components/composition/common/FeedbackFab.tsx` — FAB + 모달 조립 + 로그인/경로 게이팅.
- `frontend/src/storybook/feedback/FeedbackModal.stories.tsx` — 스토리.

**수정:**
- `frontend/src/types/database.ts` — `user_feedback` Row에 새 컬럼 타입 추가.
- `frontend/src/lib/actions/feedback.ts` — 시그니처를 객체로, 새 필드 검증·insert.
- `frontend/src/components/composition/my/MyFeedbackForm.tsx` — 액션 호출을 `submitFeedback({ content })`로.
- `frontend/src/app/layout.tsx` — `<FeedbackFab />` 마운트.

---

## Task 1: 카테고리 순수 모듈 + 테스트

**Files:**
- Create: `frontend/src/lib/feedback/categories.ts`
- Test: `frontend/src/lib/feedback/categories.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `frontend/src/lib/feedback/categories.test.mjs`:

```mjs
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FEEDBACK_CATEGORIES,
  isFeedbackCategory,
  pathToCategory,
} from './categories.ts'

test('pathToCategory: 투표 경로 → vote', () => {
  assert.equal(pathToCategory('/'), 'vote')
  assert.equal(pathToCategory('/polls'), 'vote')
  assert.equal(pathToCategory('/polls/123'), 'vote')
})

test('pathToCategory: 승부예측 경로 → prediction', () => {
  assert.equal(pathToCategory('/predictions'), 'prediction')
  assert.equal(pathToCategory('/predictions/2026-w3'), 'prediction')
})

test('pathToCategory: 역대선수 경로 → player', () => {
  assert.equal(pathToCategory('/players'), 'player')
  assert.equal(pathToCategory('/players/changes'), 'player')
})

test('pathToCategory: 매핑 안 되는 경로 → etc', () => {
  assert.equal(pathToCategory('/menu'), 'etc')
  assert.equal(pathToCategory('/my'), 'etc')
  assert.equal(pathToCategory('/anything'), 'etc')
})

test('isFeedbackCategory: 허용 집합만 통과', () => {
  for (const c of FEEDBACK_CATEGORIES) assert.equal(isFeedbackCategory(c), true)
  assert.equal(isFeedbackCategory('bogus'), false)
  assert.equal(isFeedbackCategory(null), false)
  assert.equal(isFeedbackCategory(3), false)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run (from `frontend/`): `node --no-warnings --experimental-strip-types --test src/lib/feedback/categories.test.mjs`
Expected: FAIL — `Cannot find module './categories.ts'`

- [ ] **Step 3: 모듈 구현**

Create `frontend/src/lib/feedback/categories.ts`:

```ts
// 피드백 카테고리 — 서버 액션(검증)과 클라이언트 모달(드롭다운)이 공유한다.
// 'use server' 파일에서는 비-async 값을 export할 수 없어 별도 모듈로 둔다.

export const FEEDBACK_CATEGORIES = ['vote', 'prediction', 'player', 'etc'] as const

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

/** 드롭다운 노출 라벨. 배열 순서가 곧 드롭다운 순서다. */
export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  vote: '투표',
  prediction: '승부예측',
  player: '역대선수',
  etc: '기타',
}

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return typeof value === 'string' && (FEEDBACK_CATEGORIES as readonly string[]).includes(value)
}

/** 현재 경로에서 기본 카테고리를 추론한다. 매핑 안 되는 경로는 'etc'. */
export function pathToCategory(pathname: string): FeedbackCategory {
  if (pathname === '/' || pathname.startsWith('/polls')) return 'vote'
  if (pathname.startsWith('/predictions')) return 'prediction'
  if (pathname.startsWith('/players')) return 'player'
  return 'etc'
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run (from `frontend/`): `node --no-warnings --experimental-strip-types --test src/lib/feedback/categories.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/lib/feedback/categories.ts frontend/src/lib/feedback/categories.test.mjs
git commit -m "feat: 피드백 카테고리 모듈 + 경로 매핑 순수 함수"
```

---

## Task 2: DB 마이그레이션 (user_feedback 확장)

**Files:**
- Create: `supabase/migrations/20260830170000_extend_user_feedback.sql`
- Create: `supabase/rollback/revert_extend_user_feedback.sql`

이 태스크는 DB 스키마라 단위 테스트가 없다. 마이그레이션 파일 작성 후 SQL 문법만 검토한다. (실제 `supabase db push`는 사용자 승인 후 별도 수행 — 아래 Step 3 참고.)

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `supabase/migrations/20260830170000_extend_user_feedback.sql`:

```sql
-- user_feedback에 카테고리/만족도/페이지 경로 추가.
-- FAB 피드백 모달이 쓰는 필드. 기존 insert-only RLS는 그대로 둔다(조회는 대시보드로).
-- category는 DEFAULT 'etc'로 둬 기존 행과 /my/feedback 경로(카테고리 미지정)가 깨지지 않게 한다.
ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'etc'
    CHECK (category IN ('vote', 'prediction', 'player', 'etc')),
  ADD COLUMN IF NOT EXISTS rating smallint
    CHECK (rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS page_path text;

COMMENT ON COLUMN public.user_feedback.category IS '피드백 대상 영역: vote/prediction/player/etc';
COMMENT ON COLUMN public.user_feedback.rating IS '만족도 1~5(선택). 미입력 시 NULL';
COMMENT ON COLUMN public.user_feedback.page_path IS '피드백을 남긴 시점의 경로(자동 저장, 선택)';
```

- [ ] **Step 2: 롤백 파일 작성**

Create `supabase/rollback/revert_extend_user_feedback.sql`:

```sql
-- revert 20260830170000_extend_user_feedback.sql
ALTER TABLE public.user_feedback
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS rating,
  DROP COLUMN IF EXISTS page_path;
```

- [ ] **Step 3: 커밋 (push는 사용자 승인 후)**

```bash
git add supabase/migrations/20260830170000_extend_user_feedback.sql supabase/rollback/revert_extend_user_feedback.sql
git commit -m "feat: user_feedback에 category/rating/page_path 컬럼 추가"
```

> 주의: 실제 `supabase db push`는 이 계획 실행 중 자동으로 하지 말 것. 코드 변경을 먼저 끝내고, mock 모드(`IS_MOCK`)로 UI를 검증한 뒤 사용자에게 push 시점을 확인받는다. push 전까지는 IS_MOCK 경로가 DB를 건너뛰므로 로컬 개발은 문제없다.

---

## Task 3: database.ts 타입 갱신

**Files:**
- Modify: `frontend/src/types/database.ts:197-206`

- [ ] **Step 1: `user_feedback` Row에 새 컬럼 추가**

`frontend/src/types/database.ts`의 `user_feedback` 블록(현재 `:197-206`)을 아래로 교체:

```ts
      user_feedback: {
        Row: {
          id: string
          user_id: string
          content: string
          category: 'vote' | 'prediction' | 'player' | 'etc'
          rating: number | null
          page_path: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_feedback']['Row'], 'id' | 'created_at'>
        Update: never
      }
```

- [ ] **Step 2: 타입 컴파일 확인**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: 이 파일 관련 에러 없음. (액션은 아직 안 고쳤으니 feedback.ts 관련 에러가 있을 수 있으나 Task 4에서 해소된다 — 여기서는 database.ts 문법 에러만 없으면 통과로 본다.)

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/types/database.ts
git commit -m "feat: user_feedback 타입에 category/rating/page_path 반영"
```

---

## Task 4: submitFeedback 액션 확장

**Files:**
- Modify: `frontend/src/lib/actions/feedback.ts` (전체 교체)
- Modify: `frontend/src/components/composition/my/MyFeedbackForm.tsx:18`

- [ ] **Step 1: 액션 전체 교체**

`frontend/src/lib/actions/feedback.ts`를 아래로 교체:

```ts
'use server'

import { IS_MOCK } from '@/lib/config'
import { createClient } from '@/lib/supabase/server'
import { isFeedbackCategory, type FeedbackCategory } from '@/lib/feedback/categories'

export type SubmitFeedbackInput = {
  content: string
  category?: FeedbackCategory
  rating?: number | null
  pagePath?: string | null
}

export async function submitFeedback(input: SubmitFeedbackInput): Promise<{ error?: string }> {
  const trimmed = input.content.trim()

  if (!trimmed) return { error: '피드백을 입력해주세요.' }
  if (trimmed.length > 500) return { error: '피드백은 500자 이하로 입력해주세요.' }

  // 카테고리는 허용 집합만 인정, 아니면 'etc'로 흡수(/my/feedback은 category 없이 호출).
  const category: FeedbackCategory = isFeedbackCategory(input.category) ? input.category : 'etc'

  const rating = input.rating ?? null
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    return { error: '만족도 값이 올바르지 않아요.' }
  }

  const pagePath = input.pagePath ?? null

  if (IS_MOCK) return {}

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('user_feedback')
    .insert({
      user_id: user.id,
      content: trimmed,
      category,
      rating,
      page_path: pagePath,
    })

  if (error) {
    console.error('submitFeedback error:', error)
    return { error: '저장에 실패했어요. 다시 시도해주세요.' }
  }

  return {}
}
```

- [ ] **Step 2: `/my/feedback` 호출부 수정**

`frontend/src/components/composition/my/MyFeedbackForm.tsx:18`
변경 전: `const result = await submitFeedback(content)`
변경 후:

```tsx
      const result = await submitFeedback({ content })
```

- [ ] **Step 3: 타입 컴파일 확인**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: 에러 없음 (feedback.ts, MyFeedbackForm.tsx, database.ts 모두 정합).

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/lib/actions/feedback.ts frontend/src/components/composition/my/MyFeedbackForm.tsx
git commit -m "feat: submitFeedback을 객체 시그니처로 확장(category/rating/pagePath)"
```

---

## Task 5: 피드백 모달 본문 (FeedbackContent)

**Files:**
- Create: `frontend/src/components/primitives/modal/contents/Feedback.tsx`

이 컴포넌트는 렌더링 단위 테스트 인프라가 없으므로(리포 관례상 소스 문자열/순수 함수만 테스트), 스토리북(Task 7)에서 시각 검증한다. 로직 핵심(경로→카테고리 초기값)은 Task 1에서 이미 테스트됨.

- [ ] **Step 1: 컴포넌트 작성**

Create `frontend/src/components/primitives/modal/contents/Feedback.tsx`:

```tsx
'use client'

// 사용 도메인: 피드백 (FAB → 피드백 모달의 본문). 껍데기(Modal)는 호출부(FeedbackFab)가 씌운다.

import { useState, useTransition } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/primitives/button'
import { SheetHeader, SheetTitle, SheetDescription } from '../sheet'
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  pathToCategory,
  type FeedbackCategory,
} from '@/lib/feedback/categories'
import { getSourcePage, trackEvent } from '@/lib/analytics/mixpanel'

// 만족도 1~5. 이모지는 참고 이미지(찡그림→하트눈) 순서를 따른다.
const RATINGS: { value: number; emoji: string; label: string }[] = [
  { value: 1, emoji: '😦', label: '별로예요' },
  { value: 2, emoji: '🙄', label: '아쉬워요' },
  { value: 3, emoji: '😐', label: '보통이에요' },
  { value: 4, emoji: '😌', label: '좋아요' },
  { value: 5, emoji: '😍', label: '최고예요' },
]

interface FeedbackContentProps {
  onClose: () => void
}

export function FeedbackContent({ onClose }: FeedbackContentProps) {
  const pathname = usePathname()
  // 모달을 연 시점의 경로를 고정 — 제출 지연 중 라우팅돼도 남긴 화면 기준으로 저장.
  const [pagePath] = useState(pathname)
  const [rating, setRating] = useState<number | null>(null)
  const [category, setCategory] = useState<FeedbackCategory>(() => pathToCategory(pathname))
  const [content, setContent] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMessage(null)

    startTransition(async () => {
      const { submitFeedback } = await import('@/lib/actions/feedback')
      const result = await submitFeedback({ content, category, rating, pagePath })
      if (result.error) {
        setMessage(result.error)
        return
      }
      trackEvent('feedback_submitted', {
        source_page: getSourcePage(pagePath),
        content_length: content.trim().length,
        category,
        rating: rating ?? undefined,
      })
      onClose()
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <SheetHeader>
        <SheetTitle className="text-body-1-normal">의견을 들려주세요</SheetTitle>
        <SheetDescription>불편했던 점이나 개선 아이디어를 알려주세요.</SheetDescription>
      </SheetHeader>

      {/* 만족도(선택) — 다시 누르면 해제 */}
      <div className="flex justify-between px-1">
        {RATINGS.map(r => (
          <button
            key={r.value}
            type="button"
            aria-label={r.label}
            aria-pressed={rating === r.value}
            onClick={() => setRating(prev => (prev === r.value ? null : r.value))}
            className={`text-headline-1 transition-transform ${rating === r.value ? 'scale-125' : 'opacity-50 hover:opacity-100'}`}
          >
            {r.emoji}
          </button>
        ))}
      </div>

      {/* 카테고리 — 열릴 때 현재 경로 기준 초기 선택, 변경 가능 */}
      <select
        value={category}
        onChange={e => setCategory(e.target.value as FeedbackCategory)}
        aria-label="피드백 카테고리"
        className="w-full rounded-sm border border-neutral-weak bg-surface px-3.5 py-3 text-body-1-reading text-neutral outline-none focus:border-brand-solid"
      >
        {FEEDBACK_CATEGORIES.map(c => (
          <option key={c} value={c}>{FEEDBACK_CATEGORY_LABELS[c]}</option>
        ))}
      </select>

      {/* 내용(필수) */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value.slice(0, 500))}
        className="min-h-[140px] w-full resize-none rounded-sm border border-neutral-weak bg-surface px-3.5 py-3 text-body-1-reading text-neutral outline-none placeholder:text-placeholder focus:border-brand-solid"
        placeholder="자세한 내용을 남겨주세요."
        maxLength={500}
      />
      <div className="flex items-center justify-between text-caption-2 text-neutral-muted">
        <span>{message}</span>
        <span>{content.length}/500</span>
      </div>

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? '보내는 중...' : '피드백 보내기'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: 타입 컴파일 확인**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/primitives/modal/contents/Feedback.tsx
git commit -m "feat: 피드백 모달 본문(만족도+카테고리+내용)"
```

---

## Task 6: FeedbackFab + layout 마운트

**Files:**
- Create: `frontend/src/components/composition/common/FeedbackFab.tsx`
- Modify: `frontend/src/app/layout.tsx:23`

- [ ] **Step 1: FAB 컴포넌트 작성**

Create `frontend/src/components/composition/common/FeedbackFab.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle } from 'lucide-react'
import { getHeaderAuth, type HeaderAuth } from '@/lib/actions/auth'
import { Modal } from '@/components/primitives/modal/Modal'
import { FeedbackContent } from '@/components/primitives/modal/contents/Feedback'

// FAB를 숨길 경로 접두. 관리자·온보딩은 피드백 수집 대상이 아니다.
const HIDDEN_PREFIXES = ['/admin', '/onboarding']

export function FeedbackFab() {
  const pathname = usePathname()
  // HeaderAuthStatus와 동일한 관례 — 클라이언트에서 서버 액션으로 로그인 여부를 판정한다.
  const [auth, setAuth] = useState<HeaderAuth | null | undefined>(undefined)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getHeaderAuth().then(setAuth)
  }, [])

  const hidden = HIDDEN_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))
  // undefined(로딩) + null(비로그인) + 숨김 경로면 렌더하지 않는다.
  if (!auth || hidden) return null

  return (
    <>
      <button
        type="button"
        aria-label="피드백 남기기"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-pill bg-brand-solid text-on-solid shadow-w200 active:bg-brand-solid-pressed sm:bottom-6"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <Modal open={open} onOpenChange={o => { if (!o) setOpen(false) }}>
        <FeedbackContent onClose={() => setOpen(false)} />
      </Modal>
    </>
  )
}
```

> 위치 근거: BottomNav는 5개 경로에서 `fixed bottom-0 z-40`로 뜬다. FAB는 모바일에서 `bottom-24`(BottomNav 위)·`z-50`으로 겹치지 않게 하고, 데스크탑(`sm:`)에서는 그 경로들의 BottomNav가 `sm:hidden`이므로 `sm:bottom-6`로 낮춘다. 색은 Button default variant와 동일한 토큰 조합(`bg-brand-solid text-on-solid shadow-w200 active:bg-brand-solid-pressed`)을 재사용한다.

- [ ] **Step 2: layout에 마운트**

`frontend/src/app/layout.tsx` 수정:

import 추가(파일 상단 import 블록, `BottomNav` import 아래):

```tsx
import { FeedbackFab } from '@/components/composition/common/FeedbackFab'
```

`<BottomNav />`(현재 `:23`) 바로 아래에 추가:

```tsx
          <BottomNav />
          <FeedbackFab />
```

- [ ] **Step 3: 타입 컴파일 + 린트 확인**

Run (from `frontend/`): `npx tsc --noEmit && npm run lint`
Expected: 에러 없음.

- [ ] **Step 4: mock 모드 수동 확인**

Run (from `frontend/`): `npm run dev`
확인 절차:
1. `/`(투표 홈)에서 로그인 전에는 FAB가 **안 보임**.
2. 헤더에서 "데모로 바로 로그인" 후 새로고침 → 우측 하단 FAB 노출.
3. FAB 클릭 → 모달 오픈. 카테고리 초깃값이 "투표"인지 확인.
4. `/predictions`로 이동 후 FAB → 카테고리 초깃값 "승부예측" 확인.
5. `/onboarding`, `/admin`에서는 FAB가 **안 보임**.
6. 내용 입력 후 제출 → 모달 닫힘(mock은 DB 건너뜀, 에러 없어야 함).

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/composition/common/FeedbackFab.tsx frontend/src/app/layout.tsx
git commit -m "feat: 피드백 FAB를 전역 layout에 마운트(로그인·경로 게이팅)"
```

---

## Task 7: 스토리북 스토리

**Files:**
- Create: `frontend/src/storybook/feedback/FeedbackModal.stories.tsx`

- [ ] **Step 1: 스토리 작성**

Create `frontend/src/storybook/feedback/FeedbackModal.stories.tsx`:

```tsx
import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { Modal } from '@/components/primitives/modal/Modal'
import { FeedbackContent } from '@/components/primitives/modal/contents/Feedback'
import { Button } from '@/components/primitives/button'

// FAB가 여는 피드백 모달의 본문. 만족도(선택)+카테고리+내용. 카테고리 초깃값은
// 현재 경로(pathname)에서 pathToCategory로 정해진다.
const meta = {
  title: 'Feedback/FeedbackModal',
  parameters: {
    // usePathname()을 쓰므로 appDirectory 없으면 "app router mounted" invariant로 죽는다.
    nextjs: { appDirectory: true, navigation: { pathname: '/predictions/2026-35' } },
    viewport: { options: INITIAL_VIEWPORTS },
  },
  render: () => (
    <Modal open onOpenChange={() => {}}>
      <FeedbackContent onClose={() => {}} />
    </Modal>
  ),
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** 승부예측 페이지 맥락 — 카테고리 초깃값이 "승부예측"으로 선택돼 있다. */
export const Default: Story = {}

/** 투표 홈 맥락 — 카테고리 초깃값 "투표". */
export const FromVotePage: Story = {
  parameters: { nextjs: { navigation: { pathname: '/' } } },
}

/** 매핑 안 되는 경로 — 카테고리 초깃값 "기타". */
export const FromEtcPage: Story = {
  parameters: { nextjs: { navigation: { pathname: '/menu' } } },
}

/** 모바일 폭 — responsive라 바텀시트로 뜬다. */
export const Mobile: Story = {
  globals: { viewport: { value: 'iphone12' } },
}

/** 실제로 열리고 닫히는 형태 — FAB(FeedbackFab)와 같은 구조. */
export const Interactive: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          피드백 남기기
        </Button>
        <Modal open={open} onOpenChange={o => { if (!o) setOpen(false) }}>
          <FeedbackContent onClose={() => setOpen(false)} />
        </Modal>
      </>
    )
  },
}
```

- [ ] **Step 2: 스토리북 빌드 확인**

Run (from `frontend/`): `npm run build-storybook`
Expected: 빌드 성공, 이 스토리 관련 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/storybook/feedback/FeedbackModal.stories.tsx
git commit -m "feat: 피드백 모달 스토리북 스토리"
```

---

## Task 8: 전체 테스트 + 마무리

**Files:** 없음(검증만)

- [ ] **Step 1: 전체 테스트 실행**

Run (from `frontend/`): `npm test`
Expected: 기존 94개 + 신규(categories 5개) 모두 PASS. 실패 시 해당 테스트를 고치되, 소스 문자열 정규식 테스트가 화면 구조 변경으로 깨졌으면 지우지 말고 옮겨간 자리 기준으로 단정문을 다시 쓴다.

- [ ] **Step 2: 린트 + 타입**

Run (from `frontend/`): `npm run lint && npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 설계 문서와 대조**

`docs/superpowers/specs/2026-08-30-feedback-fab-design.md`의 "결정 사항" 표 각 항목이 구현됐는지 확인:
로그인 게이팅·카테고리 4종·만족도 선택·경로 자동 저장·카테고리 자동선택·admin/onboarding 숨김·`/my/feedback` 유지·관리자 화면 미포함.

- [ ] **Step 4: 최종 확인 후 사용자에게 DB push 시점 문의**

코드가 모두 통과하면 사용자에게 보고하고, `supabase db push`(마이그레이션 반영) 실행 시점을 확인받는다. push 전까지 실서비스 연동 시 새 컬럼이 없어 insert가 실패할 수 있으므로, **배포 전 반드시 push가 선행돼야 함**을 명시한다.

---

## 범위 밖 (이번에 안 함)
- 관리자 열람 화면(`/admin/feedback`), 관리자 SELECT RLS → Supabase 대시보드로 조회.
- 스팸/rate limit 방어.
- 만족도 통계/집계 화면.
