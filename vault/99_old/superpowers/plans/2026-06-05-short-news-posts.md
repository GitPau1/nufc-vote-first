# 짧은 소식 게시글 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인 사용자가 `/posts`에서 300자 이하의 짧은 소식 게시글을 작성, 수정, 삭제하고 X/YouTube/일반 URL 임베드와 카드 내 이모지 반응을 사용할 수 있게 한다.

**Architecture:** Supabase에 `posts`, `post_reactions` 테이블을 추가하고 RLS로 읽기/작성/수정/삭제 권한을 제한한다. 앱 코드는 순수 도메인 로직(`lib/posts.ts`)을 먼저 만들고, query/action/UI가 그 로직을 사용한다. 분석은 기존 Mixpanel activation loop 설계에 맞춰 소식 피드 노출, 작성, 발행, 반응, 임베드 클릭만 추적한다.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase PostgreSQL/RLS, Server Actions, Tailwind CSS, shadcn/ui, lucide-react, Mixpanel.

**UI Reference:** `output/short-news-posts-layout.html` is the approved layout reference. Match its feed controls, floating compose button, bottom-sheet composer, inline post-type chip, and card information order during implementation.

---

## 파일 구조

- Create: `supabase/migrations/20260605090000_add_short_news_posts.sql`
  - `posts`, `post_reactions` 테이블, 제약 조건, 인덱스, RLS 정책을 정의한다.
- Modify: `app/src/types/database.ts`
  - `PostType`, `PostReactionType`, `PostEmbedKind`, `posts`, `post_reactions` 타입을 추가한다.
- Create: `app/src/lib/posts.ts`
  - 게시글 본문 validation, URL 정규화, 임베드 유형 판별, 반응 토글 결정 로직을 담는다.
- Create: `app/src/lib/posts.test.mjs`
  - `posts.ts` 순수 함수 테스트를 담는다.
- Create: `app/src/lib/queries/posts.ts`
  - `/posts` 피드 조회용 타입과 Supabase query를 담는다.
- Modify: `app/src/lib/mock/data.ts`
  - 목 모드 소식 게시글 데이터를 추가한다.
- Modify: `app/src/lib/mock/queries.ts`
  - 목 모드 소식 조회 함수를 추가한다.
- Create: `app/src/lib/actions/posts.ts`
  - 게시글 작성/수정/삭제, 반응 토글 Server Action을 담는다.
- Create: `app/src/components/posts/PostComposer.tsx`
  - 작성 폼과 수정 폼을 담당한다.
- Create: `app/src/components/posts/PostEmbedCard.tsx`
  - 일반 링크, X, YouTube 임베드 렌더링을 담당한다.
- Create: `app/src/components/posts/PostReactionRow.tsx`
  - 카드 내 이모지 반응 표시와 토글을 담당한다.
- Create: `app/src/components/posts/PostCard.tsx`
  - 게시글 카드, 작성자 수정/삭제 컨트롤을 담당한다.
- Create: `app/src/components/posts/PostFeedClient.tsx`
  - 클라이언트 상태, 작성/수정 후 목록 반영, `post_feed_viewed` 추적을 담당한다.
- Create: `app/src/app/posts/page.tsx`
  - 서버에서 초기 피드와 로그인 상태를 불러와 클라이언트에 전달한다.
- Modify: `app/src/components/layout/BottomNav.tsx`
  - 하단 내비게이션에 `소식` 탭을 추가한다.
- Modify: `app/src/lib/analytics/mixpanel.ts`
  - `getSourcePage('/posts')`를 `posts`로 반환한다.

---

### Task 1: DB 스키마와 타입 추가

**Files:**
- Create: `supabase/migrations/20260605090000_add_short_news_posts.sql`
- Modify: `app/src/types/database.ts`

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `supabase/migrations/20260605090000_add_short_news_posts.sql`:

