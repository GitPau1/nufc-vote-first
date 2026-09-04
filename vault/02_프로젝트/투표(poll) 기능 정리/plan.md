# 투표(poll) 기능 정리 — plan

**범위: TEA-25, TEA-26, TEA-27, TEA-29만.** TEA-28(코드 구조 정리)은 이번 plan에서 제외 — 이름 결정을 후속 이슈로 미룬다. 단, TEA-29 §5-1(fallback 제거)이 이 plan 안에서 실행되므로, feature-spec.md §4-1이 제안한 "fallback 공용 헬퍼"는 **더 이상 필요 없다** — TEA-28을 나중에 하더라도 그 항목은 자동 소멸.

이 문서는 `intent.md`의 "feature-spec 검토 후 확정(2026-09-04)" 표 9건 + `feature-spec.md`의 파일:줄 조사를 그대로 계승한다. **이 plan은 이 worktree(`refactor/poll-cleanup`, `origin/main` 311ae3f 기준, 코드 변경 없음 확인됨)에서 직접 파일을 다시 읽어 줄 번호를 검증했다.** 조사 중 feature-spec.md가 놓친 실제 파일 6개(`lib/actions/polls.ts`의 scheduled_at 3곳, `app/my/page.tsx`, `app/polls/[id]/edit/page.tsx`, `lib/actions/vote.ts`, `lib/mock/queries.ts`, storybook stories 4개의 `Scheduled` 스토리)를 새로 찾아 아래에 포함했다 — 이 발견은 grep 결과(현재 워크트리 실측)에 근거한다.

**사람이 plan.md를 승인하기 전까지 아래 어떤 단계도 구현에 들어가지 않는다.**

---

## 0. 사람이 직접 해야 하는 일 (모아보기)

| # | 언제 | 무엇을 |
|---|---|---|
| A | 지금 | 이 plan.md 전체 승인 (아래 "되돌리기 어려운 변경 3건" 문장을 다시 읽고 확인) |
| B | Step 2 (TEA-29 §5-1) | 프로덕션 `xrvz…` 프로젝트에서 §2의 SQL 실행, 4개 컬럼 존재 확인 |
| C | Step 4 착수 전 | 프로덕션에서 `select id, type from polls where type in (...)` 실행 결과를 백업으로 보관(타입 마이그레이션 롤백 근거) |
| D-1 | Step 1 완료 후 | PR #1(`refactor/poll-cleanup`, `Fixes TEA-25`) 리뷰 후 머지 |
| D-2 | Step 7 완료 후 | PR #2(같은 `refactor/poll-cleanup` 이어서, `Fixes TEA-26, TEA-27, TEA-29`) 리뷰 후 머지 |
| D | PR #2 머지 후 | `supabase db push`로 마이그레이션 2건 적용(§3) — 코드가 먼저 배포되어 더 이상 `scheduled_at`을 참조하지 않는 상태를 확인한 뒤 실행 |

---

## 1. 되돌리기 어려운 변경 3건 (intent.md 요구사항 — 그대로 재확인)

- `alter table polls drop column scheduled_at;`
- `update polls set type = 'poll' where type in ('subject_options','question_targets','free_choice','selection','evaluation');` — 실행 전 `select type, count(*) from polls group by type`로 13건 확인, 실행 후 `poll` 13 / `overall_rating` 2 확인.
- fallback 제거 전 프로덕션 `information_schema.columns` 1회 조회(아래 §2).

---

## 2. TEA-29 §5-1 — 사람이 실행할 확인 SQL (Step 2, human gate)

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'players' and column_name = 'squad_status') or
    (table_name = 'polls' and column_name = 'thumbnail_url') or
    (table_name = 'poll_options' and column_name in ('image_url', 'description'))
  );
```
4행이 나와야 한다(각 컬럼 1행씩). 이 결과가 4행 미만이면 **Step 3을 진행하지 않고 중단·보고**한다.

---

## 3. 마이그레이션 파일 2개 (내용 확정, 실행은 사람이 Step D에서)

### 3-1. `supabase/migrations/20260904140000_drop_polls_scheduled_at.sql`

```sql
-- TEA-25: 예정 투표(scheduled poll) 기능 제거 — scheduled_at 컬럼 삭제.
-- 사전 확인(사람이 실행): 아래 결과가 전부 0이어야 한다.
--   select count(*) from polls where scheduled_at is not null;
--   select count(*) from polls where status = 'scheduled';
alter table polls drop column scheduled_at;
```

**롤백**: `alter table polls add column scheduled_at timestamptz;` — 원래 값이 프로덕션 13건 전부 NULL이었으므로(intent.md 실측) 데이터 손실 없이 컬럼만 되살아난다.

### 3-2. `supabase/migrations/20260904150000_consolidate_poll_type_to_poll.sql`

```sql
-- TEA-26: PollType 통합 — overall_rating을 제외한 모든 poll을 단일 값 'poll'로 통합.
-- 실행 전 사람이 직접 백업(플랜.md 위 §0-C): 아래 결과를 어딘가에 보관한다. 롤백 시 이 매핑으로
-- poll별 원래 type을 개별 복원해야 한다(일괄 롤백 SQL이 없다 — 원래 값이 poll마다 다르므로).
--   select id, type from polls where type in ('subject_options','question_targets','free_choice','selection','evaluation') order by type, id;

update polls
set type = 'poll'
where type in ('subject_options', 'question_targets', 'free_choice', 'selection', 'evaluation');

-- 실행 후 확인: select type, count(*) from polls group by type order by type;
-- 기대값: poll 13 / overall_rating 2
```

**롤백**: 위 백업 select 결과(사람이 §0-C에서 보관한 것)를 근거로 `update polls set type = '<원래값>' where id = '<id>';`를 poll마다 개별 실행. 백업이 없으면 롤백 불가 — 그래서 §0-C가 필수 human gate다.

**실행 순서(Step D)**: 코드가 먼저 배포되어(scheduled_at 미참조 상태) 두 마이그레이션 중 어느 것을 먼저 적용해도 기능상 무관하다. 편의상 3-1 → 3-2 순서를 권장.

---

## 4. 실행 순서

```
Step 1 (developer) TEA-25 코드 전체 제거
   ↓
PR #1 생성(Fixes TEA-25) → 리뷰 → 머지 → 배포 확인
   ↓
Step 2 (사람)      TEA-29 §5-1 SQL 확인 (§2)
   ↓
Step 3 (developer) TEA-29 코드: fallback 제거 + setup_required 제거
   ↓
Step 4 (사람 §0-C  TEA-26a: 데이터 모델 통합 + 화면 분기(임시)
        먼저)      (developer)
   ↓
Step 4b (developer) TEA-26a: PollClient.tsx 병합
   ↓
Step 5 (developer) TEA-26b: 생성/수정 폼 재구성
   ↓
Step 6 (developer) TEA-27: 표지 반응형 + 설명 textarea
   ↓
Step 7 (developer) 문서 갱신
   ↓
PR #2 생성(같은 refactor/poll-cleanup 이어서, Fixes TEA-26, TEA-27, TEA-29) → 리뷰 → 머지 → 배포 확인
   ↓
Step D (사람)      마이그레이션 2건 supabase db push
```

같은 파일을 여러 단계가 건드리는 경우(`lib/queries/polls.ts`는 Step 1·3·5, `lib/actions/polls.ts`는 Step 1·5, `app/polls/[id]/page.tsx`는 Step 4·4b) 반드시 이 순서대로 순차 진행한다 — 병렬 금지. Step 1과 Step 3/4/4b/5/6 사이는 새 developer 에이전트로 넘긴다(orchestrator-rules 10.1, 같은 에이전트 이어쓰기 최대 2회 제한).

---

## Step 1 — TEA-25: 예정 투표(scheduled) 기능 완전 제거

**목적**: `PollStatus`에서 `'scheduled'`를 없애고 `scheduled_at` 필드를 앱 전 영역에서 제거한다(DB 컬럼 자체는 Step D에서 사람이 드롭).

### 1-1. `frontend/src/types/database.ts`

- 줄 4: `export type PollStatus = 'scheduled' | 'active' | 'closed'` → `export type PollStatus = 'active' | 'closed'`
- 줄 53-69 `polls.Row`: `scheduled_at: string | null` 필드(줄 63) 삭제. `Insert`/`Update`는 `Omit<Row,...>` 기반이라 자동 반영됨.

### 1-2. `frontend/src/lib/polls/status.ts` (전체 9→14줄 정도로 축소)

현재(1-19행) 전체를 아래로 교체:
```ts
import type { PollStatus } from '@/types/database'

export type PollStatusInput = {
  status: PollStatus
  closes_at: string
}

export function getEffectivePollStatus(poll: PollStatusInput, now = new Date()): PollStatus {
  if (new Date(poll.closes_at).getTime() <= now.getTime()) return 'closed'
  return poll.status
}
```
(`scheduled_at` 파라미터·scheduled→active 승격 분기 삭제. 호출부는 대부분 `poll` 전체 객체를 넘기므로 구조적 타이핑상 그대로 컴파일된다 — 호출부 시그니처 변경 불필요.)

### 1-3. `frontend/src/lib/polls/vote-eligibility.ts` (전체 교체)

```ts
import type { PollStatus } from '@/types/database'

export type VoteEligibilityPoll = {
  status: PollStatus
  closes_at: string
}

