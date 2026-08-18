# Poll Result Ranking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render standard poll results as vote-share-ranked filled rows, with a top-vote card only after a poll is closed.

**Architecture:** Extract result sorting and optional image selection into a pure helper under `src/lib/polls`, then consume it from `ResultView`. Keep data fetching unchanged and update only the standard result UI.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Node test runner.

---

### Task 1: Result Ranking Helper

**Files:**
- Create: `app/src/lib/polls/result-ranking.ts`
- Create: `app/src/lib/polls/result-ranking.test.mjs`

- [ ] **Step 1: Write failing tests for sorting and optional images**

Create `app/src/lib/polls/result-ranking.test.mjs` with tests that expect rows to sort by count descending, tie-break by original option order, mark `isMine`, use `option.image_url` before player `photo_url`, and return `null` for missing images.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test src/lib/polls/result-ranking.test.mjs`
Expected: FAIL because `result-ranking.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `app/src/lib/polls/result-ranking.ts` exporting `buildPollResultItems`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test src/lib/polls/result-ranking.test.mjs`
Expected: PASS.

### Task 2: ResultView UI

**Files:**
- Modify: `app/src/components/polls/ResultView.tsx`

- [ ] **Step 1: Import helper and derive sorted result items**

Use `buildPollResultItems` in place of direct `options.map` rendering for the result summary.

- [ ] **Step 2: Replace result card/list UI**

Render:
- active poll: total participants, `현재 순위`, filled ranking rows
- closed poll with votes: total participants, subdued `최다 득표` card, `최종 순위`, filled ranking rows
- zero votes: empty message and no top-vote card

- [ ] **Step 3: Preserve existing comments and player info**

Leave `CommentsSection`, player info card, analytics, cover, header, and existing props unchanged.

### Task 3: Verification

**Files:**
- Verify: `app/src/lib/polls/result-ranking.test.mjs`
- Verify: `app/src/components/polls/ResultView.tsx`

- [ ] **Step 1: Run focused helper test**

Run: `cd app && node --test src/lib/polls/result-ranking.test.mjs`
Expected: PASS.

- [ ] **Step 2: Run existing related poll tests**

Run: `cd app && node --test src/lib/polls/rating.test.mjs src/lib/polls/vote-eligibility.test.mjs`
Expected: PASS.

- [ ] **Step 3: Type-check/build if feasible**

Run: `cd app && npm run build`
Expected: build succeeds, unless environment variables required by the existing app block it.
