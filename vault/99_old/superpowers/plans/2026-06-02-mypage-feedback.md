# Mypage Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a simple DB-backed feedback form to `/my`.

**Architecture:** A pure feedback helper validates and normalizes content, a server action inserts authenticated feedback rows into Supabase, `MyPageClient` links to a dedicated feedback page, and `MyFeedbackForm` renders the form and status states. Supabase receives a new insert-only `user_feedback` table protected by RLS.

**Tech Stack:** Next.js App Router, React client component, server actions, Supabase migrations/RLS, Node test runner.

---

### Task 1: Feedback Validation

**Files:**
- Create: `app/src/lib/feedback.ts`
- Create: `app/src/lib/feedback.test.mjs`
- Modify: `app/package.json`

- [ ] Write the failing test for empty, trimmed, valid, and too-long feedback.
- [ ] Run `npm run test:feedback` from `app` and confirm it fails because `normalizeFeedbackContent` does not exist.
- [ ] Implement `normalizeFeedbackContent(content: string)` with a 500-character limit.
- [ ] Add `test:feedback` to `app/package.json`.
- [ ] Run `npm run test:feedback` and confirm it passes.

### Task 2: Persistence

**Files:**
- Create: `supabase/migrations/20260602100000_add_user_feedback.sql`
- Modify: `app/src/types/database.ts`
- Create: `app/src/lib/actions/feedback.ts`

- [ ] Add `public.user_feedback` with `id`, `user_id`, `content`, `created_at`, and `updated_at`.
- [ ] Enable RLS and add an authenticated insert policy where `auth.uid() = user_id`.
- [ ] Add `user_feedback` to the local database type file.
- [ ] Add `submitFeedback(content)` server action that uses `normalizeFeedbackContent`, returns Korean error text, inserts the row, and treats mock mode as successful.

### Task 3: Mypage UI

**Files:**
- Modify: `app/src/components/my/MyPageClient.tsx`
- Create: `app/src/components/my/MyFeedbackForm.tsx`
- Create: `app/src/app/my/feedback/page.tsx`

- [ ] Add a feedback button in account settings that links to `/my/feedback`.
- [ ] Add `/my/feedback` with the same login guard as `/my`.
- [ ] Add feedback state, pending state, and submit handler in `MyFeedbackForm`.
- [ ] Disable submit while pending or when trimmed content is empty.
- [ ] Clear the textarea on success and show one inline status message.

### Task 4: Verification

**Files:**
- Verify changed files only.

- [ ] Run `npm run test:feedback` from `app`.
- [ ] Run the project lint/build command available locally.
- [ ] Start the dev server if needed and visually check `/my` renders the feedback form.