```sql
-- =====================================================
-- Short news posts
-- =====================================================

CREATE TABLE public.posts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id),
  type         text NOT NULL CHECK (type IN ('free', 'info', 'official')),
  content      text NOT NULL CHECK (char_length(content) <= 300),
  url          text,
  embed_kind   text NOT NULL DEFAULT 'none' CHECK (embed_kind IN ('none', 'link', 'x', 'youtube')),
  embed_title  text,
  embed_domain text,
  is_hidden    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (type <> 'official' OR url IS NOT NULL)
);

ALTER TABLE public.posts
  ADD CONSTRAINT posts_public_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.public_profiles(id)
  ON DELETE CASCADE NOT VALID;

CREATE TABLE public.post_reactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.users(id),
  reaction_type text NOT NULL CHECK (reaction_type IN ('expecting', 'shocked', 'angry', 'sad', 'curious')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX posts_created_at_idx ON public.posts(created_at DESC);
CREATE INDEX posts_visible_created_at_idx ON public.posts(created_at DESC) WHERE is_hidden = false;
CREATE INDEX post_reactions_post_id_idx ON public.post_reactions(post_id);

CREATE OR REPLACE FUNCTION public.set_posts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_posts_updated_at();

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts: public read visible"
  ON public.posts FOR SELECT
  USING (is_hidden = false);

CREATE POLICY "posts: insert authenticated own"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts: update own"
  ON public.posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts: delete own"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "post_reactions: public read"
  ON public.post_reactions FOR SELECT
  USING (true);

CREATE POLICY "post_reactions: insert authenticated own"
  ON public.post_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_reactions: update own"
  ON public.post_reactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "post_reactions: delete own"
  ON public.post_reactions FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: 타입 추가**

Modify `app/src/types/database.ts` near the existing top-level union types:

```ts
export type PostType = 'free' | 'info' | 'official'
export type PostEmbedKind = 'none' | 'link' | 'x' | 'youtube'
export type PostReactionType = 'expecting' | 'shocked' | 'angry' | 'sad' | 'curious'
```

Add these table entries inside `Database['public']['Tables']`:

```ts
      posts: {
        Row: {
          id: string
          user_id: string
          type: PostType
          content: string
          url: string | null
          embed_kind: PostEmbedKind
          embed_title: string | null
          embed_domain: string | null
          is_hidden: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['posts']['Row'], 'id' | 'is_hidden' | 'created_at' | 'updated_at'>
        Update: Partial<Pick<Database['public']['Tables']['posts']['Row'], 'type' | 'content' | 'url' | 'embed_kind' | 'embed_title' | 'embed_domain' | 'is_hidden'>>
      }
      post_reactions: {
        Row: {
          id: string
          post_id: string
          user_id: string
          reaction_type: PostReactionType
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['post_reactions']['Row'], 'id' | 'created_at'>
        Update: Pick<Database['public']['Tables']['post_reactions']['Row'], 'reaction_type'>
      }
```

- [ ] **Step 3: 타입 체크 실행**

Run:

```bash
cd app
npm run build
```

Expected: PASS. If the build fails because new `Database` entries are misplaced, fix the type block before continuing.

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260605090000_add_short_news_posts.sql app/src/types/database.ts
git commit -m "feat: add short news post schema"
```

---

### Task 2: 게시글 도메인 로직과 테스트

**Files:**
- Create: `app/src/lib/posts.ts`
- Create: `app/src/lib/posts.test.mjs`
- Modify: `app/package.json`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `app/src/lib/posts.test.mjs`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const __dirname = path.dirname(new URL(import.meta.url).pathname)
const sourcePath = path.join(__dirname, 'posts.ts')

function loadPostsModule() {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      strict: true,
    },
  }).outputText

  const cjsModule = { exports: {} }
  const fn = new Function('exports', 'module', compiled)
  fn(cjsModule.exports, cjsModule)
  return cjsModule.exports
}

test('normalizes valid free post input', () => {
  const { normalizePostInput } = loadPostsModule()

  assert.deepEqual(normalizePostInput({
    type: 'free',
    content: '  이 소식 꽤 흥미롭네요  ',
    url: '',
  }), {
    type: 'free',
    content: '이 소식 꽤 흥미롭네요',
    url: null,
    embed: { kind: 'none', domain: null },
  })
})

test('rejects empty and overlong post content', () => {
  const { normalizePostInput } = loadPostsModule()

  assert.deepEqual(normalizePostInput({ type: 'free', content: '   ', url: '' }), {
    error: '내용을 입력해주세요.',
  })
  assert.deepEqual(normalizePostInput({ type: 'free', content: 'a'.repeat(301), url: '' }), {
    error: '게시글은 300자 이하로 입력해주세요.',
  })
})

test('requires official posts to include a url', () => {
  const { normalizePostInput } = loadPostsModule()

  assert.deepEqual(normalizePostInput({ type: 'official', content: '공식 발표입니다', url: '' }), {
    error: '오피셜 소식은 출처 URL이 필요합니다.',
  })
})

test('normalizes urls and detects embed kinds', () => {
  const { normalizePostInput } = loadPostsModule()

  assert.deepEqual(normalizePostInput({
    type: 'info',
    content: '영상 참고',
    url: 'youtube.com/watch?v=abc123',
  }), {
    type: 'info',
    content: '영상 참고',
    url: 'https://youtube.com/watch?v=abc123',
    embed: { kind: 'youtube', domain: 'youtube.com', youtubeId: 'abc123' },
  })

  assert.deepEqual(normalizePostInput({
    type: 'info',
    content: 'X 참고',
    url: 'https://x.com/NUFC/status/123',
  }), {
    type: 'info',
    content: 'X 참고',
    url: 'https://x.com/NUFC/status/123',
    embed: { kind: 'x', domain: 'x.com' },
  })
})

test('decides reaction toggle operations', () => {
  const { getReactionToggleOperation } = loadPostsModule()

  assert.deepEqual(getReactionToggleOperation(null, 'curious'), { action: 'create', reactionType: 'curious' })
  assert.deepEqual(getReactionToggleOperation('sad', 'curious'), { action: 'update', reactionType: 'curious' })
  assert.deepEqual(getReactionToggleOperation('curious', 'curious'), { action: 'delete' })
})
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
cd app
node --test src/lib/posts.test.mjs
```

Expected: FAIL because `app/src/lib/posts.ts` does not exist.

- [ ] **Step 3: 구현 작성**

Create `app/src/lib/posts.ts`:

```ts
import type { PostEmbedKind, PostReactionType, PostType } from '@/types/database'

export const POST_MAX_LENGTH = 300

