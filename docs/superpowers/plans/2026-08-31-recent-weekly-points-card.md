# 최근 5주 포인트 카드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 예측 목록(`/predictions`) 우측의 "내 순위" 카드(`RankingCard variant="mine"`)를, 내 최근 5주 주차별 포인트를 칸으로 보여주는 `WeeklyPointsCard`로 교체하고, 미사용이 되는 `RankingCard`의 `mine` variant를 문서까지 완전히 제거한다.

**Architecture:** 데이터는 기존 `week_leaderboard` view를 내 `user_id`로 필터해 최근 5주를 뽑는 신규 쿼리(`getMyRecentWeeklyPoints`)로 공급한다. 화면은 순수 로직(칸 채우기·색 단계)을 `.ts` 헬퍼로 분리해 단위 테스트하고, `WeeklyPointsCard.tsx`는 그 헬퍼를 써서 렌더만 한다. 칸 배경 4단계는 새 semantic 토큰 `bg-positive-solid`의 투명도 유틸리티(`/20 /40 /60 /80`)로 만든다.

**Tech Stack:** Next.js 14 App Router, Tailwind 3.4(semantic 토큰 + var 색 투명도 modifier), Supabase view, `node --test`(+`--experimental-strip-types`) 문자열/순수로직 테스트, Storybook.

---

## 배경 사실 (구현 전 반드시 인지)