export function canSubmitVote(poll: VoteEligibilityPoll, now = new Date()): boolean {
  if (poll.status !== 'active') return false
  return new Date(poll.closes_at).getTime() > now.getTime()
}
```

### 1-4. `frontend/src/lib/polls/poll-edit-eligibility.ts`

- 줄 4-9 `PollEditPoll` 타입: `scheduled_at: string | null` 필드(줄 6) 삭제.
- 줄 19-24 `canAccessPollEdit`: 줄 21 `if (status === 'scheduled') return false` 삭제(도달 불가 상태).
- 줄 27-32 `getEditablePollFields`를 아래로 교체(2분기만 남으므로 삼항으로 단순화, 주석에서 'scheduled' 언급 제거):
```ts
/** 상태별 저장 가능 필드. */
export function getEditablePollFields(poll: PollEditPoll, now = new Date()): EditablePollField[] {
  const status = getEffectivePollStatus(poll, now)
  return status === 'active' ? ['title', 'description', 'thumbnail_url'] : ['thumbnail_url']
}
```

### 1-5. `frontend/src/lib/queries/polls.ts`

- 줄 19-35 `PollListItem`: `scheduled_at: string | null`(줄 27) 삭제.
- 줄 37-54 `PollDetail`: `scheduled_at?: string | null`(줄 45) 삭제.
- 줄 209-218 `POLL_LIST_SELECT`/`POLL_LIST_SELECT_FALLBACK`: 두 select 문자열에서 `scheduled_at,` 삭제.
- 줄 221-261 `mapPollRows`: `status: getEffectivePollStatus({ status: ..., scheduled_at: ..., closes_at: ... }, now)`(줄 243-247)를 `status: getEffectivePollStatus({ status: row.status as PollStatus, closes_at: row.closes_at as string }, now)`로, 줄 250 `scheduled_at: row.scheduled_at as string | null,` 필드 삭제.
- 줄 263-292 `getPollListUncached`: 로직 변경 없음(select 문자열만 위에서 이미 수정).
- 줄 298-302 `PollHomeSections` 타입: `scheduled: PollListItem[]` 필드 삭제 → `{ active: PollListItem[]; closed: PollListItem[] }`.
- 줄 311-339 `getPollHomeSectionsUncached`: 줄 334 `return { active: [], scheduled: [], closed: [] }` → `return { active: [], closed: [] }`.
- 줄 342-369 `bucketPollsByStatus`를 아래로 교체:
```ts
/** effective status 기준으로 진행중/종료로 나누고, 섹션별로 의미 있는 순서로 정렬·상한을 적용한다. */
function bucketPollsByStatus(polls: PollListItem[]): PollHomeSections {
  const active: PollListItem[] = []
  const closed: PollListItem[] = []

  for (const poll of polls) {
    if (poll.status === 'active') active.push(poll)
    else closed.push(poll)
  }

  // 진행중: 마감 임박한 것부터 — 지금 참여를 유도해야 하는 우선순위.
  active.sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime())
  // 종료: 최근에 끝난 것부터.
  closed.sort((a, b) => new Date(b.closes_at).getTime() - new Date(a.closes_at).getTime())

  return {
    active: active.slice(0, HOME_SECTION_ITEM_LIMIT),
    closed: closed.slice(0, HOME_SECTION_ITEM_LIMIT),
  }
}
```
- 줄 375-447 `getPollById`: raw select(줄 382, 394)에서 `scheduled_at,` 삭제. 줄 430-434 `getEffectivePollStatus({...})` 호출에서 `scheduled_at` 제거(위 mapPollRows와 동일 패턴). 줄 437 `scheduled_at: data.scheduled_at as string | null,` 필드 삭제.

### 1-6. `frontend/src/components/composition/common/HomeClient.tsx` (전체 48줄 파일)

- 줄 25: `const { active, scheduled, closed } = sections` → `const { active, closed } = sections`
- 줄 26: `hasPolls = active.length > 0 || scheduled.length > 0 || closed.length > 0` → `active.length > 0 || closed.length > 0`
- 줄 28: `const heroPoll = active[0] ?? scheduled[0] ?? closed[0] ?? null` → `const heroPoll = active[0] ?? closed[0] ?? null`
- 줄 37: `<PollHomeSection title="예정된 투표" polls={scheduled} />` 줄 통째로 삭제.

### 1-7. `frontend/src/components/composition/polls/PollListClient.tsx`

- 줄 15: `type PollTab = 'all' | 'active' | 'scheduled' | 'closed'` → `'all' | 'active' | 'closed'`
- 줄 67-73: `const scheduled = effectivePolls.filter(p => p.status === 'scheduled')`(줄 68) 삭제, `visiblePolls` 삼항(줄 70-73)에서 `: activeTab === 'scheduled' ? scheduled` 분기 삭제.
- 줄 76: `tabCounts = { activeCount, scheduledCount, closedCount }` → `{ activeCount, closedCount }`
- 줄 82: `<PollTabs activeTab={activeTab} activeCount={0} scheduledCount={0} closedCount={0} onChange={setActiveTab} />` → `scheduledCount={0}` 삭제.
- 줄 116-119 빈 상태 문구 삼항: `: activeTab === 'scheduled' ? '예정된 투표가 없습니다'` 분기 삭제.
- 줄 131-149 `PollTabs`: props에서 `scheduledCount` 제거, 줄 144-149 `tabs` 배열에서 `{ id: 'scheduled' as const, label: '예정', count: scheduledCount }` 항목 삭제.

### 1-8. `frontend/src/components/composition/polls/PollCard.tsx`

- 줄 9: `import { formatScheduled, formatDate } from '@/lib/utils'` → `import { formatDate } from '@/lib/utils'`
- 줄 35-37 `PollStatusSource` 타입: `scheduled_at?: string | null` 필드 삭제(status/closes_at만 남김).
- 줄 39-43 `getStatusLabel`: 줄 40 `if (poll.status === 'scheduled') return ...` 삭제.

### 1-9. `frontend/src/lib/utils.ts`

- 줄 46-52 `formatScheduled` 함수 전체 삭제(다른 호출부 없음 — 위 1-8에서 마지막 호출부 제거).

### 1-10. `frontend/src/lib/actions/polls.ts` (feature-spec.md에 누락됐던 실제 대상)

- 줄 19: `const type = (formData.get('type') as PollType) || 'subject_options'` — 이 줄은 Step 4(TEA-26a)에서 다시 손댄다. Step 1에서는 아래만.
- 줄 66-76 `createUserPoll`의 `serviceSupabase.from('polls').insert({...})`: 줄 74 `scheduled_at: null,` 삭제.
- 줄 105-111 `PollEditRow` 타입: `scheduled_at: string | null`(줄 107) 필드 삭제.
- 줄 133-137 `updateUserPoll`의 poll 조회 select: `'status, scheduled_at, closes_at, created_by, thumbnail_url'` → `'status, closes_at, created_by, thumbnail_url'`
- 줄 145-150 `editPoll` 구성: `scheduled_at: poll.scheduled_at,`(줄 147) 삭제.

### 1-11. `frontend/src/lib/actions/vote.ts`

- 줄 14-21 `VotePollRow` 타입: `scheduled_at: string | null`(줄 17) 삭제.
- 줄 45-49 poll 조회 select: `'type, status, scheduled_at, closes_at, created_by, created_at'` → `'type, status, closes_at, created_by, created_at'`

### 1-12. `frontend/src/lib/actions/ratings.ts`

- 줄 48-52 poll 조회 select: `'type, status, scheduled_at, closes_at'` → `'type, status, closes_at'`

### 1-13. `frontend/src/app/polls/[id]/page.tsx`

- 줄 47-50 `canAccessPollEdit(...)` 호출: `scheduled_at: poll.scheduled_at ?? null,`(줄 48 안) 삭제.

### 1-14. `frontend/src/app/polls/[id]/edit/page.tsx`

- 줄 41-46 `editPoll` 구성: `scheduled_at: poll.scheduled_at ?? null,`(줄 43) 삭제.

### 1-15. `frontend/src/app/my/page.tsx`

- 줄 10: `type PollStatusForMy = 'scheduled' | 'active' | 'closed'` → `'active' | 'closed'`
- 줄 70-78 votes select(줄 75 `poll:polls(id, title, status, scheduled_at, closes_at)`): `scheduled_at,` 삭제.
- 줄 80-85 `ParticipatedVoteRow`: `poll: JoinedOne<{ ...scheduled_at: string | null... }>`(줄 84)에서 `scheduled_at: string | null` 필드 삭제.

### 1-16. `frontend/src/lib/mock/queries.ts`

- 줄 36-56 `mockGetPollHomeSections`를 아래로 교체:
```ts
export async function mockGetPollHomeSections(): Promise<PollHomeSections> {
  const now = new Date()
  const polls = MOCK_POLL_LIST.map(poll => ({ ...poll, status: getEffectivePollStatus(poll, now) }))

  const active = polls.filter(p => p.status === 'active')
    .sort((a, b) => new Date(a.closes_at).getTime() - new Date(b.closes_at).getTime())
  const closed = polls.filter(p => p.status === 'closed')
    .sort((a, b) => new Date(b.closes_at).getTime() - new Date(a.closes_at).getTime())

  return {
    active: active.slice(0, HOME_SECTION_ITEM_LIMIT),
    closed: closed.slice(0, HOME_SECTION_ITEM_LIMIT),
  }
}
```
- 줄 80-85 `mockUpdatePoll`의 `editPoll` 구성: `scheduled_at: poll.scheduled_at ?? null,`(줄 82) 삭제.

### 1-17. `poll.scheduled_at`를 프로퍼티로 읽는 화면 2곳 (feature-spec.md 누락 — 방치하면 이 Step의 빌드가 실패한다)

- `frontend/src/components/composition/polls/TypeBPollClient.tsx:97`: `const pollDate = formatPollDate(poll.created_at ?? poll.scheduled_at ?? poll.closes_at)` → `formatPollDate(poll.created_at ?? poll.closes_at)`
- `frontend/src/components/composition/polls/ResultView.tsx:71`: 동일 패턴 → `formatPollDate(poll.created_at ?? poll.closes_at)`

(`TypeBPollClient.tsx`는 Step 4에서 통째로 삭제되지만, 그 전까지 `npm run build`가 통과해야 하므로 이 Step에서 고친다.)

### 1-18. `frontend/src/lib/mock/data.ts`

- **`poll-3` fixture 삭제** (원래 "공개 예정" 데모 — *사람 확인 필요 #10: 확정, 삭제*). `frontend/src` 전체에서 `poll-3` 문자열을 grep한 결과 아래 두 곳에만 등장한다 — 이 두 블록을 통째로 제거한다:
  - `MOCK_POLL_LIST`의 `poll-3` 항목(줄 109-121, `{ id: 'poll-3', ... },` 블록 전체).
  - `MOCK_POLL_DETAIL`의 `poll-3` 항목(줄 211-218, `'poll-3': { ... },` 블록 전체).
  - poll_options는 이 두 블록 안에서 `evalOptions('poll-3')` 호출로 인라인 생성되므로(별도 테이블 아님) 블록 삭제로 함께 없어진다. `MOCK_VOTE_COUNTS`(줄 261~)·`MOCK_RATING_RESULTS`(줄 340~)·`MOCK_COMMENTS`(줄 357~)·`MOCK_PARTICIPATED`(줄 417~)는 애초에 `poll-3` 키가 없다(grep 확인) — 추가로 지울 게 없다. `frontend/src/lib/mock/queries.ts`와 storybook 픽스처 4개 파일에도 `poll-3` 참조 없음(grep 확인).
- `MOCK_POLL_LIST`(줄 65-177)의 나머지 7개 항목에서 `scheduled_at: ...,` 줄 삭제(줄 72, 85, 102, 128, 141, 157, 170 — 원래 8곳 중 poll-3의 115행은 위 블록 삭제로 자동 해소된다). **poll-3 블록(13줄)을 먼저 지우면 뒤따르는 항목들의 실제 줄 번호가 당겨지므로, 구현 시점에 실제 파일을 다시 읽어 줄 번호를 재확인한다.**

### 1-19. Storybook 픽스처 4개 파일 — `scheduled_at` 필드 삭제 + `Scheduled` 스토리 삭제

| 파일 | 삭제할 것 |
|---|---|
| `frontend/src/storybook/contents/PollCard.stories.tsx` | 줄 15 `scheduled_at: null,` / 줄 63-67 `export const Scheduled: Story = {...}` 전체 / 줄 81 `<PollCard variant="vertical" poll={mockPoll({ status: 'scheduled', scheduled_at: ... })} />` 줄 |
| `frontend/src/storybook/contents/PollHeroCard.stories.tsx` | 줄 17 `scheduled_at: null,` / 줄 75-85 `export const Scheduled: Story = {...}` 전체(주석 포함) |
| `frontend/src/storybook/contents/PollCarouselCard.stories.tsx` | 줄 14 `scheduled_at: null,` |
| `frontend/src/storybook/contents/PollHomeSection.stories.tsx` | 줄 16 `scheduled_at: null,` |

(이 4개 파일은 `PollType`도 `'selection'`을 쓰고 있어 Step 4에서 다시 손댄다 — 지금은 `scheduled_at`만.)

### 영향받는 테스트 (재작성)

- `frontend/src/lib/polls/status.test.mjs` — 전체 파일 교체:
```js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sourcePath = path.join(__dirname, 'status.ts')