const POST_TYPES = ['free', 'info', 'official'] as const
export const POST_REACTIONS: Array<{ type: PostReactionType; emoji: string; label: string }> = [
  { type: 'expecting', emoji: '🙌', label: '기대' },
  { type: 'shocked', emoji: '😳', label: '충격' },
  { type: 'angry', emoji: '😡', label: '분노' },
  { type: 'sad', emoji: '😢', label: '아쉬움' },
  { type: 'curious', emoji: '🤔', label: '의문' },
]

type NormalizedPost = {
  type: PostType
  content: string
  url: string | null
  embed: {
    kind: PostEmbedKind
    domain: string | null
    youtubeId?: string
  }
}

type PostInputResult = NormalizedPost | { error: string }

export function isPostType(value: string): value is PostType {
  return (POST_TYPES as readonly string[]).includes(value)
}

export function isReactionType(value: string): value is PostReactionType {
  return POST_REACTIONS.some(reaction => reaction.type === value)
}

export function normalizeUrl(input: string): URL | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
}

export function getEmbedKind(url: URL | null): NormalizedPost['embed'] {
  if (!url) return { kind: 'none', domain: null }
  const host = url.hostname.replace(/^www\./, '').toLowerCase()
  if (host === 'x.com' || host === 'twitter.com') return { kind: 'x', domain: host }
  if (host === 'youtu.be') {
    const youtubeId = url.pathname.split('/').filter(Boolean)[0]
    return youtubeId ? { kind: 'youtube', domain: host, youtubeId } : { kind: 'link', domain: host }
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const youtubeId = url.searchParams.get('v') ?? (url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : null)
    return youtubeId ? { kind: 'youtube', domain: host, youtubeId } : { kind: 'link', domain: host }
  }
  return { kind: 'link', domain: host }
}

export function normalizePostInput(input: { type: string; content: string; url: string }): PostInputResult {
  if (!isPostType(input.type)) return { error: '게시글 유형을 선택해주세요.' }
  const content = input.content.trim()
  if (!content) return { error: '내용을 입력해주세요.' }
  if (content.length > POST_MAX_LENGTH) return { error: '게시글은 300자 이하로 입력해주세요.' }

  const url = normalizeUrl(input.url)
  if (input.url.trim() && !url) return { error: '올바른 URL을 입력해주세요.' }
  if (input.type === 'official' && !url) return { error: '오피셜 소식은 출처 URL이 필요합니다.' }

  const embed = getEmbedKind(url)
  return {
    type: input.type,
    content,
    url: url?.toString() ?? null,
    embed,
  }
}

export function getReactionToggleOperation(
  currentReaction: PostReactionType | null,
  nextReaction: PostReactionType,
): { action: 'create' | 'update'; reactionType: PostReactionType } | { action: 'delete' } {
  if (!currentReaction) return { action: 'create', reactionType: nextReaction }
  if (currentReaction === nextReaction) return { action: 'delete' }
  return { action: 'update', reactionType: nextReaction }
}
```

- [ ] **Step 4: 테스트 스크립트 추가**

Modify `app/package.json` scripts:

```json
"test:posts": "node --test src/lib/posts.test.mjs"
```

- [ ] **Step 5: 테스트 통과 확인**

Run:

```bash
cd app
npm run test:posts
```

Expected: PASS for all tests in `posts.test.mjs`.

- [ ] **Step 6: 커밋**

```bash
git add app/package.json app/src/lib/posts.ts app/src/lib/posts.test.mjs
git commit -m "feat: add short post domain logic"
```

---

### Task 3: 게시글 조회와 목 데이터

**Files:**
- Create: `app/src/lib/queries/posts.ts`
- Modify: `app/src/lib/mock/data.ts`
- Modify: `app/src/lib/mock/queries.ts`

- [ ] **Step 1: 목 데이터 타입과 샘플 추가**

Modify `app/src/lib/mock/data.ts` imports:

```ts
import type { PostListItem } from '@/lib/queries/posts'
```

Add near the bottom:

```ts
export const MOCK_POSTS: PostListItem[] = [
  {
    id: 'post-1',
    type: 'official',
    content: '뉴캐슬 공식 계정에 프리시즌 일정 안내가 올라왔습니다.',
    url: 'https://x.com/NUFC/status/123',
    embed_kind: 'x',
    embed_title: 'NUFC official update',
    embed_domain: 'x.com',
    created_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    user: { display_name: 'Toon Army', avatar_url: null },
    is_mine: false,
    my_reaction: null,
    reaction_counts: { expecting: 7, shocked: 1, angry: 0, sad: 0, curious: 2 },
  },
  {
    id: 'post-2',
    type: 'info',
    content: '관련 분석 영상인데 전술 변화 설명이 꽤 좋네요.',
    url: 'https://youtu.be/dQw4w9WgXcQ',
    embed_kind: 'youtube',
    embed_title: 'Newcastle tactical analysis',
    embed_domain: 'youtu.be',
    created_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    user: { display_name: 'Geordie Notes', avatar_url: null },
    is_mine: true,
    my_reaction: 'curious',
    reaction_counts: { expecting: 2, shocked: 0, angry: 0, sad: 1, curious: 5 },
  },
]
```

- [ ] **Step 2: 목 쿼리 추가**

Modify `app/src/lib/mock/queries.ts` imports:

```ts
import type { PostListItem } from '@/lib/queries/posts'
```

Import data:

```ts
  MOCK_POSTS,