- 투표(`/`)와 예측(`/predictions`)은 별개 도메인이다. 이 작업은 **예측 화면 안에서만** 이뤄진다.
- `RankingCard`의 `mine` variant는 앱에선 `PredictListClient.tsx:161` 한 곳에서만 쓰지만, Storybook(`RankingCard.stories.tsx`, `RankingCard.mdx`), `DESIGN-SYSTEM.md`, `WeekRankCard.mdx`에 문서로 박혀 있다 — 코드 삭제와 문서 갱신을 함께 해야 한다.
- 이 앱의 "브랜드" 색은 **파란색**(`--sem-fg-brand = blue-700`)이다. 첨부 이미지의 초록은 `positive`(green) 계열이며, 사용자가 초록 투명도 4단계로 확정했다.
- `positive` 배경 토큰은 `positive-weak`(#f4fff5) 하나뿐이라, 4단계용 solid 초록을 새로 노출한다.
- 테스트는 대부분 **소스 문자열을 정규식으로 검사**한다. 화면을 옮기면 로직이 옳아도 깨질 수 있으니, 깨진 테스트는 지우지 말고 새 자리 기준으로 단정문을 다시 쓴다.
- 커밋 전 `npm test`(전체) + `npm run lint`를 돌린다. Storybook은 이 환경 CI에 없으므로 스토리는 빌드가 아니라 리뷰로 확인한다.

## File Structure

- `frontend/src/app/globals.css` — 신규 토큰 `--sem-bg-positive-solid` 정의
- `frontend/tailwind.config.ts` — `bg-positive-solid` 노출
- `frontend/src/components/composition/predict/weekly-points.ts` — 순수 로직(타입 `WeeklyCell`, `toWeeklyCells`, `weeklyShadeLevel`)
- `frontend/src/components/composition/predict/weekly-points.test.mjs` — 순수 로직 단위 테스트
- `frontend/src/lib/queries/predictions.ts` — 타입 `WeeklyPoint` + 쿼리 `getMyRecentWeeklyPoints`
- `frontend/src/lib/mock/data.ts` — `MOCK_WEEKLY_POINTS`
- `frontend/src/components/composition/predict/WeeklyPointsCard.tsx` — 프레젠테이션 컴포넌트
- `frontend/src/storybook/contents/WeeklyPointsCard.stories.tsx` — 스토리
- `frontend/src/storybook/contents/WeeklyPointsCard.mdx` — 문서
- `frontend/src/app/predictions/page.tsx` — 쿼리 호출 + prop 전달
- `frontend/src/components/composition/predict/PredictListClient.tsx` — 카드 교체 + prop 수신
- `frontend/src/components/composition/predict/RankingCard.tsx` — `mine` variant 제거
- `frontend/src/storybook/contents/RankingCard.stories.tsx` — mine 스토리/컨트롤 제거
- `frontend/src/storybook/contents/RankingCard.mdx` — mine 서술 제거
- `frontend/src/storybook/DESIGN-SYSTEM.md` — RankingCard 행 갱신 + WeeklyPointsCard 행 추가
- `frontend/src/storybook/contents/WeekRankCard.mdx` — mine 상호참조 갱신
- `frontend/src/components/design-foundation.test.mjs` — `PREDICT_FILES`에 WeeklyPointsCard 추가

모든 경로는 `frontend/`가 루트다. 아래 `Run:` 명령은 `frontend/`에서 실행한다.

---

### Task 1: 초록 solid 배경 토큰 추가

**Files:**
- Modify: `src/app/globals.css:91-92` (positive 배경 정의 옆)
- Modify: `tailwind.config.ts:74-75` (`positive-weak` 옆)

- [ ] **Step 1: globals.css에 토큰 정의 추가**

`src/app/globals.css`의 `--sem-bg-positive-weak` 정의 바로 아래(현재 91-92행)에 한 줄 추가:

```css
    --sem-bg-positive-weak: #f4fff5;
    --sem-bg-positive-weak-pressed: var(--sem-bg-positive-weak);
    /* 최근 5주 포인트 카드의 칸 배경 4단계(투명도 /20 /40 /60 /80)의 기준 초록. brand-solid·critical-solid와 같은 패턴. */
    --sem-bg-positive-solid: var(--p-green-600);
```

- [ ] **Step 2: tailwind.config.ts에 backgroundColor 노출 추가**

`tailwind.config.ts`의 `"positive-weak-pressed"` 줄(현재 75행) 바로 아래에 추가:

```ts
        "positive-weak": "var(--sem-bg-positive-weak)",
        "positive-weak-pressed": "var(--sem-bg-positive-weak-pressed)",
        "positive-solid": "var(--sem-bg-positive-solid)",
```

- [ ] **Step 3: 토큰이 유효 클래스로 나오는지 확인**

Run: `npm run lint`
Expected: 통과(에러 없음). 새 토큰이 문법적으로 유효한지만 본다.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css tailwind.config.ts
git commit -m "feat: 최근 5주 카드용 bg-positive-solid 토큰 추가"
```

---

### Task 2: 칸 채우기·색 단계 순수 로직 (TDD)

`WeeklyPointsCard`가 쓸 순수 함수 두 개를 `.tsx`가 아닌 `.ts`로 분리해 단위 테스트한다(`npm test`가 `--experimental-strip-types`라 `.test.mjs`가 `.ts`를 직접 import한다).

**Files:**
- Create: `src/components/composition/predict/weekly-points.ts`
- Test: `src/components/composition/predict/weekly-points.test.mjs`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `src/components/composition/predict/weekly-points.test.mjs`:

```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { toWeeklyCells, weeklyShadeLevel } from './weekly-points.ts'

test('toWeeklyCells: 5주가 다 있으면 그대로 week 셀 5개', () => {
  const entries = [
    { weekKey: '2026-31', totalPoints: 12, played: true },
    { weekKey: '2026-32', totalPoints: 34, played: true },
    { weekKey: '2026-33', totalPoints: 0, played: true },
    { weekKey: '2026-34', totalPoints: 21, played: true },
    { weekKey: '2026-35', totalPoints: 8, played: true },
  ]
  const cells = toWeeklyCells(entries, 5)
  assert.equal(cells.length, 5)
  assert.deepEqual(cells.map(c => c.kind), ['week', 'week', 'week', 'week', 'week'])
  assert.equal(cells[4].points, 8)
})

test('toWeeklyCells: 부족분은 왼쪽을 empty로 채워 최신 주가 오른쪽에 온다', () => {
  const entries = [
    { weekKey: '2026-34', totalPoints: 21, played: true },
    { weekKey: '2026-35', totalPoints: 8, played: true },
  ]
  const cells = toWeeklyCells(entries, 5)
  assert.equal(cells.length, 5)
  assert.deepEqual(cells.map(c => c.kind), ['empty', 'empty', 'empty', 'week', 'week'])
  assert.equal(cells[3].points, 21)
  assert.equal(cells[4].points, 8)
})

test('toWeeklyCells: 5주보다 많으면 최신 5주만(뒤에서 5개)', () => {
  const entries = Array.from({ length: 7 }, (_, i) => ({ weekKey: `2026-3${i}`, totalPoints: i, played: true }))
  const cells = toWeeklyCells(entries, 5)
  assert.equal(cells.length, 5)
  assert.equal(cells[0].points, 2)
  assert.equal(cells[4].points, 6)
})

test('weeklyShadeLevel: 최고점 대비 비율로 1~4단계', () => {
  assert.equal(weeklyShadeLevel(10, 40), 1) // 0.25 이하
  assert.equal(weeklyShadeLevel(20, 40), 2) // 0.5 이하
  assert.equal(weeklyShadeLevel(30, 40), 3) // 0.75 이하
  assert.equal(weeklyShadeLevel(40, 40), 4) // 최고점
})

test('weeklyShadeLevel: 0점이나 maxPoints 0은 최하 단계(1)', () => {
  assert.equal(weeklyShadeLevel(0, 40), 1)
  assert.equal(weeklyShadeLevel(0, 0), 1)
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `node --experimental-strip-types --test src/components/composition/predict/weekly-points.test.mjs`
Expected: FAIL — `Cannot find module './weekly-points.ts'`

- [ ] **Step 3: 최소 구현 작성**

Create `src/components/composition/predict/weekly-points.ts`:

```ts
import type { WeeklyPoint } from '@/lib/queries/predictions'

/**
 * 카드에 그릴 칸 한 개. week = 참여 주(숫자 표시), empty = 5칸을 채우기 위한 빈 자리('-').
 * played=false인 week는 지금 실쿼리에선 안 나오지만(행이 있으면 곧 참여) 목·미래 확장을 위해 둔다 —
 * played=false면 화면에서 '-'로 그린다.
 */
export type WeeklyCell =
  | { kind: 'empty' }
  | { kind: 'week'; points: number; played: boolean }

/**
 * 최근 N주 포인트를 칸 배열(길이 = slots)로 만든다. 최신이 오른쪽에 오도록 부족분은 왼쪽을 empty로 채운다.
 * entries가 slots보다 많으면 뒤에서 slots개(최신)만 쓴다. entries는 오래된→최신 오름차순 전제.
 */
export function toWeeklyCells(entries: WeeklyPoint[], slots: number): WeeklyCell[] {
  const weeks: WeeklyCell[] = entries
    .slice(-slots)
    .map(e => ({ kind: 'week', points: e.totalPoints, played: e.played }))
  const pad = Math.max(0, slots - weeks.length)
  return [...Array.from({ length: pad }, (): WeeklyCell => ({ kind: 'empty' })), ...weeks]
}

/**
 * 한 주의 색 단계(1~4). 이 창(5주) 안 내 최고점 대비 비율로 나눈다. maxPoints가 0이면 전부 1.
 * 숫자가 정확한 값을 이미 보여주므로 색은 보조 강약이다.
 */
export function weeklyShadeLevel(points: number, maxPoints: number): 1 | 2 | 3 | 4 {
  if (maxPoints <= 0) return 1
  const ratio = points / maxPoints
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --experimental-strip-types --test src/components/composition/predict/weekly-points.test.mjs`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/composition/predict/weekly-points.ts src/components/composition/predict/weekly-points.test.mjs
git commit -m "feat: 최근 5주 카드 칸 채우기·색 단계 순수 로직 + 테스트"
```

---

### Task 3: 쿼리 `getMyRecentWeeklyPoints` + mock

**Files:**
- Modify: `src/lib/mock/data.ts` (MOCK_RANKING 아래에 추가)
- Modify: `src/lib/queries/predictions.ts` (mock import 확장 + 타입/쿼리 추가)

- [ ] **Step 1: mock 데이터 추가**

`src/lib/mock/data.ts`의 `MOCK_RANKING` 배열 정의 바로 아래에 추가(값은 가변 강약이 보이도록 의도적으로 다르게):

```ts
// ── 최근 5주 포인트 (week_leaderboard를 내 user_id로 필터한 결과와 같은 모양, 오래된→최신) ──
export const MOCK_WEEKLY_POINTS = [
  { weekKey: '2026-31', totalPoints: 12, played: true },
  { weekKey: '2026-32', totalPoints: 34, played: true },
  { weekKey: '2026-33', totalPoints: 0, played: true },
  { weekKey: '2026-34', totalPoints: 21, played: true },
  { weekKey: '2026-35', totalPoints: 8, played: true },
]
```

- [ ] **Step 2: predictions.ts의 mock import에 추가**

`src/lib/queries/predictions.ts` 상단의 mock import 구문에서 `MOCK_WEEKLY_POINTS`를 추가한다. 예: `import { MOCK_RANKING, MOCK_RESULTS } from '@/lib/mock/data'` → `import { MOCK_RANKING, MOCK_RESULTS, MOCK_WEEKLY_POINTS } from '@/lib/mock/data'` (실제 현재 import 목록에 맞춰 이름만 끼워 넣는다).

- [ ] **Step 3: 타입 + 쿼리 추가**

`src/lib/queries/predictions.ts`의 `getSeasonRanking`/`mockRanking` 블록(현재 223-252행) 아래, `MyResult` 정의(현재 259행) 위에 추가:

```ts
export type WeeklyPoint = {
  weekKey: string
  totalPoints: number
  /** week_leaderboard에 내 행이 있으면 true(그 주 채점됨). 화면에서 false면 '-'로 그린다. */
  played: boolean
}

type WeeklyPointQueryRow = {
  week_key: string
  total_points: number
}

/**
 * 내 최근 N주 주차별 포인트. week_leaderboard를 내 user_id로 필터해 week_key 최신순 N주를 읽고,
 * 화면 순서(오래된 주 → 이번 주)에 맞춰 오름차순으로 뒤집어 돌려준다. 조회된 행은 모두 played=true다
 * (view에 행이 있다 = 그 주 채점됨). 로그인 안 했으면 빈 배열. 사용자별 데이터라 캐시하지 않는다
 * (getMyResults·getMySeasonRow와 같은 이유).
 */
export async function getMyRecentWeeklyPoints(limit = 5): Promise<WeeklyPoint[]> {
  if (IS_MOCK) return MOCK_WEEKLY_POINTS.slice(-limit)

  const user = await getCurrentUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('week_leaderboard')
    .select('week_key, total_points')
    .eq('user_id', user.id)
    .order('week_key', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getMyRecentWeeklyPoints error:', error)
    return []
  }

  const rows = (data ?? []) as unknown as WeeklyPointQueryRow[]
  return rows
    .map(row => ({ weekKey: row.week_key, totalPoints: row.total_points, played: true }))
    .reverse()
}
```

- [ ] **Step 4: 타입체크/린트로 회귀 없음 확인**

Run: `npm run lint`
Expected: 통과. (이 쿼리는 서버 전용 모듈을 import하므로 단위 테스트는 붙이지 않는다 — 기존 predict 쿼리도 같은 이유로 단위 테스트가 없다. 순수 로직은 Task 2에서 이미 검증했다.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/data.ts src/lib/queries/predictions.ts
git commit -m "feat: getMyRecentWeeklyPoints 쿼리 + mock 추가"
```

---

### Task 4: `WeeklyPointsCard` 컴포넌트

**Files:**
- Create: `src/components/composition/predict/WeeklyPointsCard.tsx`

- [ ] **Step 1: 컴포넌트 작성**

Create `src/components/composition/predict/WeeklyPointsCard.tsx`:

```tsx
import { cn } from '@/lib/utils'
import type { WeeklyPoint } from '@/lib/queries/predictions'
import { toWeeklyCells, weeklyShadeLevel, type WeeklyCell } from './weekly-points'

interface WeeklyPointsCardProps {
  /** 내 최근 주차별 포인트(오래된→최신). 빈 배열이면 미참여/비로그인 상태로 본다. */
  entries: WeeklyPoint[]
  /** 칸 개수(기본 5). 부족분은 왼쪽 빈 칸으로 채운다. */
  slots?: number
  className?: string
}

// 칸 배경 4단계 — bg-positive-solid(초록)의 투명도. 숫자가 정확한 값을 보여주므로 색은 보조 강약이다.
const SHADE_CLASS = ['bg-positive-solid/20', 'bg-positive-solid/40', 'bg-positive-solid/60', 'bg-positive-solid/80'] as const

export function WeeklyPointsCard({ entries, slots = 5, className }: WeeklyPointsCardProps) {
  const cells = toWeeklyCells(entries, slots)
  // 색 단계 기준이 되는 최고점 — 이 창 안 played 주들의 최댓값. 비었으면 0.
  const maxPoints = Math.max(0, ...entries.filter(e => e.played).map(e => e.totalPoints))

  return (
    <div className={cn('rounded-lg border border-neutral-weak bg-surface p-4 text-left', className)}>
      <p className="m-0 mb-3 text-body-2-normal font-semibold text-neutral">최근 5주</p>

      {entries.length === 0 ? (
        <p className="m-0 text-caption-1 text-neutral-muted">아직 참여 기록이 없어요</p>
      ) : (
        <div className="flex items-stretch gap-1">
          {cells.map((cell, i) => (
            <WeekCell key={i} cell={cell} maxPoints={maxPoints} />
          ))}
        </div>
      )}
    </div>
  )
}

function WeekCell({ cell, maxPoints }: { cell: WeeklyCell; maxPoints: number }) {
  if (cell.kind === 'empty' || !cell.played) {
    return (
      <span className="flex aspect-square min-w-0 flex-1 items-center justify-center rounded-md bg-disabled text-body-2-normal font-medium text-neutral-muted">
        -
      </span>
    )
  }
  const level = weeklyShadeLevel(cell.points, maxPoints)
  return (
    <span
      className={cn(
        'flex aspect-square min-w-0 flex-1 items-center justify-center rounded-md text-body-2-normal font-semibold text-neutral',
        SHADE_CLASS[level - 1]
      )}
    >
      {cell.points}
    </span>
  )
}
```

- [ ] **Step 2: 린트 통과 확인**

Run: `npm run lint`
Expected: 통과. (렌더 검증은 Task 5의 Storybook + Task 6의 실화면 배선으로 확인한다. 토큰 준수는 Task 8에서 design-foundation 테스트에 이 파일을 걸어 자동 검사한다.)

- [ ] **Step 3: Commit**

```bash
git add src/components/composition/predict/WeeklyPointsCard.tsx
git commit -m "feat: WeeklyPointsCard 컴포넌트 추가"
```

---

### Task 5: Storybook 스토리 + 문서

**Files:**
- Create: `src/storybook/contents/WeeklyPointsCard.stories.tsx`
- Create: `src/storybook/contents/WeeklyPointsCard.mdx`

- [ ] **Step 1: 스토리 작성**

Create `src/storybook/contents/WeeklyPointsCard.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { WeeklyPointsCard } from '@/components/composition/predict/WeeklyPointsCard'
import type { WeeklyPoint } from '@/lib/queries/predictions'

// 실사용처(PredictListClient) 사이드 카드 폭에 맞춰 캔버스를 좁힌다.
const cardWidth = { decorators: [(Story: () => React.JSX.Element) => <div style={{ maxWidth: 358 }}><Story /></div>] }

const FIVE_WEEKS: WeeklyPoint[] = [
  { weekKey: '2026-31', totalPoints: 12, played: true },
  { weekKey: '2026-32', totalPoints: 34, played: true },
  { weekKey: '2026-33', totalPoints: 0, played: true },
  { weekKey: '2026-34', totalPoints: 21, played: true },
  { weekKey: '2026-35', totalPoints: 8, played: true },
]

const meta = {
  title: 'Composition/Predict/WeeklyPointsCard',
  component: WeeklyPointsCard,
  ...cardWidth,
  args: { entries: FIVE_WEEKS },
} satisfies Meta<typeof WeeklyPointsCard>

export default meta
type Story = StoryObj<typeof meta>

/** 최근 5주가 다 있는 기본 상태. 최고점(34) 대비 비율로 칸 배경이 진해지고, 0점 주는 최하 단계 + 숫자 0이다. */
export const Default: Story = {}

/** 시즌 초반 — 참여 주가 2주뿐. 부족분은 왼쪽 '-' 빈 칸으로 채워 최신 주가 오른쪽에 온다. */
export const FewerWeeks: Story = {
  args: {
    entries: [
      { weekKey: '2026-34', totalPoints: 21, played: true },
      { weekKey: '2026-35', totalPoints: 8, played: true },
    ],
  },
}

/** 미참여/비로그인 — 배열이 비면 칸 대신 안내 문구만 남는다(RankingCard 빈 상태와 같은 문구). */
export const Empty: Story = {
  args: { entries: [] },
}
```

- [ ] **Step 2: 문서 작성**

Create `src/storybook/contents/WeeklyPointsCard.mdx`:

```mdx
import { Meta, Canvas } from '@storybook/addon-docs/blocks'
import * as WeeklyPointsCardStories from './WeeklyPointsCard.stories'

<Meta of={WeeklyPointsCardStories} />

# WeeklyPointsCard

승부예측 예측 목록(`/predictions`) 데스크탑 사이드에서 [RankingCard](?path=/docs/composition-predict-rankingcard--docs)(전체 랭킹 TOP N) 아래에 놓이는 **내 최근 5주 포인트 카드**다. `src/components/composition/predict/WeeklyPointsCard.tsx`이고, 예전에 여기 있던 `RankingCard`의 "내 순위" 카드를 대체한다.

`WeeklyPoint[]`(오래된→최신)를 받아 칸으로만 그리는 프레젠테이션 컴포넌트다. 데이터는 `lib/queries/predictions.ts`의 `getMyRecentWeeklyPoints()`가 `week_leaderboard`를 내 `user_id`로 필터해 공급한다.

## 기본

<Canvas of={WeeklyPointsCardStories.Default} />

칸 안에 그 주 포인트 숫자를 그대로 보여주고, **배경 진하기는 이 5주 안 내 최고점 대비 비율**로 4단계다(`bg-positive-solid`의 투명도 `/20 /40 /60 /80`). 숫자가 정확한 값을 이미 보여주므로 색은 보조 강약이다 — 저조한 주만 있는 창에서도 그중 최고 주가 진하게 나온다는 한계는 감수한다. 0점 주는 최하 단계 + 숫자 `0`으로 그린다.

## 5주 미만·미참여

<Canvas of={WeeklyPointsCardStories.FewerWeeks} />

참여 주가 5개보다 적으면 항상 5칸을 유지하되 **부족분을 왼쪽에 흐린 '-' 빈 칸**으로 채운다. 그래야 최신 주가 늘 오른쪽 끝에 온다.

<Canvas of={WeeklyPointsCardStories.Empty} />

배열이 비면(비로그인·미참여) 칸을 그리지 않고 `아직 참여 기록이 없어요`만 남는다.

## 로직 분리

칸 채우기(`toWeeklyCells`)와 색 단계(`weeklyShadeLevel`)는 `predict/weekly-points.ts`의 순수 함수로 빼서 단위 테스트한다(`weekly-points.test.mjs`). 컴포넌트는 그 결과를 렌더만 한다.
```

- [ ] **Step 3: 린트 통과 확인**

Run: `npm run lint`
Expected: 통과.

- [ ] **Step 4: Commit**

```bash
git add src/storybook/contents/WeeklyPointsCard.stories.tsx src/storybook/contents/WeeklyPointsCard.mdx
git commit -m "docs: WeeklyPointsCard Storybook 스토리 + 문서"
```

---

### Task 6: 예측 목록에 배선(카드 교체)

**Files:**
- Modify: `src/app/predictions/page.tsx`
- Modify: `src/components/composition/predict/PredictListClient.tsx:14,158-162`
- Modify: `src/components/primitives/navigation-loading.tsx:308` (스켈레톤 주석 정확화)

- [ ] **Step 1: page.tsx에서 쿼리 호출 + prop 전달**

`src/app/predictions/page.tsx`를 아래로 바꾼다(신규 쿼리 import + Promise.all에 추가 + prop 전달):

```tsx
import { AppHeader } from '@/components/composition/common/AppHeader'
import { PredictListClient } from '@/components/composition/predict/PredictListClient'
import { getFixtureWeeks } from '@/lib/queries/fixtures'
import { getMyPredictions, getSeasonRanking, getMyRecentWeeklyPoints } from '@/lib/queries/predictions'

export default async function PredictionsPage() {
  const [weeks, myPredictions, ranking, weeklyPoints] = await Promise.all([
    getFixtureWeeks(),
    getMyPredictions(),
    getSeasonRanking(),
    getMyRecentWeeklyPoints(),
  ])

  return (
    <>
      <AppHeader showAuth={false} />
      <main className="min-h-[calc(100vh-62px)] bg-page">
        <PredictListClient weeks={weeks} myPredictions={myPredictions} ranking={ranking} weeklyPoints={weeklyPoints} />
      </main>
    </>
  )
}
```

- [ ] **Step 2: PredictListClient에서 prop 수신 + 카드 교체**

`src/components/composition/predict/PredictListClient.tsx`:

1. import 추가(현재 14행 `import { RankingCard } from './RankingCard'` 아래):

```tsx
import { RankingCard } from './RankingCard'
import { WeeklyPointsCard } from './WeeklyPointsCard'
import type { WeeklyPoint } from '@/lib/queries/predictions'
```

2. props 타입에 `weeklyPoints: WeeklyPoint[]` 추가하고 함수 시그니처에서 구조분해한다(현재 props 정의/시그니처에 `ranking`이 있는 자리 옆에 같은 방식으로 추가).

3. 사이드 카드 블록(현재 158-162행)에서 mine 카드를 교체:

```tsx
        <div className="hidden flex-col gap-4 sm:flex">
          <PlayGuide />
          <RankingCard variant="top3" entries={ranking} />
          <WeeklyPointsCard entries={weeklyPoints} />
        </div>
```

> 참고: `RankingCard variant="top3"`의 `variant` prop은 Task 7에서 제거된다. 이 Task에서는 아직 남겨 두고, Task 7에서 `<RankingCard entries={ranking} />`로 함께 정리한다.

- [ ] **Step 3: 스켈레톤 주석 정확화**

`src/components/primitives/navigation-loading.tsx`의 현재 308행 주석 `{/* RankingCard 2개 — 데스크탑에서만, 아직 entries가 비어 제목 + 안내문만 나온다 */}`를 실제 구성에 맞게 바꾼다:

```tsx
        {/* 사이드 카드 2개(RankingCard + WeeklyPointsCard) — 데스크탑에서만, 아직 데이터가 비어 제목 + 안내문만 나온다 */}
```

- [ ] **Step 4: 관련 테스트 실행**

Run: `npm test`
Expected: 통과. 만약 `design-foundation` 또는 predict 관련 테스트가 "내 순위"/mine을 단정해 깨지면, 이는 Task 7·8에서 정리하는 대상이다 — 이 Task 커밋 시점에서 깨진 게 있으면 어떤 파일이 깨졌는지 기록만 하고 Task 7·8에서 확실히 초록으로 만든다.

- [ ] **Step 5: mock 모드 실화면 확인**

Run: `npm run dev` (다른 터미널) 후 `/predictions` 데스크탑 폭에서 사이드에 "최근 5주" 카드가 5칸(숫자 12/34/0/21/8, 34가 가장 진함)으로 뜨는지 눈으로 확인. 확인 후 dev 서버 종료.

- [ ] **Step 6: Commit**

```bash
git add src/app/predictions/page.tsx src/components/composition/predict/PredictListClient.tsx src/components/primitives/navigation-loading.tsx
git commit -m "feat: 예측 목록 '내 순위' 카드를 최근 5주 포인트 카드로 교체"
```

---

### Task 7: `RankingCard` mine variant 완전 제거 + 문서 갱신

이 시점부터 `mine` variant는 앱에서 안 쓰인다. 컴포넌트·스토리·문서에서 함께 걷어낸다.

**Files:**
- Modify: `src/components/composition/predict/RankingCard.tsx`
- Modify: `src/components/composition/predict/PredictListClient.tsx` (Task 6에서 남긴 `variant="top3"` 제거)
- Modify: `src/storybook/contents/RankingCard.stories.tsx`
- Modify: `src/storybook/contents/RankingCard.mdx`
- Modify: `src/storybook/DESIGN-SYSTEM.md:109`
- Modify: `src/storybook/contents/WeekRankCard.mdx:71`

- [ ] **Step 1: RankingCard.tsx에서 mine 분기 제거**

`src/components/composition/predict/RankingCard.tsx`의 4-52행(타입 + 컴포넌트 본체)을 아래로 교체한다. `RankingCardVariant` export, `variant` prop, `entriesOf`, mine 제목/빈문구 분기를 없애고 top3 동작만 남긴다. `RankHeaderRow`/`RankRow`/`RankDelta`(58행 이후)는 그대로 둔다.

```tsx
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RankingEntry {
  rank: number
  name: string
  totalPoints: number
  isMe?: boolean
  avatarUrl?: string | null
  /** null/undefined = 변동 표시 안 함. 양수 = ▲(상승), 음수 = ▼(하락) */
  delta?: number | null
}

interface RankingCardProps {
  /** 시즌 누적 랭킹(또는 필요한 범위). 상위 `limit`명을 뽑아 보여준다. */
  entries: RankingEntry[]
  /** 노출할 인원 수 (기본 3). 제목 "전체 랭킹 TOP N"도 이 값에서 나온다. */
  limit?: number
  className?: string
}

export function RankingCard({ entries, limit = 3, className }: RankingCardProps) {
  const rows = entries.slice(0, limit)

  return (
    <div className={cn('rounded-lg border border-neutral-weak bg-surface p-4 text-left', className)}>
      <p className="m-0 mb-3 text-body-2-normal font-semibold text-neutral">전체 랭킹 TOP {limit}</p>

      {rows.length === 0 ? (
        <p className="m-0 text-caption-1 text-neutral-muted">아직 랭킹 데이터가 없어요</p>
      ) : (
        <>
          <RankHeaderRow />
          {rows.map(entry => (
            <RankRow key={entry.rank} entry={entry} />
          ))}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: PredictListClient에서 variant prop 제거**

`src/components/composition/predict/PredictListClient.tsx`의 사이드 카드에서:

```tsx
          <RankingCard variant="top3" entries={ranking} />
```
를
```tsx
          <RankingCard entries={ranking} />
```
로 바꾼다.

- [ ] **Step 3: RankingCard.stories.tsx 정리**

`src/storybook/contents/RankingCard.stories.tsx`에서:

1. `meta.argTypes`에서 `variant` 항목(44-49행) 전체 삭제. `limit` 항목의 설명에서 `variant="top3"에서만 쓰인다 ... mine은 무시.`를 `제목 "전체 랭킹 TOP N"도 이 값으로 만든다.`로 바꾼다.
2. `meta.args`에서 `variant: 'top3',`(57행) 삭제.
3. `Top3` 스토리를 `args: { variant: 'top3' }` → `args: {}`로 바꾼다.
4. `Mine` 스토리(68-75행), `StackedPair` 스토리(77-94행), `EmptyMine` 스토리(122-129행)를 각각 **주석 블록째로 삭제**.
5. 남는 스토리(`Top10`, `FewerThanLimit`, `EmptyTop3`, `RankDeltaCases`, `AvatarsAndLongName`)에서 `variant: 'top3',` 인자를 모두 삭제(예: `Top10`은 `args: { variant: 'top3', limit: 10 }` → `args: { limit: 10 }`, `EmptyTop3`은 `args: { variant: 'top3', entries: [] }` → `args: { entries: [] }`, `RankDeltaCases`·`AvatarsAndLongName`도 `variant: 'top3',` 줄만 제거).

- [ ] **Step 4: RankingCard.mdx 정리**

`src/storybook/contents/RankingCard.mdx`에서 mine 관련 서술을 걷어낸다:

1. 8행 인트로 문장 `사용처는 ...에서 \`top3\`·\`mine\` 두 개를 나란히 놓는 것이다.`를 `사용처는 \`components/composition/predict/PredictListClient.tsx\`(예측 탭 데스크탑 사이드)에서 전체 랭킹 TOP N을 보여주는 것이다. 그 아래 "내 최근 5주 포인트"는 별개 컴포넌트([WeeklyPointsCard](?path=/docs/composition-predict-weeklypointscard--docs))다.`로 교체.
2. `## variant 2종 — 같은 배열을 그대로 두 번 넘긴다` 섹션(18-32행) 전체를 삭제하고, 그 자리에 기본 캔버스 하나만 남긴다:

```mdx
## 기본

<Canvas of={RankingCardStories.Top3} />

`entries.slice(0, limit)` 상위 `limit`명 + 컬럼 헤더(순위/총점)를 그린다. 제목은 `전체 랭킹 TOP {limit}`이고, 비면 `아직 랭킹 데이터가 없어요`가 뜬다.
```

3. `## 비어 있는 상태 2가지` 섹션(46-51행)을 아래로 교체(이제 상태가 하나다):

```mdx
## 비어 있는 상태

<Canvas of={RankingCardStories.EmptyTop3} />

참여자가 0명이면 헤더 행조차 렌더하지 않고 안내 문구만 남는다.
```

4. `## 알려진 제약`의 mine 관련 불릿 `- \`mine\` variant는 \`isMe\` 항목이 여러 개일 때를 고려하지 않는다(\`find\`로 첫 항목만).`(72행) 삭제.

- [ ] **Step 5: DESIGN-SYSTEM.md 갱신**

`src/storybook/DESIGN-SYSTEM.md:109`의 RankingCard 행에서 variant 설명을 고치고, 바로 아래(WeekRankCard 행 위나 아래 적절한 자리)에 WeeklyPointsCard 행을 추가:

```md
| RankingCard | 승부예측 시즌 누적 랭킹 카드(전체 랭킹 TOP N). | `components/composition/predict/RankingCard.tsx` | `contents/RankingCard.mdx` |
| WeeklyPointsCard | 예측 목록 사이드의 내 최근 5주 포인트 카드. 칸 숫자 + 최고점 대비 초록 4단계 | `components/composition/predict/WeeklyPointsCard.tsx` | `contents/WeeklyPointsCard.mdx` |
```

- [ ] **Step 6: WeekRankCard.mdx 상호참조 갱신**

`src/storybook/contents/WeekRankCard.mdx:71`의 문장 `여기에 "너는 참여하지 않았다"는 안내는 없다 — RankingCard의 \`mine\` variant가 갖고 있는 미참여 문구에 해당하는 게 이 카드에는 없다.`를 아래로 바꾼다(사라진 mine을 참조하지 않게):

```md
`isMe`가 붙은 행이 없으면(미로그인·미참여) 강조도 `⋯` 보강도 전부 사라지고 목록만 남는다. 여기에 "너는 참여하지 않았다"는 별도 안내는 없다.
```

- [ ] **Step 7: 린트 통과 확인**

Run: `npm run lint`
Expected: 통과. (`RankingCardVariant`를 import하던 곳이 없는지도 함께 확인 — 없으면 그대로 통과.)

- [ ] **Step 8: Commit**

```bash
git add src/components/composition/predict/RankingCard.tsx src/components/composition/predict/PredictListClient.tsx src/storybook/contents/RankingCard.stories.tsx src/storybook/contents/RankingCard.mdx src/storybook/DESIGN-SYSTEM.md src/storybook/contents/WeekRankCard.mdx
git commit -m "refactor: RankingCard mine variant 제거 + 문서 갱신"
```

---

### Task 8: design-foundation 테스트에 새 컴포넌트 등록 + 전체 검증

**Files:**
- Modify: `src/components/design-foundation.test.mjs:249-263` (PREDICT_FILES)

- [ ] **Step 1: PREDICT_FILES에 WeeklyPointsCard 추가**

`src/components/design-foundation.test.mjs`의 `PREDICT_FILES` 배열(현재 249-263행)에서 `RankingCard.tsx` 줄 아래에 추가:

```ts
  'components/composition/predict/RankingCard.tsx',
  'components/composition/predict/WeeklyPointsCard.tsx',
  'components/composition/predict/WeekRankCard.tsx',
```

> `weekly-points.ts`는 JSX/색 클래스가 없는 순수 로직이라 이 목록(색·타이포 토큰 검사)에 넣지 않는다.

- [ ] **Step 2: 전체 테스트 실행**

Run: `npm test`
Expected: 전체 PASS. 특히 `design-foundation`의 "arbitrary typography or hardcoded visual colors" 검사가 `WeeklyPointsCard.tsx`를 통과해야 한다(`bg-positive-solid/20` 등은 대괄호 임의값이 아니라 정규 유틸리티라 통과). 혹시 `bg-[...]`/`text-[...]` 형태가 남아 걸리면 semantic 토큰으로 바꾼다.

- [ ] **Step 3: 린트 실행**

Run: `npm run lint`
Expected: 통과.

- [ ] **Step 4: Commit**

```bash
git add src/components/design-foundation.test.mjs
git commit -m "test: WeeklyPointsCard를 predict 토큰 검사 목록에 등록"
```

---

## Self-Review 결과

- **Spec 커버리지:** 데이터(신규 쿼리 T3, mock T3) / 칸 숫자+색 4단계(T1 토큰, T2 로직, T4 컴포넌트) / 왼쪽 빈칸 채우기(T2) / 순서 오래된→최신(T2) / 요약줄 없음(T4에 없음) / 빈 상태 문구(T4) / mine 제거(T7) / 테스트 갱신(T6·T8) — 모두 태스크 있음.
- **색 토큰 결정:** spec의 "열린 결정" 3건 중 색 토큰은 `bg-positive-solid`(green-600) 투명도 4단계로 확정(사용자 승인), 구간 경계 0.25/0.5/0.75 확정(T2), mine 제거 범위는 완전 제거로 확정(T7).
- **타입 일관성:** `WeeklyPoint`(predictions.ts) → `weekly-points.ts`/`WeeklyPointsCard.tsx`/`PredictListClient.tsx`/`page.tsx`에서 동일 이름 사용. `WeeklyCell`은 `weekly-points.ts` 정의를 `WeeklyPointsCard.tsx`가 import. `toWeeklyCells`/`weeklyShadeLevel` 시그니처 T2 정의와 T4 사용 일치.
- **플레이스홀더:** 없음. 모든 코드 단계에 실제 코드 포함.

## 열린 결정 (구현 중 확인)

- 칸 배경 base 초록을 green-600으로 잡았다. 실제로 흰 카드 위에서 4단계 대비가 약하면 green-500↔700 사이로 조정(값만 `--sem-bg-positive-solid`에서 바꾸면 됨). — 근거: 육안 확인 필요(T6 Step 5).
- 투명도 단계 20/40/60/80은 다크 텍스트(`text-neutral`) 가독성을 지키려 solid(/100)를 안 쓴 것. 최상단을 더 진하게 원하면 텍스트를 흰색으로 바꾸는 결정이 따라온다.