function loadStatusModule() {
  const source = fs.readFileSync(sourcePath, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: true },
  }).outputText
  const cjsModule = { exports: {} }
  const fn = new Function('exports', 'module', compiled)
  fn(cjsModule.exports, cjsModule)
  return cjsModule.exports
}

test('treats expired polls as closed for display', () => {
  const { getEffectivePollStatus } = loadStatusModule()
  const now = new Date('2026-06-01T10:00:00.000Z')
  assert.equal(getEffectivePollStatus({ status: 'active', closes_at: '2026-06-01T09:59:59.000Z' }, now), 'closed')
})

test('keeps active polls active before closing', () => {
  const { getEffectivePollStatus } = loadStatusModule()
  const now = new Date('2026-06-01T10:00:00.000Z')
  assert.equal(getEffectivePollStatus({ status: 'active', closes_at: '2026-06-01T11:00:00.000Z' }, now), 'active')
})
```
- `frontend/src/lib/polls/vote-eligibility.test.mjs` — 줄 38-65 `'blocks scheduled, closed, not-yet-open, and expired polls'` 테스트에서 `scheduled` 케이스(줄 42-46) 삭제, 남은 3종(closed/미래시작/마감지남) 유지하되 각 객체 리터럴에서 `scheduled_at` 필드 제거. 테스트명도 `'blocks closed and expired polls'`로 조정(미래시작 케이스는 애초에 `scheduled_at` 없이는 표현 불가하므로 이 케이스 자체도 삭제 — `canSubmitVote`가 더 이상 "아직 시작 안 함" 개념을 갖지 않는다).
- `frontend/src/lib/polls/poll-edit-eligibility.test.mjs` — 줄 70-81(`scheduled은 작성자·관리자도 false`), 줄 130-139(`getEditablePollFields: scheduled → 빈 배열`) 두 테스트 삭제. 나머지 테스트의 객체 리터럴에서 `scheduled_at: null,` 필드 제거(타입에서 없어졌으므로).
- `frontend/src/components/composition/polls/poll-list-client.test.mjs` — 줄 36: `assert.match(home, /const heroPoll = active\[0\] \?\? scheduled\[0\] \?\? closed\[0\] \?\? null/)` → `assert.match(home, /const heroPoll = active\[0\] \?\? closed\[0\] \?\? null/)`

### 검증

`cd frontend && npm test` (전체 — status/poll-edit-eligibility는 개별 script 없음, CLAUDE.md 확인). 통과 후 `npm run build`(타입 변경 규모가 크므로 이 단계에서 한 번 빌드 확인 권장 — Step 3/4/5/6 이후 최종 빌드는 별도로 또 돈다).

### 완료 기준

`npm test` 전량 통과, `npm run build` 통과, grep으로 `scheduled_at`/`'scheduled'` 리터럴이 애플리케이션 코드(`frontend/src`, mdx 제외)에 남아있지 않음 확인(`grep -rn "scheduled" frontend/src --include="*.ts" --include="*.tsx" --include="*.mjs"`가 0건).

---

## Step 2 — (사람) TEA-29 §5-1 SQL 확인

위 §2의 SQL을 프로덕션에서 실행하고 4행 확인. 결과를 오케스트레이터에게 보고.

---

## Step 3 — TEA-29: fallback 제거 + setup_required 제거

**선행 조건**: Step 2에서 4개 컬럼 존재 확인 완료.

### 3-1. `frontend/src/lib/queries/polls.ts` — fallback 4곳 제거

- 줄 132-138 `isMissingColumnError` 함수: 삭제(더 이상 호출하는 곳이 없어지면 사용).
- `getPollFormPlayers`(Step 1 이후 위치는 동일, 원래 170-205행): 줄 177-189의 1차 select + `if (error && isMissingColumnError(error)) {...}` fallback 블록(182-189)을 아래로 교체:
```ts
const { data, error } = await supabase
  .from('players')
  .select('id, name, position, squad_number, photo_url, is_active, squad_status')
  .order('squad_number', { ascending: true }) as { data: AnyRow[] | null; error: AnyRow }
```
- `getPollListUncached`(원래 263-292행): 줄 269-284의 fallback 블록 제거, 1차 select만 남김:
```ts
const { data, error } = await supabase
  .from('polls')
  .select(POLL_LIST_SELECT)
  .order('created_at', { ascending: false })
  .range(from, to) as { data: AnyRow[] | null; error: AnyRow }
```
- `getPollHomeSectionsUncached`: 동일 패턴으로 fallback 블록 제거.
- `getPollById`: raw select의 fallback 블록(원래 390-404행) 제거, 1차 select만 남김.
- `POLL_LIST_SELECT_FALLBACK` 상수(원래 214-218행) 삭제(더 이상 참조되지 않음).

### 3-2. `frontend/src/lib/actions/ratings.ts`

- 줄 14-16 `RatingSubmitResult` 타입의 error 유니온에서 `'setup_required'` 제거.
- 줄 18-25 `isMissingRatingSchemaError` 함수 전체 삭제.
- 줄 91-100 `submitRatingVotes`의 insert 에러 처리: 줄 97 `if (isMissingRatingSchemaError(error)) return { error: 'setup_required' }` 삭제.

### 3-3. `frontend/src/components/composition/polls/OverallRatingPollClient.tsx`

- 줄 125-133 `handleSubmit`의 에러 메시지 삼항에서 `result.error === 'setup_required' ? '전체 평가 DB 마이그레이션이 필요합니다' :` 분기 삭제.

### 3-4. TEA-29 §5-2 (선택지 이미지 고아 파일 정리)

**결정**: 안 만든다(intent 확정). 코드 변경 없음 — `frontend/src/lib/images/storage-cleanup.ts:10-14`의 기존 주석("poll_options.image_url엔 정리 로직 없음")을 그대로 둔다.

### 영향받는 테스트

`isMissingColumnError`/`isMissingRatingSchemaError`를 문자열로 검사하는 테스트는 없음(grep 확인 완료, feature-spec §TEA-29 영향 테스트 절과 동일 결론) — 재작성 대상 없음.

### 검증

`cd frontend && npm run build && npm test`

### 완료 기준

fallback 관련 코드 0건(`grep -n "isMissingColumnError\|isMissingRatingSchemaError\|POLL_LIST_SELECT_FALLBACK\|setup_required" frontend/src -r`가 0건), 빌드·테스트 통과.

---

## Step 4 — TEA-26a: PollType 통합(데이터 모델) + 화면 분기(임시)

**선행 조건(사람)**: §0-C의 백업 SQL 결과를 확보해둔다(이 단계에서 실제 DB에 손대지 않지만, 마이그레이션 파일은 이 단계에서 함께 만든다).

### 4-1. 마이그레이션 파일 작성 (§3-2 내용을 그대로 파일로)

`supabase/migrations/20260904150000_consolidate_poll_type_to_poll.sql` 생성(§3-2 SQL 그대로). **`supabase db push`는 이 단계에서 실행하지 않는다** — Step D(사람, 코드 배포 후)에서만.

### 4-2. `frontend/src/types/database.ts`

> **실행 중 정정(2026-09-04, 사람 확정 — intent 표 #15)**: 이 단계에서 유니온을 좁히면 Step 4b/5로 미룬 `UserPollCreateForm.tsx`·`actions/polls.ts`·`PollCarouselCard.stories.tsx`가 빌드를 깨뜨린다. 그래서 Step 4에서는 **`'poll'`을 추가만 하고 옛 5개 값을 과도기로 유지**한다: `export type PollType = 'poll' | 'overall_rating' | 'subject_options' | 'question_targets' | 'free_choice' | 'selection' | 'evaluation'`(주석으로 과도기 표시). **`'poll' | 'overall_rating'`으로 좁히는 것은 Step 5 마지막 항목**으로 옮긴다.

- 줄 3: (원안) `export type PollType = 'evaluation' | 'selection' | 'subject_options' | 'question_targets' | 'free_choice' | 'overall_rating'` → `export type PollType = 'poll' | 'overall_rating'` — **Step 5에서 수행**

### 4-3. 렌더 분기 — `frontend/src/app/polls/[id]/page.tsx` (임시 처리 — Step 4b에서 다시 손댄다)

- 줄 92-96 `if (poll.type === 'selection' || poll.type === 'question_targets' || poll.type === 'free_choice') { return <TypeBPollClient poll={poll} isAuthenticated={!!user} canEdit={canEdit} /> } return <TypeAPollClient poll={poll} isAuthenticated={!!user} canEdit={canEdit} />`를 아래로 교체:
```tsx
return poll.player_id
  ? <TypeAPollClient poll={poll} isAuthenticated={!!user} canEdit={canEdit} />
  : <TypeBPollClient poll={poll} isAuthenticated={!!user} canEdit={canEdit} />