```

Add:

```ts
export async function mockGetPostList(): Promise<PostListItem[]> {
  return MOCK_POSTS
}
```

- [ ] **Step 3: 실제 쿼리 구현**

Create `app/src/lib/queries/posts.ts`:

```ts
import { createClient, createPublicClient } from '@/lib/supabase/server'
import { IS_MOCK } from '@/lib/config'
import type { PostEmbedKind, PostReactionType, PostType } from '@/types/database'
import { mockGetPostList } from '@/lib/mock/queries'

export type ReactionCountMap = Record<PostReactionType, number>

export type PostListItem = {
  id: string
  type: PostType
  content: string
  url: string | null
  embed_kind: PostEmbedKind
  embed_title: string | null
  embed_domain: string | null
  created_at: string
  updated_at: string
  user: { display_name: string | null; avatar_url: string | null }
  is_mine: boolean
  my_reaction: PostReactionType | null
  reaction_counts: ReactionCountMap
}

type AnyRow = any

const EMPTY_COUNTS: ReactionCountMap = {
  expecting: 0,
  shocked: 0,
  angry: 0,
  sad: 0,
  curious: 0,
}

export async function getPostList(userId: string | null): Promise<PostListItem[]> {
  if (IS_MOCK) return mockGetPostList()

  const supabase = userId ? await createClient() : createPublicClient()

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, user_id, type, content, url, embed_kind, embed_title, embed_domain, created_at, updated_at,
      user:public_profiles!posts_public_profiles_user_id_fkey(display_name, avatar_url),
      reactions:post_reactions(user_id, reaction_type)
    `)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .limit(50) as { data: AnyRow[] | null; error: AnyRow }

  if (error || !data) {
    console.error('getPostList error:', error)
    return []
  }

  return data.map(row => {
    const reactionCounts = { ...EMPTY_COUNTS }
    let myReaction: PostReactionType | null = null

    for (const reaction of row.reactions ?? []) {
      const type = reaction.reaction_type as PostReactionType
      reactionCounts[type] = (reactionCounts[type] ?? 0) + 1
      if (userId && reaction.user_id === userId) myReaction = type
    }

    return {
      id: row.id as string,
      type: row.type as PostType,
      content: row.content as string,
      url: row.url as string | null,
      embed_kind: row.embed_kind as PostEmbedKind,
      embed_title: row.embed_title as string | null,
      embed_domain: row.embed_domain as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      user: {
        display_name: row.user?.display_name ?? null,
        avatar_url: row.user?.avatar_url ?? null,
      },
      is_mine: userId === row.user_id,
      my_reaction: myReaction,
      reaction_counts: reactionCounts,
    }
  })
}
```

- [ ] **Step 4: 빌드 확인**

Run:

```bash
cd app
npm run build
```

Expected: PASS. The migration defines `posts_public_profiles_user_id_fkey`, so the query relation name in Step 3 should resolve after Supabase sees the new schema.

- [ ] **Step 5: 커밋**

```bash
git add app/src/lib/queries/posts.ts app/src/lib/mock/data.ts app/src/lib/mock/queries.ts
git commit -m "feat: add short post queries"
```

---

### Task 4: 게시글 Server Actions

**Files:**
- Create: `app/src/lib/actions/posts.ts`

- [ ] **Step 1: Server Action 구현**

Create `app/src/lib/actions/posts.ts`:

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { IS_MOCK } from '@/lib/config'
import { getReactionToggleOperation, isReactionType, normalizePostInput } from '@/lib/posts'
import type { PostReactionType } from '@/types/database'

type ActionResult = { success: true } | { error: string }

async function getCurrentUserId(): Promise<string | null> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function createPost(input: { type: string; content: string; url: string }): Promise<ActionResult> {
  const normalized = normalizePostInput(input)
  if ('error' in normalized) return { error: normalized.error }

  if (IS_MOCK) {
    revalidatePath('/posts')
    return { success: true }
  }

  const userId = await getCurrentUserId()
  if (!userId) return { error: '로그인이 필요합니다.' }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      type: normalized.type,
      content: normalized.content,
      url: normalized.url,
      embed_kind: normalized.embed.kind,
      embed_title: normalized.embed.domain,
      embed_domain: normalized.embed.domain,
    })

  if (error) {
    console.error('createPost error:', error)
    return { error: '게시글 저장에 실패했어요. 다시 시도해주세요.' }
  }

  revalidatePath('/posts')
  return { success: true }
}

export async function updatePost(postId: string, input: { type: string; content: string; url: string }): Promise<ActionResult> {
  const normalized = normalizePostInput(input)
  if ('error' in normalized) return { error: normalized.error }

  if (IS_MOCK) {
    revalidatePath('/posts')
    return { success: true }
  }

  const userId = await getCurrentUserId()
  if (!userId) return { error: '로그인이 필요합니다.' }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase
    .from('posts')
    .update({
      type: normalized.type,
      content: normalized.content,
      url: normalized.url,
      embed_kind: normalized.embed.kind,
      embed_title: normalized.embed.domain,
      embed_domain: normalized.embed.domain,
    })
    .eq('id', postId)
    .eq('user_id', userId)

  if (error) {
    console.error('updatePost error:', error)
    return { error: '게시글 수정에 실패했어요. 다시 시도해주세요.' }
  }

  revalidatePath('/posts')
  return { success: true }
}

export async function deletePost(postId: string): Promise<ActionResult> {
  if (IS_MOCK) {
    revalidatePath('/posts')
    return { success: true }
  }

  const userId = await getCurrentUserId()
  if (!userId) return { error: '로그인이 필요합니다.' }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('user_id', userId)

  if (error) {
    console.error('deletePost error:', error)
    return { error: '게시글 삭제에 실패했어요. 다시 시도해주세요.' }
  }

  revalidatePath('/posts')
  return { success: true }
}

export async function togglePostReaction(
  postId: string,
  currentReaction: PostReactionType | null,
  nextReaction: string,
): Promise<ActionResult> {
  if (!isReactionType(nextReaction)) return { error: '알 수 없는 반응입니다.' }

  if (IS_MOCK) return { success: true }

  const userId = await getCurrentUserId()
  if (!userId) return { error: '로그인이 필요합니다.' }

  const operation = getReactionToggleOperation(currentReaction, nextReaction)
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  if (operation.action === 'delete') {
    const { error } = await supabase
      .from('post_reactions')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)
    if (error) return { error: '반응 취소에 실패했어요.' }
    return { success: true }
  }

  const { error } = await supabase
    .from('post_reactions')
    .upsert({
      post_id: postId,
      user_id: userId,
      reaction_type: operation.reactionType,
    }, { onConflict: 'post_id,user_id' })

  if (error) return { error: '반응 저장에 실패했어요.' }
  return { success: true }
}
```

- [ ] **Step 2: 빌드 확인**

Run:

```bash
cd app
npm run build
```

Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add app/src/lib/actions/posts.ts
git commit -m "feat: add short post actions"
```

---

### Task 5: 피드 UI와 카드 내 반응

**Files:**
- Create: `app/src/components/posts/PostComposer.tsx`
- Create: `app/src/components/posts/PostEmbedCard.tsx`
- Create: `app/src/components/posts/PostReactionRow.tsx`
- Create: `app/src/components/posts/PostCard.tsx`
- Create: `app/src/components/posts/PostFeedClient.tsx`
- Create: `app/src/app/posts/page.tsx`

**Approved layout contract:**
- The `/posts` screen starts with filter tabs (`전체`, `자유`, `정보`, `오피셜`) and a sort control (`최신순`, `반응순`), not a descriptive headline.
- The composer is not inline in the feed. A bottom-right floating action button opens a bottom sheet.
- The bottom sheet has the `게시` button in the top-right action slot. It does not show an `X` close button.
- The `게시` button is enabled only when trimmed content is at least 15 characters.
- The URL input placeholder changes by post type: `free` and `info` say X/YouTube links will embed; `official` asks for a club official source URL.
- Post cards show author nickname and time first. The post-type chip appears inline at the start of the body text, like `[오피셜] 뉴캐슬 공식 계정에...`.
- Use `output/short-news-posts-layout.html` as the visual reference for spacing, order, and interaction states.

- [ ] **Step 1: 작성 폼 구현**