```
**이유**: 4-2에서 `PollType`이 `'poll' | 'overall_rating'`으로 좁아지면 `poll.type === 'selection'` 같은 비교가 TS2367(리터럴 겹침 없음) 컴파일 에러가 된다 — 이 줄을 그대로 두면 4-2만으로 빌드가 깨진다. `PollClient.tsx`는 아직 없으므로(Step 4b에서 신설) 여기서는 기존 `TypeAPollClient`/`TypeBPollClient` import(줄 5-6)는 그대로 두고 분기 조건만 최종 기준(`poll.player_id`)으로 바꿔 빌드를 통과시킨다. import를 `PollClient`로 교체하는 건 Step 4b(4-4b)에서 처리한다.

### 4-5. `UserPollEditForm.tsx` — type 라벨/분기 조정

- 줄 15-23 `POLL_TYPE_LABELS`를 아래로 교체:
```ts
const POLL_TYPE_LABELS: Partial<Record<PollDetail['type'], string>> = {
  poll: '일반 투표',
  overall_rating: '전체 평점',
}
```
- 줄 42-44: `showSubjectPlayer = poll.type === 'subject_options' || poll.type === 'evaluation'` → `showSubjectPlayer = !!poll.player_id`(주석도 "poll.player_id 유무로 판정"으로 갱신).

### 4-6. mock/storybook `type` 값 `'evaluation'`/`'selection'` → `'poll'`

| 파일 | 줄 |
|---|---|
| `frontend/src/lib/mock/data.ts` | 68, 81, 98, 111, 124, 137(모두 `type: 'evaluation'` 또는 `'selection'`), 182, 191, 204, 212, 220, 229(각 `id: 'poll-N', type: '...'` 인라인) — 전부 `'poll'`로 |
| `frontend/src/storybook/contents/CommentsSection.stories.tsx` | 52 `pollType: 'selection',` → `'poll'` |
| `frontend/src/storybook/contents/PollCard.stories.tsx` | 9 `type: 'selection',` → `'poll'` |
| `frontend/src/storybook/contents/PollHomeSection.stories.tsx` | 10 `type: 'selection',` → `'poll'` |
| `frontend/src/storybook/contents/PollHeroCard.stories.tsx` | 11 `type: 'selection',` → `'poll'` |

(`PollCarouselCard.stories.tsx`의 `type`은 Step 4b의 "영향받는 테스트"에서 처리 — 그 파일은 `PollClient.tsx` 병합과 함께 바뀌므로 이 단계에서 건드리지 않는다.)

### 4-7. `frontend/src/lib/actions/polls.ts` — 이 단계에서는 `type` 판독만 우선 정리

Step 5(TEA-26b)에서 폼 자체를 재구성하지만, 이 단계에서 렌더 분기가 `poll.player_id`로 바뀌었으므로 **createUserPoll이 여전히 예전 4-타입 문자열을 저장하면 화면은 깨지지 않되(마이그레이션 전까지는 두 값 체계가 공존) 원칙에 어긋난다.** 이 plan은 Step 4에서 액션 로직까지 한 번에 바꾸지 않고 **Step 5로 미룬다** — 이유: `createUserPoll`은 폼 구조(옵션 데이터 모양)와 강하게 결합돼 있어 폼 재구성과 분리하면 중간 상태에서 이중 유지보수가 생긴다. 대신 Step 4 완료 시점에는:
- 기존 13개 poll의 `type` 값(`subject_options` 등)이 DB에 남아있어도(마이그레이션 전) 화면은 `poll.player_id` 기준이라 정상 렌더된다(§2-3 실측: 기존 13건 검증 완료).
- `createUserPoll`이 계속 예전 문자열을 저장해도 새 렌더 분기가 `player_id` 기준이라 새로 만든 poll도 정상 작동한다.
- 즉 **Step 4 완료 후 Step 4b/5 진행 전 어느 시점에 배포가 끼어도 안전**하다(다만 이 plan의 PR 전략은 Step 4~7을 PR #2 하나로 묶으므로, 이 안전성은 실제로는 여유이지 별도 PR 분리 근거로 쓰지 않는다 — §PR 전략 참고).

### 검증

`cd frontend && npm run build && npm test`

### 완료 기준

- `frontend/src/types/database.ts`의 `PollType`이 `'poll' | 'overall_rating'`으로 좁혀짐.
- `frontend/src/app/polls/[id]/page.tsx`가 `poll.player_id` 기준으로 임시 분기(4-3)하며 `npm run build`가 통과함(기존 `TypeAPollClient`/`TypeBPollClient` 파일은 이 단계에서 삭제하지 않음 — Step 4b에서 삭제).
- `npm run build`, `npm test` 통과.
- `frontend/src`에서 런타임에 `type === 'poll'`처럼 새 값을 **양성 검사**하는 코드가 없어야 한다(`grep -rn "'poll'" frontend/src`로 확인). 이유: 코드가 먼저 배포되고 마이그레이션(§3-2)은 뒤에 실행되므로, 그 사이 DB엔 옛 값(`free_choice` 등)이 남아 있다. 분기는 `type === 'overall_rating'`의 부정형과 `poll.player_id` 유무만 써야 한다.

---

## Step 4b — TEA-26a: PollClient.tsx 병합

**선행 조건**: Step 4 완료(빌드·테스트 통과, `PollType` 좁혀짐, `page.tsx`가 `poll.player_id` 기준 임시 분기 상태).

### 4-4. `PollClient.tsx` 신설 — `TypeAPollClient.tsx` + `TypeBPollClient.tsx` 병합

**파일**: `frontend/src/components/composition/polls/PollClient.tsx` (사용자 확정 이름). 기존 두 파일은 삭제.

**병합 원칙(이 plan의 구체 설계 — 승인 시 확정, 다르게 보이길 원하면 승인 전에 알려달라 — 사람 확인 필요 #11)**:
- 상태(`selectedId`/`showConfirm`/`showLogin`/`errorMsg`/`isPending`)와 `handleSubmitClick`/`handleConfirm`은 **한 번만** 선언(두 파일이 토큰 단위로 동일했으므로 그대로 하나로).
- `poll.player_id` 유무로 갈리는 건 **커버 블록**과 **선수 정보 카드** 두 곳뿐 — 각각 기존 TypeA/TypeB의 마크업을 최대한 그대로 옮긴다(동작·시각 변화를 최소화하는 게 이 plan의 방향, intent.md도 이 두 지점만 조건부로 지정했다).
- 선택지 리스트는 **TypeB의 썸네일 인식 로직(`getOptionThumb`/`getOptionSubLabel`/`hasAnyThumb`)을 양쪽 분기 공통으로 사용**한다 — TEA-26b(Step 5)에서 옵션에 선수 연결이 poll 전체 선수 유무와 무관하게 섞일 수 있게 되므로(선택지별 선수 연결은 poll.player_id 토글과 독립), 이 로직이 상위 호환이다(썸네일 없는 옵션만 있으면 예전 TypeA와 동일하게 보임).
- "평가" 칩(구 TypeA 95-98행)은 삭제(intent §3 표 "유형 뱃지" 확정).
- `pollDate`는 `formatPollDate(poll.created_at ?? poll.closes_at)`(scheduled_at 이미 삭제됨, Step 1 반영).

**골격**:
```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PollEditLink } from './PollEditLink'
import { Loader2 } from 'lucide-react'
import type { PollDetail } from '@/lib/queries/polls'
import type { PlayerRow, PollOptionRow } from '@/types/database'
import { submitVote } from '@/lib/actions/vote'
import { trackEvent } from '@/lib/analytics/mixpanel'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/primitives/badge'
import { Button } from '@/components/primitives/button'
import { Card, CardContent } from '@/components/primitives/card'
import { RadioOption } from '@/components/primitives/radio'
import { StickyActionBar } from '@/components/primitives/sticky-action-bar'
import { Modal } from '@/components/primitives/modal/Modal'
import { ConfirmContent } from '@/components/primitives/modal/contents/Confirm'
import { LoginContent } from '@/components/primitives/modal/contents/Login'
import { PollPageHeader } from './PollPageHeader'
import { getStatusLabel, getStatusTone } from './PollCard'
import { formatPollDate, getOptionThumb } from './ResultView'

interface PollClientProps {
  poll: PollDetail
  isAuthenticated: boolean
  canEdit: boolean
}

/** 라벨 아래 보조 줄. 선수면 포지션·등번호, 자유 선택지면 설명. (구 TypeBPollClient) */
function getOptionSubLabel(option: PollOptionRow, optionPlayers?: Record<string, PlayerRow>) {
  const player = option.player_id ? optionPlayers?.[option.player_id] ?? null : null
  if (player) {
    return player.squad_number != null ? `${player.position} · #${player.squad_number}` : player.position
  }
  return option.description ?? null
}