Create `app/src/components/posts/PostComposer.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Send, X } from 'lucide-react'
import { createPost, updatePost } from '@/lib/actions/posts'
import { getEmbedKind, normalizeUrl, POST_MAX_LENGTH } from '@/lib/posts'
import type { PostListItem } from '@/lib/queries/posts'
import type { PostType } from '@/types/database'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { Button } from '@/components/ui/button'

const POST_TYPES: Array<{ id: PostType; label: string }> = [
  { id: 'free', label: '자유' },
  { id: 'info', label: '정보' },
  { id: 'official', label: '오피셜' },
]

export function PostComposer({
  editingPost,
  onSaved,
  onCancel,
}: {
  editingPost?: PostListItem | null
  onSaved: () => void
  onCancel?: () => void
}) {
  const [type, setType] = useState<PostType>(editingPost?.type ?? 'free')
  const [content, setContent] = useState(editingPost?.content ?? '')
  const [url, setUrl] = useState(editingPost?.url ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  function submit() {
    setError(null)
    const payload = { type, content, url }
    start(async () => {
      const result = editingPost
        ? await updatePost(editingPost.id, payload)
        : await createPost(payload)
      if ('error' in result) {
        setError(result.error)
        return
      }
      if (!editingPost) {
        const embedKind = getEmbedKind(normalizeUrl(url)).kind
        trackEvent('post_published', {
          source_page: 'posts',
          post_type: type,
          embed_kind: embedKind,
          has_url: Boolean(url.trim()),
        })
        setContent('')
        setUrl('')
        setType('free')
      }
      onSaved()
    })
  }

  return (
    <div className="border-b border-border bg-surface px-4 py-4">
      <div className="mb-3 inline-flex rounded-lg border border-border bg-background p-1">
        {POST_TYPES.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setType(item.id)}
            className={`h-8 rounded-md px-3 text-[12px] font-bold transition-colors ${type === item.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <textarea
        value={content}
        onChange={event => setContent(event.target.value.slice(0, POST_MAX_LENGTH))}
        rows={3}
        placeholder={type === 'official' ? '공식 계정, 구단 발표, 선수 채널 등 공식 출처의 내용만 URL과 함께 공유해주세요.' : '짧은 소식이나 생각을 남겨주세요.'}
        className="w-full resize-none rounded-sm border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      <div className="mt-1 text-right text-[11px] text-muted-foreground">{content.length} / {POST_MAX_LENGTH}</div>
      <input
        value={url}
        onChange={event => setUrl(event.target.value)}
        placeholder={type === 'official' ? '오피셜 출처 URL 필수' : 'URL 선택 입력'}
        className="mt-2 h-10 w-full rounded-sm border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
      {type === 'official' && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
          오피셜은 공식 계정, 구단 발표, 선수 채널, 신뢰 가능한 공식 출처의 내용만 공유해주세요.
        </p>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-negative">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        {editingPost && onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
            <X className="h-4 w-4" />
            취소
          </Button>
        )}
        <Button type="button" size="sm" onClick={submit} disabled={!content.trim() || isPending}>
          <Send className="h-4 w-4" />
          {editingPost ? '수정' : '게시'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 임베드 카드 구현**

Create `app/src/components/posts/PostEmbedCard.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ExternalLink, Play } from 'lucide-react'
import type { PostListItem } from '@/lib/queries/posts'
import { trackEvent } from '@/lib/analytics/mixpanel'

declare global {
  interface Window {
    twttr?: { widgets?: { load: () => void } }
  }
}

function getYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] ?? null
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      return parsed.searchParams.get('v') ?? (parsed.pathname.startsWith('/shorts/') ? parsed.pathname.split('/')[2] : null)
    }
    return null
  } catch {
    return null
  }
}

export function PostEmbedCard({ post }: { post: PostListItem }) {
  const [playing, setPlaying] = useState(false)
  if (!post.url) return null

  const title = post.embed_title ?? post.url
  const domain = post.embed_domain ?? new URL(post.url).hostname

  function trackClick() {
    trackEvent('post_embed_clicked', {
      source_page: 'posts',
      post_type: post.type,
      embed_kind: post.embed_kind,
      source_domain: domain,
    })
  }

  if (post.embed_kind === 'youtube') {
    const videoId = getYouTubeId(post.url)
    if (videoId && playing) {
      return (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={title}
          className="mt-3 aspect-video w-full rounded-md border border-border"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      )
    }
    if (videoId) {
      return (
        <button
          type="button"
          onClick={() => {
            trackClick()
            setPlaying(true)
          }}
          className="mt-3 block w-full overflow-hidden rounded-md border border-border bg-background text-left"
        >
          <div className="relative aspect-video bg-disabled">
            <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
              <Play className="h-10 w-10 fill-white" />
            </span>
          </div>
          <div className="px-3 py-2">
            <p className="line-clamp-1 text-sm font-bold text-foreground">{title}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{domain}</p>
          </div>
        </button>
      )
    }
  }

  if (post.embed_kind === 'x') {
    return (
      <div className="mt-3 rounded-md border border-border bg-background px-3 py-3">
        <a href={post.url} target="_blank" rel="noreferrer" onClick={trackClick} className="mb-2 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
          X 게시글 열기
          <ExternalLink className="h-3 w-3" />
        </a>
        <blockquote className="twitter-tweet" data-dnt="true">
          <a href={post.url}>{title}</a>
        </blockquote>
      </div>
    )
  }

  return (
    <a href={post.url} target="_blank" rel="noreferrer" onClick={trackClick} className="mt-3 block rounded-md border border-border bg-background px-3 py-3">
      <p className="line-clamp-2 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        {domain}
        <ExternalLink className="h-3 w-3" />
      </p>
    </a>
  )
}
```

- [ ] **Step 3: 반응 행 구현**

Create `app/src/components/posts/PostReactionRow.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { POST_REACTIONS } from '@/lib/posts'
import { togglePostReaction } from '@/lib/actions/posts'
import type { PostListItem, ReactionCountMap } from '@/lib/queries/posts'
import type { PostReactionType } from '@/types/database'
import { trackEvent } from '@/lib/analytics/mixpanel'

export function PostReactionRow({ post }: { post: PostListItem }) {
  const [myReaction, setMyReaction] = useState<PostReactionType | null>(post.my_reaction)
  const [counts, setCounts] = useState<ReactionCountMap>(post.reaction_counts)
  const [isPending, start] = useTransition()

  function choose(next: PostReactionType) {
    const previous = myReaction
    const removing = previous === next

    setMyReaction(removing ? null : next)
    setCounts(current => ({
      ...current,
      ...(previous ? { [previous]: Math.max(0, current[previous] - 1) } : {}),
      ...(!removing ? { [next]: current[next] + 1 } : {}),
    }))

    if (!removing) {
      trackEvent('post_reacted', {
        source_page: 'posts',
        post_type: post.type,
        embed_kind: post.embed_kind,
        reaction_type: next,
        changed_existing_reaction: Boolean(previous),
      })
    }

    start(async () => {
      await togglePostReaction(post.id, previous, next)
    })
  }

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {POST_REACTIONS.map(reaction => {
        const selected = myReaction === reaction.type
        return (
          <button
            key={reaction.type}
            type="button"
            disabled={isPending}
            onClick={() => choose(reaction.type)}
            className={`h-8 rounded-full border px-2 text-[12px] font-bold transition-colors ${selected ? 'border-primary bg-primary-dim text-primary-dark' : 'border-border bg-background text-muted-foreground hover:text-foreground'}`}
            aria-label={reaction.label}
          >
            <span>{reaction.emoji}</span>
            <span className="ml-1">{counts[reaction.type]}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: 카드와 피드 구현**

Create `app/src/components/posts/PostCard.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { deletePost } from '@/lib/actions/posts'
import type { PostListItem } from '@/lib/queries/posts'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { PostComposer } from './PostComposer'
import { PostEmbedCard } from './PostEmbedCard'
import { PostReactionRow } from './PostReactionRow'

const TYPE_LABEL = { free: '자유', info: '정보', official: '오피셜' }

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  return `${d}일 전`
}

export function PostCard({ post, onChanged }: { post: PostListItem; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [isPending, start] = useTransition()
  const name = post.user.display_name ?? '익명'
  const initial = name[0]?.toUpperCase() ?? '?'
  const edited = post.updated_at !== post.created_at

  function remove() {
    if (!window.confirm('게시글을 삭제할까요?')) return
    start(async () => {
      const result = await deletePost(post.id)
      if ('success' in result) onChanged()
    })
  }

  if (editing) {
    return (
      <PostComposer
        editingPost={post}
        onSaved={() => {
          setEditing(false)
          onChanged()
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <article className="border-b border-border bg-surface px-4 py-4">
      <div className="flex gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-secondary text-xs font-bold text-secondary-foreground">{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-bold text-foreground">{name}</span>
                <Badge variant={post.type === 'official' ? 'default' : 'secondary'} className="text-[10px] font-bold">
                  {TYPE_LABEL[post.type]}
                </Badge>
                <span className="text-[10px] text-muted-foreground">{formatRelative(post.created_at)}</span>
                {edited && <span className="text-[10px] text-muted-foreground">수정됨</span>}
              </div>
            </div>
            {post.is_mine && (
              <div className="flex flex-shrink-0 gap-2 text-[11px] font-semibold text-muted-foreground">
                <button type="button" onClick={() => setEditing(true)} className="hover:text-foreground">수정</button>
                <button type="button" onClick={remove} disabled={isPending} className="hover:text-negative">삭제</button>
              </div>
            )}
          </div>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{post.content}</p>
          <PostEmbedCard post={post} />
          <PostReactionRow post={post} />
        </div>
      </div>
    </article>
  )
}
```

Create `app/src/components/posts/PostFeedClient.tsx`:

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PostListItem } from '@/lib/queries/posts'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { PostCard } from './PostCard'
import { PostComposer } from './PostComposer'

export function PostFeedClient({ initialPosts, isLoggedIn }: { initialPosts: PostListItem[]; isLoggedIn: boolean }) {
  const [posts] = useState(initialPosts)
  const [isPending, start] = useTransition()
  const router = useRouter()

  useEffect(() => {
    trackEvent('post_feed_viewed', {
      source_page: 'posts',
      post_count: initialPosts.length,
    })
  }, [initialPosts.length])

  function refresh() {
    start(() => router.refresh())
  }

  return (
    <div className="px-4 pt-4 pb-24 animate-enter">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-[20px] font-black text-foreground tracking-tight">소식</h1>
        {isPending && <span className="text-[11px] font-semibold text-muted-foreground">업데이트 중</span>}
      </div>
      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-g200">
        {isLoggedIn ? (
          <PostComposer onSaved={refresh} />
        ) : (
          <div className="border-b border-border px-4 py-5 text-sm font-semibold text-muted-foreground">
            로그인하면 소식을 남기고 반응할 수 있어요.
          </div>
        )}
        {posts.length === 0 ? (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">아직 소식이 없습니다</div>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} onChanged={refresh} />)
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `/posts` 페이지 구현**

Create `app/src/app/posts/page.tsx`:

```tsx
import { cookies } from 'next/headers'
import { AppHeader } from '@/components/layout/AppHeader'
import { PostFeedClient } from '@/components/posts/PostFeedClient'
import { IS_MOCK } from '@/lib/config'
import { getPostList } from '@/lib/queries/posts'

export const revalidate = 30

export default async function PostsPage() {
  let userId: string | null = null
  let isLoggedIn = false

  if (IS_MOCK) {
    const cookieStore = await cookies()
    isLoggedIn = cookieStore.get('mock-auth')?.value === 'true'
    userId = isLoggedIn ? 'mock-user' : null
  } else {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id ?? null
    isLoggedIn = Boolean(user)
  }

  const posts = await getPostList(userId)

  return (
    <>
      <AppHeader />
      <main>
        <PostFeedClient initialPosts={posts} isLoggedIn={isLoggedIn} />
      </main>
    </>
  )
}
```

- [ ] **Step 6: 빌드 확인**

Run:

```bash
cd app
npm run build
```

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add app/src/components/posts app/src/app/posts/page.tsx
git commit -m "feat: add short post feed ui"
```

---

### Task 6: 내비게이션과 Mixpanel 연결

**Files:**
- Modify: `app/src/components/layout/BottomNav.tsx`
- Modify: `app/src/lib/analytics/mixpanel.ts`
- Modify: `app/src/components/posts/PostComposer.tsx`
- Modify: `app/src/components/posts/PostEmbedCard.tsx`

- [ ] **Step 1: 하단 내비게이션에 소식 추가**

Modify `app/src/components/layout/BottomNav.tsx` imports:

```ts
import { Home, Newspaper, Shield, Vote } from 'lucide-react'
```

Replace `ITEMS`:

```ts
const ITEMS = [
  { href: '/',       label: '홈',        Icon: Home },
  { href: '/polls',  label: '투표',      Icon: Vote },
  { href: '/posts',  label: '소식',      Icon: Newspaper },
  { href: '/club',   label: '구단 정보', Icon: Shield },
] as const
```

Replace the visibility guard:

```ts
if (pathname !== '/' && pathname !== '/polls' && pathname !== '/posts' && pathname !== '/club') return null
```

- [ ] **Step 2: source_page 확장**

Modify `app/src/lib/analytics/mixpanel.ts`:

```ts
export function getSourcePage(pathname: string): string {
  if (pathname === '/') return 'home'
  if (pathname === '/polls') return 'polls'
  if (pathname.startsWith('/polls/create')) return 'create'
  if (pathname.startsWith('/polls/')) return 'poll_detail'
  if (pathname.startsWith('/posts')) return 'posts'
  if (pathname.startsWith('/my')) return 'my'
  return 'direct'
}
```

- [ ] **Step 3: 작성 시작 이벤트 추가**

Modify `PostComposer` so first focus on the composer sends `post_create_clicked` once for new posts:

```tsx
const [trackedStart, setTrackedStart] = useState(false)

function trackStart() {
  if (editingPost || trackedStart) return
  setTrackedStart(true)
  const embedKind = getEmbedKind(normalizeUrl(url)).kind
  trackEvent('post_create_clicked', {
    source_page: 'posts',
    post_type: type,
    embed_kind: embedKind,
    has_url: Boolean(url.trim()),
  })
}
```

Add `onFocus={trackStart}` to the textarea and URL input.

Add this X widget loader to `PostEmbedCard` so X blockquotes render through the official widget path:

```tsx
useEffect(() => {
  if (post.embed_kind !== 'x') return
  if (window.twttr?.widgets) {
    window.twttr.widgets.load()
    return
  }
  const script = document.createElement('script')
  script.src = 'https://platform.twitter.com/widgets.js'
  script.async = true
  script.charset = 'utf-8'
  document.body.appendChild(script)
}, [post.embed_kind])
```

Also update the `PostEmbedCard` import:

```tsx
import { useEffect, useState } from 'react'
```

- [ ] **Step 4: 빌드 확인**

Run:

```bash
cd app
npm run build
```

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add app/src/components/layout/BottomNav.tsx app/src/lib/analytics/mixpanel.ts app/src/components/posts/PostComposer.tsx
git commit -m "feat: track and navigate short posts"
```

---

### Task 7: 최종 검증

**Files:**
- Verify only.

- [ ] **Step 1: 순수 테스트 실행**

Run:

```bash
cd app
npm run test:posts
```

Expected: PASS.

- [ ] **Step 2: 기존 관련 테스트 실행**

Run:

```bash
cd app
npm run test:feedback
npm run test:vote-eligibility
```

Expected: PASS. These cover the existing pure helper style and auth-sensitive behavior nearby.

- [ ] **Step 3: 빌드 실행**

Run:

```bash
cd app
npm run build
```

Expected: PASS.

- [ ] **Step 4: 로컬 UI 확인**

Run:

```bash
cd app
npm run dev
```

Open `http://localhost:3000/posts` and verify:

- 로그아웃 상태에서 피드가 보이고 작성 안내가 보인다.
- 로그인 목 쿠키가 있는 경우 작성 폼이 보인다.
- `free`, `info`, `official` 탭이 전환된다.
- `official`에서 안내 문구와 URL 필수 validation이 동작한다.
- 본문은 300자 이상 입력되지 않는다.
- 일반 링크 카드, X 링크 카드, YouTube 카드가 렌더링된다.
- YouTube 카드를 클릭하면 카드 안에서 iframe으로 바뀐다.
- 반응을 누르면 카운트와 선택 상태가 즉시 바뀐다.
- 본인 게시글에 수정/삭제 컨트롤이 보인다.

- [ ] **Step 5: 최종 상태 확인**

Run:

```bash
git status --short --branch
git log --oneline -5
```

Expected: working tree clean except intentional docs changes that were left uncommitted before implementation, and recent commits show the task commits above.

---

## 계획 자체 검토

- 스펙의 모든 핵심 요구사항은 Task 1-6에 연결된다: DB/RLS, 300자 제한, 세 유형, 오피셜 URL 필수, 작성자 수정/삭제, 반응 5종, X/YouTube/일반 링크, `/posts`, 하단 `소식`, Mixpanel 이벤트.
- 1차 제외 범위인 이미지 업로드, 신고, 댓글, 전체 수정 이력, 공식 출처 자동 검증은 구현 task에 포함하지 않았다.
- `post_edited`, `post_deleted`, `post_card_viewed`는 기존 Mixpanel 문서에서 deferred diagnostic event로만 남기고 1차 구현 이벤트에는 넣지 않는다.
- 마이그레이션은 `posts_public_profiles_user_id_fkey`를 명시하므로 게시글 작성자 조인은 `user:public_profiles!posts_public_profiles_user_id_fkey(display_name, avatar_url)`을 사용한다.