export function PollClient({ poll, isAuthenticated, canEdit }: PollClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const showSubjectPlayer = !!poll.player_id
  const options = poll.poll_options
  const selectedOption = options.find(o => o.id === selectedId)
  const hasAnyThumb = options.some(option => getOptionThumb(option, poll.option_players) !== null)

  function handleSubmitClick() {
    if (!selectedId) return
    if (!isAuthenticated) { setShowLogin(true); return }
    setShowConfirm(true)
  }

  function handleConfirm() {
    if (!selectedId) return
    setErrorMsg(null)
    startTransition(async () => {
      const result = await submitVote(poll.id, selectedId)
      if ('success' in result) {
        trackEvent('vote_submitted', {
          source_page: 'poll_detail',
          poll_id: poll.id,
          poll_type: poll.type,
          poll_status: poll.status,
          creator_type: poll.created_by && poll.creator_name ? 'user' : 'admin',
          option_id: selectedId,
          is_first_vote: true,
        })
        setShowConfirm(false)
        router.refresh()
      } else {
        setShowConfirm(false)
        setErrorMsg(result.error === 'already_voted' ? '이미 참여한 투표입니다' : '제출에 실패했습니다. 다시 시도해주세요')
      }
    })
  }

  const coverUrl = poll.thumbnail_url
    ?? poll.player?.photo_url
    ?? `https://placehold.co/680x252/0c2340/41b6e6?text=${encodeURIComponent(poll.title.slice(0, 4))}`
  const pollDate = formatPollDate(poll.created_at ?? poll.closes_at)
  const daysLeft = Math.ceil((new Date(poll.closes_at).getTime() - Date.now()) / 86400000)

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <PollPageHeader action={canEdit && <PollEditLink pollId={poll.id} />} />

      <main className="mx-auto w-full max-w-detail px-4 pb-[88px] pt-4 animate-enter sm:pb-10">
        <div className="flex flex-col gap-6">

          {showSubjectPlayer ? (
            /* 구 TypeA — 커버에 칩+제목 오버레이. '평가' 칩은 삭제됨(TEA-26). 높이는 TEA-27 반응형(Step 6). */
            <div className="relative h-[160px] overflow-hidden rounded-lg">
              <img src={coverUrl} alt={poll.title} className="w-full h-full object-cover" />
              <div className="banner-text-overlay absolute inset-0" />
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                <div className="flex items-center gap-1.5 mb-2">
                  {daysLeft > 0 ? (
                    <Badge className="bg-brand-solid text-white border-0 text-caption-2 font-medium hover:bg-brand-solid pointer-events-none">
                      D-{daysLeft} 마감
                    </Badge>
                  ) : (
                    <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm text-caption-2 font-medium pointer-events-none">
                      마감
                    </Badge>
                  )}
                </div>
                <div className="flex items-end justify-between gap-3">
                  <p className="min-w-0 flex-1 text-headline-2 sm:text-headline-1 font-semibold text-white">{poll.title}</p>
                  {poll.creator_name && (
                    <span className="max-w-[38%] truncate text-right text-caption-1 font-medium text-white/80">{poll.creator_name}</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 구 TypeB — 커버 단독 블록 + 글 컨테이너 */
            <>
              <div className="overflow-hidden rounded-lg bg-disabled">
                <img src={coverUrl} alt={poll.title} className="h-[252px] w-full object-cover" />
              </div>
              <section className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
                <h1 className="break-keep text-heading-2 sm:text-heading-1 font-semibold text-neutral">{poll.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption-1 text-neutral-muted">
                  <Badge variant={getStatusTone(poll)} className="pointer-events-none whitespace-nowrap">
                    {getStatusLabel(poll)}
                  </Badge>
                  {pollDate && <span>{pollDate}</span>}
                  <span>{poll.creator_name ?? 'Admin'}</span>
                </div>
                {poll.description && (
                  <>
                    <div className="my-4 h-px bg-neutral-weak" />
                    <p className="text-body-1-reading text-neutral">{poll.description}</p>
                  </>
                )}
              </section>
            </>
          )}

          {showSubjectPlayer && poll.description && (
            <p className="text-label-1-reading text-neutral-muted">{poll.description}</p>
          )}

          {canEdit && (
            <div className="hidden justify-end sm:flex">
              <PollEditLink pollId={poll.id} />
            </div>
          )}

          <div className="flex flex-col gap-3">
            {!showSubjectPlayer && (
              <p className="text-label-2 font-medium text-neutral-strong">
                선택지 {options.length}개 · 하나만 고를 수 있어요
              </p>
            )}

            {errorMsg && (
              <p role="alert" className="text-label-1-normal font-medium text-critical">{errorMsg}</p>
            )}

            <div className="flex flex-col gap-2" role="radiogroup" aria-label="투표 선택지">
              {options.map(option => {
                const selected = selectedId === option.id
                const thumb = getOptionThumb(option, poll.option_players)
                const sub = getOptionSubLabel(option, poll.option_players)
                return (
                  <RadioOption key={option.id} selected={selected} onClick={() => setSelectedId(option.id)}>
                    {hasAnyThumb && (
                      <span className="flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-pill bg-brand-solid text-caption-1 font-medium text-white">
                        {thumb?.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumb.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span>{thumb?.fallback ?? option.label.slice(0, 1)}</span>
                        )}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cn('block break-keep line-clamp-2 text-body-2-normal font-semibold', selected ? 'text-brand' : 'text-neutral')}>
                        {option.label}
                      </span>
                      {sub && <span className="mt-0.5 block truncate text-caption-1 font-medium text-neutral-muted">{sub}</span>}
                    </span>
                  </RadioOption>
                )
              })}
            </div>

            <StickyActionBar className="sm:mt-2 sm:pb-0">
              <Button size="lg" className="w-full" disabled={!selectedId || isPending} onClick={handleSubmitClick}>
                {isPending ? <><Loader2 className="h-4 w-4 animate-spin" />제출 중…</> : '투표하기'}
              </Button>
            </StickyActionBar>
          </div>

          {showSubjectPlayer && poll.player && (
            <Card className="mt-1">
              <CardContent className="p-4">
                <p className="text-caption-1 font-medium text-neutral-muted uppercase mb-3">선수 정보</p>
                <div className="flex items-center gap-3">
                  <img
                    src={poll.player.photo_url ?? `https://placehold.co/44x44/0c2340/41b6e6?text=${poll.player.squad_number}`}
                    alt={poll.player.name}
                    className="w-11 h-11 rounded-pill object-cover flex-shrink-0"
                  />
                  <div>
                    <p className="text-label-1-normal font-medium text-neutral">{poll.player.name}</p>
                    <p className="text-caption-1 text-neutral-muted mt-0.5">
                      {poll.player.position}
                      <span className="mx-1.5">·</span>
                      <span className="font-semibold text-brand">#{poll.player.squad_number}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {selectedOption && (
        <Modal open={showConfirm} onOpenChange={o => { if (!o) setShowConfirm(false) }}>
          <ConfirmContent selectedLabel={selectedOption.label} onCancel={() => setShowConfirm(false)} onConfirm={handleConfirm} isPending={isPending} />
        </Modal>
      )}
      <Modal open={showLogin} onOpenChange={o => { if (!o) setShowLogin(false) }} form="default">
        <LoginContent triggerAction="vote" onClose={() => setShowLogin(false)} />
      </Modal>
    </div>
  )
}
```

(높이 클래스 `h-[160px]`/`h-[252px]`는 Step 6에서 `h-[160px] sm:h-[252px]`로 통일한다 — 여기서는 병합 자체만 한다.)

### 4-4b. `page.tsx` import 교체 — 임시 분기를 `PollClient`로 되돌리기

Step 4(4-3)에서 넣은 임시 분기를 최종 형태로 교체한다.
- 줄 5-6: `import { TypeAPollClient } from ...` / `import { TypeBPollClient } from ...` → `import { PollClient } from '@/components/composition/polls/PollClient'` 한 줄로 교체.
- 4-3에서 넣은 `return poll.player_id ? <TypeAPollClient .../> : <TypeBPollClient .../>`를 아래로 교체:
```tsx
return <PollClient poll={poll} isAuthenticated={!!user} canEdit={canEdit} />
```
(`PollClient` 내부가 `poll.player_id` 유무로 알아서 갈리므로 호출부의 분기는 완전히 사라진다.)

### 영향받는 테스트

- `frontend/src/components/composition/polls/login-modal.test.mjs` — 줄 18-19 두 줄:
```js
  ['./TypeAPollClient.tsx', 'vote'],
  ['./TypeBPollClient.tsx', 'vote'],
```
→ 한 줄로 교체:
```js
  ['./PollClient.tsx', 'vote'],
```
- `frontend/src/components/design-foundation.test.mjs`:
  - 줄 77: `const detail = source('components/composition/polls/TypeBPollClient.tsx')` → `source('components/composition/polls/PollClient.tsx')`(줄 79-93의 나머지 단정문은 PollClient.tsx가 두 마크업을 다 갖고 있으므로 그대로 통과).
  - 줄 96-136 `'image banners use a readable dark overlay for white text'`: `files` 배열(줄 98-111)에서 `'components/composition/polls/TypeAPollClient.tsx'`(줄 101) → `'components/composition/polls/PollClient.tsx'`로 교체. 줄 124-127 `const typeB = source('.../TypeBPollClient.tsx'); assert.doesNotMatch(typeB, /banner-text-overlay/)` 블록을 **재작성**한다(삭제하지 않음) — 병합 후 같은 파일(`PollClient.tsx`)이 `showSubjectPlayer` 분기에 따라 조건부로 `banner-text-overlay`를 포함하므로, "그 파일엔 없어야 한다"는 단정 대신 "그 문자열이 `showSubjectPlayer`(구 TypeA) 분기 안에서만 등장하고 구 TypeB 분기에는 없다"는 순서 검사로 바꾼다(CLAUDE.md — 화면 구조를 옮기면 테스트를 지우지 않고 옮겨간 자리 기준으로 단정문을 다시 쓴다):
```js
const merged = source('components/composition/polls/PollClient.tsx')
const typeABranchStart = merged.indexOf('showSubjectPlayer ? (')
const overlayIndex = merged.indexOf('banner-text-overlay')
const typeBBranchStart = merged.indexOf('구 TypeB')
assert.ok(typeABranchStart !== -1 && overlayIndex !== -1 && typeBBranchStart !== -1, 'PollClient.tsx should contain the showSubjectPlayer branch and the TypeB branch marker')
assert.ok(overlayIndex > typeABranchStart && overlayIndex < typeBBranchStart, 'banner-text-overlay should only render inside the showSubjectPlayer(TypeA) branch, not the TypeB branch')
```
  - 줄 296-306 파일 목록: `'components/composition/polls/TypeAPollClient.tsx'`(304)·`'components/composition/polls/TypeBPollClient.tsx'`(305) 두 줄 → `'components/composition/polls/PollClient.tsx'` 한 줄로 교체.
- `frontend/src/storybook/contents/PollCarouselCard.stories.tsx` — 전체 갱신(빌드 대상이므로 필수):
  - 줄 3: `import { TypeBPollClient } from '@/components/composition/polls/TypeBPollClient'` → `import { PollClient } from '@/components/composition/polls/PollClient'`
  - 줄 8: `type: 'selection',` → `type: 'poll',`
  - 줄 21: `player_id: 'p1'` 등 옵션에 선수가 이미 연결돼 있으므로 poll 자체엔 `player_id: null`(줄 15 그대로) — 그대로 두면 `PollClient`가 자동으로 "옵션별 선수 연결" 분기(TypeB 마크업)로 렌더된다.
  - 줄 33-40 `meta`: `component: TypeBPollClient` → `component: PollClient`, `satisfies Meta<typeof TypeBPollClient>` → `satisfies Meta<typeof PollClient>`

### 검증

`cd frontend && npm run build && npm test`

### 완료 기준

- `grep -rn "TypeAPollClient\|TypeBPollClient" frontend/src --include="*.ts" --include="*.tsx" --include="*.mjs"` → 0건(주석 포함 전부 제거 확인. mdx 파일은 제외 대상 — §7 참고).
- `frontend/src/components/composition/polls/TypeAPollClient.tsx`, `TypeBPollClient.tsx` 파일 삭제됨.
- `npm run build`, `npm test` 통과.

---

## Step 5 — TEA-26b: 생성/수정 폼 재구성

> **추가 항목(2026-09-04, intent 표 #15)**: 이 단계의 **마지막**에 `frontend/src/types/database.ts`의 `PollType`을 `'poll' | 'overall_rating'`으로 좁히고 과도기 주석을 지운다(Step 4에서 옛 값을 유지했으므로). 완료 기준에 `grep -rn "'subject_options'\|'question_targets'\|'free_choice'\|'selection'\|'evaluation'" frontend/src` **0건**을 포함한다.

### 5-1. `frontend/src/lib/queries/polls.ts` — `getPollFormPlayers()`에 `is_active` 필터

Step 3에서 fallback을 제거한 뒤의 형태(§3-1) 기준으로, select 뒤에 `.eq('is_active', true)` 추가:
```ts
const { data, error } = await supabase
  .from('players')
  .select('id, name, position, squad_number, photo_url, is_active, squad_status')
  .eq('is_active', true)
  .order('squad_number', { ascending: true }) as { data: AnyRow[] | null; error: AnyRow }
```

### 5-2. `frontend/src/components/composition/polls/UserPollCreateForm.tsx` — 전면 재구성

**타입/상수** (기존 줄 16-24 교체):
```ts
type PollFormat = 'poll' | 'overall_rating'
type UnifiedOption = { label: string; description: string; imageUrl: string; playerId: string | null }

const POLL_FORMATS: Array<{ format: PollFormat; label: string; description: string }> = [
  { format: 'poll', label: '일반 투표', description: '선택지를 만들어 팬들의 의견을 모읍니다.' },
  { format: 'overall_rating', label: '전체 평점', description: '여러 선수에게 각각 등급과 코멘트를 받습니다.' },
]
```

**상태** (기존 줄 28-39 대체): `pollType`(4종) → `format: PollFormat`(2종). `textOptions`/`freeOptions` 통합 → `options: UnifiedOption[]`(초기 2개, 각 `{ label: '', description: '', imageUrl: '', playerId: null }`). `showSubjectPlayer: boolean`(초기 false) 추가. 옵션별 선수 연결 픽커를 구분하기 위해 `editingOptionIndex: number | null` 추가(picker가 "대상 선수" 용인지 "옵션 N번" 용인지 구분).

**픽커 연결**: `openPlayerPicker(mode, optionIndex?)`로 시그니처 확장 — `optionIndex`가 주어지면 `editingOptionIndex`를 세팅. `togglePlayer(playerId)`에서:
- `editingOptionIndex !== null`이면 해당 옵션의 `playerId`를 세팅하고 `imageUrl`을 `''`로 비움(1안: 선수 연결 시 이미지 업로드 숨김), picker 닫고 `editingOptionIndex` 리셋.
- 아니고 `pickerMode === 'single'`이면 기존처럼 `selectedSubjectPlayerId` 세팅.
- 아니면(`multiple`, overall_rating) 기존 `selectedPlayerIds` 토글 로직 유지.

**UI 구조**:
1. "투표 형식" 섹션 — `POLL_FORMATS` 2장 카드(기존 `POLL_TYPES` 4장 카드와 같은 마크업 패턴, 배열만 교체).
2. "기본 정보" 섹션 — 기존과 동일하되 `description` input(줄 218)을 Step 6(TEA-27)에서 textarea로 바꾼다(이 단계에서는 손대지 않음, 순서 충돌 방지).
3. `format === 'poll'`일 때만:
   - "특정 선수 한 명에 대한 투표인가요?" 토글(체크박스 또는 스위치 — 기존 디자인 시스템에 스위치 프리미티브가 있는지 확인, 없으면 버튼 토글로 기존 `PlayerSummary`/`EmptySelection` 패턴 재사용): 켜지면 `openPlayerPicker('single')`로 대상 선수 선택 UI(기존 231-239행 패턴 재사용).
   - "선택지" 섹션 — `options.map`으로 카드 렌더. 각 카드:
     - `label` input(필수)
     - `description` textarea(기존 270-275행 클래스 `min-h-[72px] resize-none py-2` 재사용)
     - `playerId`가 없으면: "선수 연결" 버튼(`openPlayerPicker('single', index)`) + 이미지 URL input + `CroppedImageInput`(기존 276-289행, `outputWidth={1000} outputHeight={1300}`)
     - `playerId`가 있으면: 이미지 입력 UI 전부 숨기고 대신 연결된 선수 요약 행(`PlayerSummary`-유사, "변경"/"연결 해제" 버튼) 표시.
4. `format === 'overall_rating'`일 때: 기존 303-326행(다중 선수 선택) 그대로 유지, `pollType === 'overall_rating' ? '평가 대상 선수' : ...` 삼항은 이제 `format === 'overall_rating'`이 유일하게 도달 가능한 값이므로 라벨 상수화 가능(선택 사항, 필수 아님).

**`submit()` 재작성**:
```ts
function submit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  setMessage(null)
  const fd = new FormData(e.currentTarget)
  trackEvent('create_poll_clicked', { source_page: 'create', poll_type: format })

  if (format === 'overall_rating') {
    // 기존 else 분기(줄 104-116)를 그대로 유지
    ...
  } else {
    const cleaned = options.map((option, index) => ({ ...option, label: option.label.trim(), imageField: `option_image_${index}` }))
      .filter(option => option.label)
    if (cleaned.length < 2) { setMessage('선택지를 최소 2개 입력해주세요.'); return }
    if (showSubjectPlayer && !selectedSubjectPlayerId) { setMessage('대상 선수를 선택해주세요.'); return }

    fd.set('options', JSON.stringify(cleaned.map(option => ({
      label: option.label,
      description: option.description.trim() || null,
      image_url: option.playerId ? null : (option.imageUrl.trim() || null),
      player_id: option.playerId,
      imageField: option.playerId ? null : option.imageField,
    }))))
    if (showSubjectPlayer && selectedSubjectPlayerId) fd.set('player_id', selectedSubjectPlayerId)
    else fd.delete('player_id')
  }

  fd.set('type', format)
  // ... 이하 업로드·createUserPoll 호출부는 'free_choice' 분기(줄 136-171)의 이미지 업로드 루프를
  //     format === 'poll'로 조건만 바꿔 재사용(옵션마다 imageField가 null이 아닌 것만 업로드 시도)
}
```

### 5-3. `frontend/src/lib/actions/polls.ts` — `createUserPoll` 조정

- 줄 19: `const type = (formData.get('type') as PollType) || 'subject_options'` → `const type = (formData.get('type') as PollType) || 'poll'`
- 줄 39-53 옵션 매핑에서 `type === 'free_choice' && option.description` 조건 제거(더 이상 type 분기 불필요):
```ts
options = options
  .map(option => ({
    label: String(option.label ?? '').trim(),
    description: option.description ? String(option.description).trim() : null,
    player_id: option.player_id ?? null,
    image_url: option.image_url ? String(option.image_url).trim() : null,
  }))
  .filter(option => option.label)
```
- 줄 56: `if (type === 'subject_options' && !playerId) return { error: '대상 선수를 선택해주세요.' }` **삭제**(대상 선수는 이제 poll 전체에 항상 optional — 폼에서 토글이 켜졌을 때만 클라이언트가 이미 검증함, 서버는 강제하지 않는다).
- 줄 70: `player_id: type === 'subject_options' ? playerId : null,` → `player_id: playerId,`

### 5-4. `frontend/src/components/composition/polls/UserPollEditForm.tsx` — 이미 4-5에서 처리 완료(중복 없음).

### 영향받는 테스트

- poll type 문자열(`evaluation`/`selection`/`free_choice`/`subject_options`/`question_targets`/`overall_rating`)을 검사하는 테스트 0건(feature-spec 확인 완료) — 이번 값 변경으로 깨지는 테스트 없음.
- `frontend/src/components/design-foundation.test.mjs` 줄 75-94(`'poll form and poll detail surfaces use card radius foundation'`): `const form = source('.../UserPollCreateForm.tsx')`에 대한 단정(`rounded-lg border border-neutral-weak bg-surface p-4 shadow-g200` 등)은 섹션 카드 마크업 패턴을 그대로 유지하면 통과 — **재구성 시 이 클래스 조합을 유지할 것**(변경 금지 사항으로 구현 에이전트에 전달).

### 검증

`cd frontend && npm run build && npm test`

### 완료 기준

- `npm run build`/`npm test` 통과.
- 수동 확인(mock 모드 `npm run dev`): "일반 투표" 선택 → 대상 선수 토글 켜고 옵션 하나에 선수 연결 → 생성 → 상세 화면에서 커버 오버레이(대상 선수 있음) + 옵션 리스트에 선수 썸네일 1개만 표시되는지 육안 확인.

---

## Step 6 — TEA-27: 표지 반응형 + 설명 textarea

### 6-1. 표지 높이 5곳 → `h-[160px] sm:h-[252px]`

| 파일:줄(현재) | 비고 |
|---|---|
| `PollClient.tsx`의 showSubjectPlayer 분기 `h-[160px]` (Step 4b에서 만든 그 줄) | → `h-[160px] sm:h-[252px]` |
| `PollClient.tsx`의 !showSubjectPlayer 분기 `h-[252px]` | → `h-[160px] sm:h-[252px]` |
| `ResultView.tsx:110` `h-[252px]` | → `h-[160px] sm:h-[252px]` |
| `OverallRatingPollClient.tsx:155` `h-[252px]` | → `h-[160px] sm:h-[252px]` |
| `OverallRatingResultView.tsx:55` `h-[252px]` | → `h-[160px] sm:h-[252px]` |

**클래스 문자열을 상수로 뽑지 않는다**(intent 확정 — 5곳에 직접 기재). **`PollHeroCard.tsx:25`는 건드리지 않는다**(intent 확정 — 252px 그대로 유지, 표지 반응형 스코프 밖).

### 6-2. 설명 textarea 전환

- `frontend/src/components/composition/polls/UserPollCreateForm.tsx` 줄 218: `<input name="description" className="input-field" placeholder="설명(선택)" />` → `<textarea name="description" className="input-field min-h-[72px] resize-none py-2" placeholder="설명(선택)" />`
- `frontend/src/components/composition/polls/UserPollEditForm.tsx` 줄 103: `<input name="description" defaultValue={poll.description ?? ''} className="input-field" placeholder="설명(선택)" />` → `<textarea name="description" defaultValue={poll.description ?? ''} className="input-field min-h-[72px] resize-none py-2" placeholder="설명(선택)" />`

### 영향받는 테스트

- `frontend/src/components/composition/polls/result-view-figma-contract.test.mjs:12`: `assert.match(resultView, /h-\[252px\]/)` — `h-[160px] sm:h-[252px]`로 바뀌어도 `h-[252px]` 부분 문자열이 남아있어 **그대로 통과 예상**. 단 실행해서 실제로 확인한다(정규식은 부분매치이므로 이론상 통과하지만 CLAUDE.md 규칙상 반드시 실행 확인).
- `frontend/src/components/composition/polls/poll-list-client.test.mjs:56`: `assert.match(hero, /relative block h-\[252px\] overflow-hidden rounded-lg/)` — `PollHeroCard.tsx`는 건드리지 않으므로 영향 없음.
- description textarea 관련 테스트 0건(feature-spec 확인) — 안전.

### 검증

`cd frontend && npm test`

### 완료 기준

`npm test` 전체 통과, 5개 파일 모두 `h-[160px] sm:h-[252px]` 확인(`grep -rn "h-\[160px\] sm:h-\[252px\]" frontend/src`가 5건).

---

## Step 7 — 문서 갱신

구현(Step 1~6) 완료 후 아래 문서를 갱신한다(코드 변경 없음, 검증 명령 없음 — 리뷰만):

- `vault/99_old/AGENT_MAINTENANCE_GUIDE.md` — "현재 특히 조심할 부분"의 fallback 관련 문장(players.squad_status/polls.thumbnail_url) 삭제(Step 3에서 fallback 자체가 없어졌으므로). "예정/마감 투표 자동 상태 전환" 문장을 "예정 투표 기능 자체가 없음(TEA-25, 2026-09)"으로 갱신.
- `vault/99_old/SUPABASE_DATA_CONNECTIONS.md` — `polls`/`poll_options` 섹션의 "Type A/evaluation", "Type B/selection" 서술을 "`poll.player_id` 유무로 화면이 갈린다(PollClient.tsx 단일 컴포넌트)"로 갱신. `scheduled_at` 컬럼 관련 서술 삭제(컬럼 자체가 Step D에서 드롭됨).
- `vault/99_old/specs/04-poll-list.md`, `05-poll-detail.md` — intent.md §3 표 그대로 반영(유형뱃지 삭제, 표지 반응형 160/252, 카드 부제 없음 확정, 뒤로가기·캐러셀·최다득표 카드는 스펙 폐기 표시).
- `vault/99_old/specs/07-scheduled-polls.md` — "기능 없음(2026-09 TEA-25로 완전 제거)"으로 전면 갱신 또는 파일 상단에 폐기 배너 추가.

**선택 사항(이번 plan 범위 밖, 필수 아님)**: `storybook/DESIGN-SYSTEM.md`, `storybook/contents/Card.mdx`, `PollCarouselCard.mdx`, `Avatar.mdx`, `Gradient.mdx`, `DesignToken.mdx`, `feedback/LoginModal.mdx`, `feedback/ConfirmModal.mdx`, `actions/StickyActionBar.mdx`, `selection-and-input/Radio.mdx`의 `TypeAPollClient`/`TypeBPollClient` 텍스트 언급(빌드·테스트에 영향 없는 순수 설명문) — 정확성을 위해 `PollClient`로 바꾸면 좋지만 이번 정리의 필수 대상은 아니다.

---

## PR 전략 (확정)

**PR #1 — Step 1(TEA-25)만 단독**: 브랜치 `refactor/poll-cleanup`에 Step 1 커밋 1개(TEA-25 코드 전체 제거)만 올려 먼저 PR을 낸다. PR 본문에 `Fixes TEA-25` 포함. 리뷰·머지·배포 확인까지 마친 뒤에야 Step 2로 넘어간다(§0-D-1, §4 실행 순서 참고).

**PR #2 — Step 3~7 묶음**: PR #1이 머지된 뒤, **같은 `refactor/poll-cleanup` 브랜치를 이어 써서** Step 3~7을 순서대로 커밋(TEA-29 1커밋, TEA-26a/b 3커밋(Step 4, Step 4b, Step 5), TEA-27 1커밋, 문서 1커밋)하고 **PR 1개**로 낸다. PR 본문에 `Fixes TEA-26, TEA-27, TEA-29` 포함(TEA-25는 PR #1에서 이미 처리됐으므로 제외). Step D(마이그레이션 2건 `supabase db push`)는 그대로 PR #2 머지 후에 실행한다(§0-D).

**브랜치를 이어 쓰는 이유(파일 겹침 근거)**: Step 3~7은 Step 1이 이미 바꿔놓은 파일 위에서 이어서 작업한다 — `lib/queries/polls.ts`(Step 1·3·5), `lib/actions/polls.ts`(Step 1·5), `types/database.ts`(Step 1·4), storybook 픽스처 4개(Step 1·4), `app/polls/[id]/page.tsx`(Step 4·4b) 등. PR #1 머지 후 `origin/main`에서 새 브랜치를 다시 따면 Step 3~7이 이미 `refactor/poll-cleanup`에 커밋된 Step 1 위 상태로 작성돼 있어 그 커밋들을 다시 cherry-pick하거나 처음부터 다시 작성해야 한다 — 겹치는 파일이 많을수록 충돌·재작업 위험이 커진다. 같은 브랜치를 이어 쓰면 이 재작업이 없다.

**실행 시 주의(구현 에이전트가 처리)**: PR #1이 머지된 직후, `refactor/poll-cleanup`을 계속 커밋하기 전에 업데이트된 `origin/main`을 브랜치에 반영(rebase 또는 merge)해서 브랜치 히스토리에 Step 1 변경이 중복으로 남지 않게 한다 — 그래야 PR #2의 diff가 Step 3~7만 보여준다.

---

## 리스크 · 롤백

| 항목 | 리스크 | 롤백 |
|---|---|---|
| `scheduled_at` DROP COLUMN | 낮음(전량 NULL 확인됨) | §3-1 롤백 SQL(컬럼 재생성, 데이터 없음) |
| `type` → `'poll'` 일괄 UPDATE | 중간(되돌리려면 원래 값 알아야 함) | §0-C 백업 필수, §3-2 개별 UPDATE로 복원 |
| fallback 제거(Step 3) | 낮음(Step 2에서 컬럼 존재 확인 후 진행) | git revert(코드만 되돌리면 됨, DB 변경 없음) |
| PollClient.tsx 병합(Step 4b) | 중간 — `design-foundation.test.mjs`의 `banner-text-overlay` 부재 검사 1건이 조건부 렌더 순서 검사로 재작성됨(커버리지 손실 없음, 위 Step 4b 기록 참고) | git revert(코드만) |
| 생성 폼 재구성(Step 5) | 중간 — 폼 로직이 크게 바뀜, 수동 QA 필요(완료 기준의 육안 확인) | git revert |
| 표지 반응형(Step 6) | 낮음 | git revert |

**깨질 것으로 예상되는 테스트(재작성 포함 목록, 위 각 Step에 상세)**:
`status.test.mjs`(전체), `vote-eligibility.test.mjs`, `poll-edit-eligibility.test.mjs`, `poll-list-client.test.mjs`, `login-modal.test.mjs`, `design-foundation.test.mjs`. `result-view-figma-contract.test.mjs`는 이론상 안 깨지나 반드시 실행 확인.

---

## TEA-28 관련 메모

feature-spec.md §4-1이 제안한 "fallback 공용 헬퍼 추출"은 Step 3에서 fallback 코드 자체가 사라지므로 **불필요해졌다**. TEA-28을 나중에 진행할 때 이 항목은 스킵하고 나머지 4개 항목(service-role 헬퍼, handleConfirm 공유 — 이미 Step 4b에서 PollClient.tsx 병합으로 자연히 해결됨, 과대 파일 분리, `getOptionThumb`/`formatPollDate` 위치 재검토)만 남는다.

---

## "사람 확인 필요" 항목 (feature-spec.md의 9건은 intent.md에서 전부 확정됨 — 이 plan에서 새로 발견한 2건만 추가)

10. Step 1-18: mock `poll-3` fixture(원래 "공개 예정" 데모) 처리 — **확정: 삭제** (`MOCK_POLL_LIST`·`MOCK_POLL_DETAIL`의 `poll-3` 블록 전체 제거, 대체 데모 없음).
11. Step 4b(4-4): `PollClient.tsx` 병합의 정확한 레이아웃(커버 오버레이 분기 vs 글 컨테이너 분기의 세부 마크업)은 intent.md가 "표지 오버레이·선수 정보 카드만 조건부"라고만 명시했을 뿐 세부는 정하지 않음 — 이 plan은 기존 TypeA/TypeB 마크업을 각 분기에 거의 그대로 옮기는 안(동작 변화 최소화)을 제안. 다른 시각 결과를 원하면 승인 전에 알려달라(필요시 designer 경유).

이 외 feature-spec.md의 "사람 확인 필요" 9건은 intent.md 확정 표에서 전부 답이 나왔고, 이 plan의 각 Step에 그대로 반영했다(예: #3 컴포넌트 통합 → "합친다"로 확정, #6 TEA-28 새 이름 → 2026-09-05 별도 확정, 아래 Step 6).

---

## Step 6 — TEA-28: 코드 구조 정리 (동작 변화 없음)

intent.md #6(2026-09-05 확정)을 그대로 구현한다. 이 Step은 Step 1~5(TEA-25/26/27/29)가 이미 머지된 뒤, 별도 브랜치(Linear TEA-28 브랜치)에서 진행한다. 세 하위 단계는 서로 다른 파일을 건드리므로 **독립적으로 커밋·리뷰 가능**(6-A/6-B/6-C 순서 무관, 병렬 작업 가능).

feature-spec.md §4-1(fallback 공용 헬퍼)과 §4-3(handleConfirm 공유 훅)은 각각 TEA-29·TEA-26에서 이미 대상이 사라져 **항목 종결, 구현 없음**.

### 6-A. service-role 클라이언트 헬퍼

새 파일 `frontend/src/lib/supabase/service-client.ts`:

```ts
export async function getServiceRoleClient() {
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

권한 검사는 하지 않는다(호출부가 각자 필요한 권한 검사를 이미 하고 있으므로 그대로 둔다). 아래 13곳의 `await import('@supabase/supabase-js')` + `createClient(...)` 블록을 `await getServiceRoleClient()` 호출로 치환한다:

- `app/api/purge-deleted-accounts/route.ts:16-20`
- `lib/images/profile-icons.ts:23-27`
- `lib/queries/polls.ts:114-118, 142-146, 379-383`
- `lib/queries/comments.ts:82-86`
- `lib/actions/comments.ts:173-177, 215-219`
- `lib/actions/player-pick-one.ts:50-54, 78-82`
- `lib/actions/polls.ts:63-67, 166-170`
- `lib/actions/images.ts:22-26`
- `lib/supabase/admin.ts:7-19`(`requireAdminClient`) — `isAdmin` 권한 검사는 그대로 두고, 검사를 통과한 뒤의 클라이언트 생성 부분만 `getServiceRoleClient()` 호출로 교체

**제외**: `lib/actions/sync-fixtures.ts:43-44`는 `createClient(supabase-js)`가 아니라 외부 API를 `fetch`로 직접 호출하는 코드라 service-role 클라이언트 생성 패턴이 아니다 — 대상에서 제외.

각 치환 지점에서 기존 `import('@supabase/supabase-js')`의 동적 import 문 자체는 사라지고 헬퍼 쪽 정적 `import { getServiceRoleClient } from '@/lib/supabase/service-client'`로 대체된다.

#### 영향받는 테스트

문자열 검사 테스트 중 `SUPABASE_SERVICE_ROLE_KEY` / `createClient(supabase-js)` 패턴을 직접 assert하는 파일은 없음(grep 확인 — 0건). `comment-permission.test.mjs:8`은 `lib/actions/comments.ts` 소스를 읽지만 검사 대상은 `submitComment`의 비참여자 거부 에러 코드이지 클라이언트 생성부가 아니므로 영향 없음(파일이 바뀌어도 해당 검사 문자열은 그대로 남는다 — 실행 확인 필요).

### 6-B. `lib/queries/ratings.ts` 분리

새 파일 `frontend/src/lib/queries/ratings.ts`로 아래 4개 함수만 이동(`lib/queries/polls.ts`에서 삭제):

- `getRatingParticipantCounts`(polls.ts:86, 비export, 내부 호출부는 polls.ts:211 `getPollList`)
- `getMyRatingVoteCount`(polls.ts:414, export)
- `getRatingResults`(polls.ts:431, export)
- `getCurrentSeasonStatsForOptions`(polls.ts:497, 비export, 내부 호출부는 polls.ts:346 `getPollById`)

**타입 3종(`RatingResultItem`·`RatingCommentItem`·`PollPlayerSeasonStats`)도 함수 4개와 함께 `ratings.ts`로 옮긴다(2026-09-05 사용자 확정, 기존 "타입은 유지" 결정을 대체).** `PollDetail`(polls.ts)은 `current_season_stats` 필드에서 `PollPlayerSeasonStats`를 쓰므로 polls.ts는 `import type { PollPlayerSeasonStats } from './ratings'`로 가져온다. `getRatingResults`는 인자로 `PollDetail`을 받으므로 ratings.ts는 `import type { PollDetail } from './polls'`로 가져온다. 즉 polls.ts→ratings.ts는 런타임 함수 4개 + 타입 1개 import, ratings.ts→polls.ts는 타입 전용(`import type`) import 1개뿐 — **실측 확인: ratings.ts에는 polls.ts로부터의 런타임 import가 전혀 없다(타입만 가져옴, 컴파일 타임에 지워짐). 따라서 런타임 순환 참조는 애초에 발생하지 않는다** — `npm run build` 성공으로 확인됨(2026-09-05).

두 비export 헬퍼(`getRatingParticipantCounts`, `getCurrentSeasonStatsForOptions`)는 ratings.ts에서 `export`로 바꿔 polls.ts가 import할 수 있게 한다(다른 곳에서 새로 쓰라는 뜻은 아니고 모듈 경계를 넘기기 위한 최소 변경).

#### import 경로 수정 대상

- `app/polls/[id]/page.tsx:3` — `getMyRatingVoteCount, getRatingResults`를 `@/lib/queries/polls`가 아니라 `@/lib/queries/ratings`에서 import(같은 줄의 `getPollById, getVoteCounts, getMyVote`는 polls.ts에 남으므로 import문을 두 줄로 분리)
- `lib/queries/polls.ts` — 위 두 비export 함수를 ratings.ts에서 import

타입도 함께 옮기므로 `RatingResultItem`/`RatingCommentItem`/`PollPlayerSeasonStats`만 쓰는 `lib/mock/queries.ts`, `lib/mock/data.ts`, `components/composition/polls/OverallRatingResultView.tsx`의 해당 import도 `@/lib/queries/ratings`로 수정한다(같은 줄에 polls.ts 전용 타입이 섞여 있으면 두 줄로 분리).

#### `lib/queries/cache-policy.test.mjs:14` 판단

이 테스트는 `['polls.ts', 'player-pick-one.ts', 'fixtures.ts', 'predictions.ts']` 파일 목록이 전부 `unstable_cache`를 쓰는지 하드코딩으로 검사한다(공개 조회가 캐시되는지 보장하는 회귀 테스트). 이동하는 4개 함수는 `unstable_cache`를 쓰지 않는다(로그인 사용자 개인화 조회라 애초에 캐시 대상이 아님 — polls.ts에서 `unstable_cache`를 쓰는 곳은 `getPollList`/`getPollHomeSections`뿐, 실측 확인). 따라서 **`ratings.ts`를 이 목록에 추가하지 않는다** — 추가하면 `unstable_cache`가 없는 파일이라 테스트가 오히려 깨진다. 목록에 추가할 이유(캐시 의무 대상)가 없으므로 항목 그대로 둔다.

#### 영향받는 테스트

- `lib/queries/cache-policy.test.mjs` — 위 판단대로 수정 없음, 실행 확인만.
- `date-timezone-policy.test.mjs`는 `formatPollDate`만 검사(6-C 대상) — ratings 이동과 무관.
- 그 외 ratings 함수 4개를 문자열로 검사하는 테스트 없음(grep 확인).

### 6-C. `lib/polls/format.ts` 분리

새 파일 `frontend/src/lib/polls/format.ts`로 `ResultView.tsx`의 두 함수를 이동:

- `formatPollDate`(ResultView.tsx:40-48)
- `getOptionThumb`(ResultView.tsx:54-63, `PlayerRow`/`PollOptionRow` 타입은 `@/types/database`에서 그대로 import)

`ResultView.tsx`에서 두 함수 정의를 삭제하고 `import { formatPollDate, getOptionThumb } from '@/lib/polls/format'`로 대체(내부에서 계속 쓰므로). re-export는 두지 않는다 — 아래 두 파일도 import 경로를 새 파일로 직접 바꾼다:

- `components/composition/polls/PollClient.tsx:22` — `import { formatPollDate, getOptionThumb } from './ResultView'` → `from '@/lib/polls/format'`
- `components/composition/polls/UserPollEditForm.tsx:13` — 동일하게 경로 변경

#### 영향받는 테스트

- `lib/date-timezone-policy.test.mjs:70`: `['components/composition/polls/ResultView.tsx', 'export function formatPollDate']`로 위치를 고정 검사 — 새 위치 `['lib/polls/format.ts', 'export function formatPollDate']`로 단정문을 다시 쓴다.
- `components/composition/polls/result-view-figma-contract.test.mjs:66`: `assert.match(resultView, /getOptionThumb/)` — `ResultView.tsx` 소스에 `getOptionThumb` 문자열이 있는지만 보는 검사라 함수 정의든 `import { getOptionThumb } from '@/lib/polls/format'` 호출부든 문자열만 남아있으면 통과한다. 6-C에서 ResultView.tsx가 이 함수를 계속 import해서 쓰므로(정의를 지우고 호출은 남김) **그대로 통과 예상** — 재작성 불필요, 실행해서 확인만 한다.

### 검증

```bash
cd frontend && npm test && npm run lint && npm run build
```

### 불변 제약 영향 확인

- 투표 제출 후 수정 불가: 이 Step은 `lib/actions/vote.ts`·`lib/actions/predictions.ts`를 건드리지 않는다 — 영향 없음.
- 결과는 참여 후에만 공개: `getRatingResults`(6-B에서 이동) 호출부(`app/polls/[id]/page.tsx`)의 호출 조건은 그대로 두고 함수 위치만 바뀐다 — 영향 없음.
- 댓글은 투표 참여자만 작성 가능: 6-A가 `lib/actions/comments.ts`의 클라이언트 생성부만 바꾸고 `submitComment`의 참여자 검사 로직은 그대로 둔다 — 영향 없음.

### 완료 기준

- `npm test && npm run lint && npm run build` 전체 통과.
- `grep -rn "await import('@supabase/supabase-js')" frontend/src`가 0건(전부 `getServiceRoleClient()`로 치환됨).
- `frontend/src/lib/queries/ratings.ts`, `frontend/src/lib/polls/format.ts`, `frontend/src/lib/supabase/service-client.ts` 3개 파일 존재.

### 문서 갱신 대상 (구현 완료 후)

- `vault/99_old/AGENT_MAINTENANCE_GUIDE.md` — service-role 클라이언트 생성이 이제 `lib/supabase/service-client.ts`의 `getServiceRoleClient()` 단일 지점이라는 내용 추가(기존에 13곳 각자 생성했다는 서술이 있다면 갱신).
- `vault/99_old/SUPABASE_DATA_CONNECTIONS.md` — 평점(rating) 관련 조회 함수 위치가 `lib/queries/polls.ts`→`lib/queries/ratings.ts`로 이동했음을 반영.
- 새 파일 3개(`lib/supabase/service-client.ts`, `lib/queries/ratings.ts`, `lib/polls/format.ts`)를 두 문서의 "주요 파일 목록"에 추가.
- 이동한 함수 2개(`formatPollDate`, `getOptionThumb`)의 새 위치(`lib/polls/format.ts`)를 두 문서 어딘가에서 옛 위치(ResultView.tsx)로 언급하고 있다면 갱신.
