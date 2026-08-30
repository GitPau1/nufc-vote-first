# 툰 예산제 2단계 — 비용·예산 검증·제출 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 선수마다 '툰 비용'(1~3)을 두고, 승부예측 제출 시 **한 경기 3픽의 비용 합이 5툰을 넘지 못하게** 검증한다. 뽑을 때의 비용은 예측 행에 스냅샷한다.

**Architecture:** 비용은 `season_squads.pick_cost`(신규 컬럼)에 있고, 서버가 제출 시 후보 목록에서 비용을 다시 읽어 검증·스냅샷한다(배당과 같은 신뢰 경계). 예산 검증은 순수 함수 `buildPredictionRows`에서 경기별로 이뤄져 단위 테스트가 쉽다. 점수 산식(1단계)과 무관 — 비용은 순수 예산 제약이다.

**Tech Stack:** TypeScript(순수 함수 + node:test), Postgres 마이그레이션.

**전제:** 1단계(`2026-08-30-toon-scoring-core.md`) 커밋 완료. 이 계획은 배당(`prediction_multiplier` / `*_multiplier`)을 **제거하지 않고 그대로 둔다** — UI가 아직 배당을 읽으므로(결과 화면 `×배당` 배지) 제거는 3단계(UI) 이후 별도 정리. 여기서는 비용을 **추가**만 한다.

**설계 근거:** `docs/superpowers/specs/2026-08-30-toon-budget-prediction-design.md` (C-2 신규 컬럼 `pick_cost`, D-1 비용 스냅샷, 예산 5툰).

**범위 밖:** 비용/예산의 화면 표시·순위 표시(3단계), 월별 비용 산정 잡(4단계). 월별 잡 전까지 `pick_cost`는 기본값이며, 이 단계는 "예산 검증 배관"까지만 만든다.

---

## 사전 확인 (근거)

- 제출 순수 함수: `frontend/src/lib/predictions/submit.ts` — `buildPredictionRows`(`:53-90`), `resolvePicks`(`:97-115`), `PredictionInsertRow`(`:24-34`), `SubmitValidationError`(`:36-41`).
- 후보 타입: `frontend/src/lib/predictions/candidates.ts:17-28` (`Candidate`).
- 후보 조회: `frontend/src/lib/queries/squads.ts` — `SQUAD_COLUMNS`(`:16-17`), `SquadCandidateRow`(`:19-29`), `toPickCandidates`(`:33-57`).
- 제출 액션: `frontend/src/lib/actions/predictions.ts` — `SubmitPredictionResult` 유니온(`:12-25`), insert(`:77-79`).
- 수동 타입: `frontend/src/types/database.ts` — `season_squads.Row`(`:256-271`), `predictions.Row`(`:277-290`).
- mock: `frontend/src/lib/mock/data.ts` — `squadMember` 헬퍼(`:349-`), `MOCK_SQUAD`(`:375-388`).
- 제출 단위는 주(week)지만 픽·검증은 **경기별**(`resolvePicks`가 경기 하나의 3픽을 확정) → 예산도 경기별로 건다.

---

## Task 1: 예산 검증 순수 함수 (TDD)

**Files:**
- Test: `frontend/src/lib/predictions/submit.test.mjs`
- Modify: `frontend/src/lib/predictions/submit.ts`
- Modify: `frontend/src/lib/predictions/candidates.ts:17-28`

- [ ] **Step 1: 실패 테스트 작성**

`frontend/src/lib/predictions/submit.test.mjs`의 `CANDIDATES` 상수(`:25-29`)에 비용을 넣고, 예산 테스트를 추가한다. 먼저 `CANDIDATES`를 교체:

```js
const CANDIDATES = {
  DEF: [{ id: 4, name: '보트만', position: 'DEF', multiplier: 2.1, cost: 2 }],
  MID: [{ id: 39, name: '기마랑이스', position: 'MID', multiplier: 1.7, cost: 2 }],
  FWD: [{ id: 14, name: '이사크', position: 'FWD', multiplier: 1.3, cost: 1 }],
}
```

첫 테스트(`:54-73`)의 배당 스냅샷 단정 바로 아래에 비용 스냅샷 단정을 추가(`assert.equal(result.rows[0].def_player_id, 4)` 앞):

```js
  // 비용도 후보 목록에서 스냅샷된다(점수엔 무관, 예산·기록용).
  assert.deepEqual(
    [result.rows[0].def_cost, result.rows[0].mid_cost, result.rows[0].fwd_cost],
    [2, 2, 1],
  )
```

DOUBLE 테스트의 추가 후보 고든(`:78`)과 중복 테스트의 추가 보트만(`:188`)에도 `cost`를 넣는다:

```js
  // :78 고든 (cost 1 — 더블 매치위크 9002 경기가 DEF2+MID2+고든 ≤ 5툰 예산에 들어가야 함)
  FWD: [...CANDIDATES.FWD, { id: 10, name: '고든', position: 'FWD', multiplier: 1.6, cost: 1 }],
  // :188 보트만(MID로 중복)
  MID: [...CANDIDATES.MID, { id: 4, name: '보트만', position: 'MID', multiplier: 2.1, cost: 2 }],
```

파일 끝에 예산 초과 테스트를 추가:

```js
test('한 경기 3픽 비용 합이 5툰을 넘으면 거절된다 (경기별 예산)', () => {
  const candidates = {
    DEF: [{ id: 4, name: '보트만', position: 'DEF', multiplier: 2.1, cost: 3 }],
    MID: [{ id: 39, name: '기마랑이스', position: 'MID', multiplier: 1.7, cost: 3 }],
    FWD: [{ id: 14, name: '이사크', position: 'FWD', multiplier: 1.3, cost: 1 }],
  }
  // 3 + 3 + 1 = 7 > 5
  assert.deepEqual(
    buildPredictionRows(SINGLE, { scores: { 9001: [2, 1] }, picks: picksFor('9001') }, candidates),
    { error: 'over_budget' },
  )
})

test('비용 합이 정확히 5툰이면 통과한다 (경계값)', () => {
  const candidates = {
    DEF: [{ id: 4, name: '보트만', position: 'DEF', multiplier: 2.1, cost: 3 }],
    MID: [{ id: 39, name: '기마랑이스', position: 'MID', multiplier: 1.7, cost: 1 }],
    FWD: [{ id: 14, name: '이사크', position: 'FWD', multiplier: 1.3, cost: 1 }],
  }
  const result = buildPredictionRows(SINGLE, { scores: { 9001: [2, 1] }, picks: picksFor('9001') }, candidates)
  assert.ok(!('error' in result), JSON.stringify(result))
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npm run test:vote-eligibility 2>/dev/null; node --experimental-strip-types --test src/lib/predictions/submit.test.mjs 2>&1 | tail -12`
(개별 script가 없으므로 파일을 직접 실행.)
Expected: FAIL — `over_budget` 미구현으로 예산 테스트가 깨지고, `def_cost` 단정이 `undefined`라 첫 테스트도 깨진다.

- [ ] **Step 3: Candidate 타입에 cost 추가**

`frontend/src/lib/predictions/candidates.ts:17-28`의 `Candidate` 타입에 `cost`를 추가(`multiplier` 아래):

```ts
export type Candidate = {
  /** season_squads.fotmob_player_id — predictions.{def,mid,fwd}_player_id에 그대로 들어간다 */
  id: number
  name: string
  position: Position
  /** 제출 시 서버가 DB 값을 다시 읽어 스냅샷한다 — 화면 표시용으로만 믿는다 */
  multiplier: number
  /** 툰 비용(1~3). 순수 예산 제약이며 점수와 무관. 서버가 제출 시 재확인·스냅샷한다. */
  cost: number
  squadNumber: number | null
  nationality: string | null
  age: number | null
  photoUrl: string | null
}
```

- [ ] **Step 4: submit.ts에 예산 검증·비용 스냅샷 구현**

`frontend/src/lib/predictions/submit.ts` 수정:

(a) `MAX_SCORE` 아래(`:14`)에 예산 상수 추가:

```ts
export const MAX_SCORE = 20

/** 한 경기 3픽 비용의 합 상한(툰). 설계: 툰 예산제. */
export const BUDGET = 5
```

(b) `SubmitValidationError`(`:36-41`)에 `'over_budget'` 추가:

```ts
export type SubmitValidationError =
  | 'closed'
  | 'incomplete'
  | 'invalid_score'
  | 'duplicate_picks'
  | 'unknown_player'
  | 'over_budget'
```

(c) `PredictionInsertRow`(`:24-34`)에 비용 필드 추가(multiplier 아래):

```ts
export type PredictionInsertRow = {
  fixture_id: number
  home_score: number
  away_score: number
  def_player_id: number
  mid_player_id: number
  fwd_player_id: number
  def_multiplier: number
  mid_multiplier: number
  fwd_multiplier: number
  def_cost: number
  mid_cost: number
  fwd_cost: number
}
```

(d) `buildPredictionRows`의 픽 확정 뒤(`:73` `const { def, mid, fwd } = resolved` 다음)에 예산 검증을 넣고, `rows.push`에 비용을 채운다:

```ts
    const resolved = resolvePicks(input.picks[match.id], candidates)
    if ('error' in resolved) return { error: resolved.error }
    const { def, mid, fwd } = resolved

    // 경기별 예산: 3픽 비용 합이 5툰을 넘으면 제출 불가.
    if (def.cost + mid.cost + fwd.cost > BUDGET) return { error: 'over_budget' }

    rows.push({
      fixture_id: Number(match.id),
      home_score: match.isHome ? ourScore : theirScore,
      away_score: match.isHome ? theirScore : ourScore,
      def_player_id: def.id,
      mid_player_id: mid.id,
      fwd_player_id: fwd.id,
      def_multiplier: def.multiplier,
      mid_multiplier: mid.multiplier,
      fwd_multiplier: fwd.multiplier,
      def_cost: def.cost,
      mid_cost: mid.cost,
      fwd_cost: fwd.cost,
    })
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && node --experimental-strip-types --test src/lib/predictions/submit.test.mjs 2>&1 | tail -8`
Expected: PASS — 모든 submit 테스트 통과(예산 초과 거절 + 경계값 통과 + 비용 스냅샷 포함).

---

## Task 2: 후보 조회에 비용 싣기

**Files:**
- Modify: `frontend/src/lib/queries/squads.ts:16-29`, `:33-49`

- [ ] **Step 1: SQUAD_COLUMNS·행 타입에 pick_cost 추가**

`frontend/src/lib/queries/squads.ts:16-17`:

```ts
const SQUAD_COLUMNS =
  'fotmob_player_id, name, name_ko, shirt_number, position, nationality_name, date_of_birth, prediction_multiplier, pick_cost'
```

`SquadCandidateRow`(`:19-29`)의 Pick 목록에 `'pick_cost'` 추가(`'prediction_multiplier'` 아래):

```ts
  | 'prediction_multiplier'
  | 'pick_cost'
>
```

- [ ] **Step 2: toPickCandidates가 cost를 채우게**

`frontend/src/lib/queries/squads.ts:39-48`의 push 객체에 `cost`를 추가(`multiplier` 아래):

```ts
    grouped[row.position].push({
      id: row.fotmob_player_id,
      name: row.name_ko?.trim() || row.name,
      position: row.position,
      multiplier: Number(row.prediction_multiplier),
      cost: Number(row.pick_cost),
      squadNumber: row.shirt_number,
      nationality: row.nationality_name,
      age: ageFrom(row.date_of_birth, now),
      photoUrl: playerPhotoUrl(row.fotmob_player_id),
    })
```

(정렬 기준은 이번 단계에서 바꾸지 않는다 — `:52-53`의 multiplier 정렬 유지. 표시·정렬은 3단계에서 다룬다.)

---

## Task 3: 마이그레이션 — pick_cost + 비용 스냅샷 컬럼

**Files:**
- Create: `supabase/migrations/20260830130000_toon_pick_cost.sql`
  (1단계 마이그레이션 `20260830120000`보다 뒤 타임스탬프.)

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/20260830130000_toon_pick_cost.sql`:

```sql
-- 툰 예산제 2단계: 선수 비용(pick_cost) + 예측 비용 스냅샷.
-- 설계: docs/superpowers/specs/2026-08-30-toon-budget-prediction-design.md (C-2, D-1)
-- 비용은 순수 예산 제약이라 점수(prediction_results)와 무관하다.

-- 선수 비용 1~3툰. 실제 값은 월별 산정 잡(4단계)이 채운다 — 그전까지 기본 2.
alter table public.season_squads
  add column pick_cost smallint not null default 2 check (pick_cost between 1 and 3);

comment on column public.season_squads.pick_cost is
  '승부예측 툰 비용(1~3). 순수 예산 제약(점수 무관). 월별 산정 잡이 직전 달 평균 평점 순위로 갱신. '
  '기본값 2는 "아직 산정 전".';

-- 제출 시점 비용 스냅샷. 비용은 월별 가변이라 과거 스쿼드의 그 시점 비용을 보존한다(D-1).
-- 점수엔 무관. 기존 행은 기본 2로 백필(소급 무효 없음 — 설계 3.4).
alter table public.predictions
  add column def_cost smallint not null default 2 check (def_cost between 1 and 3),
  add column mid_cost smallint not null default 2 check (mid_cost between 1 and 3),
  add column fwd_cost smallint not null default 2 check (fwd_cost between 1 and 3);

comment on column public.predictions.def_cost is
  '제출 시점 DEF 픽의 툰 비용 스냅샷(점수 무관, 기록·표시용). mid_cost/fwd_cost 동일.';
```

- [ ] **Step 2: 정적 점검**

Run: `grep -c "between 1 and 3" supabase/migrations/20260830130000_toon_pick_cost.sql`
Expected: `4` (pick_cost + def/mid/fwd_cost).

---

## Task 4: 롤백 SQL

**Files:**
- Create: `supabase/rollback/revert_toon_pick_cost.sql`

- [ ] **Step 1: 롤백 파일 작성**

`supabase/rollback/revert_toon_pick_cost.sql`:

```sql
-- 원복: 20260830130000_toon_pick_cost.sql. 수동 실행 전용(migrations 밖).
alter table public.predictions
  drop column if exists def_cost,
  drop column if exists mid_cost,
  drop column if exists fwd_cost;

alter table public.season_squads
  drop column if exists pick_cost;
```

---

## Task 5: 수동 타입 동기화 (database.ts)

**Files:**
- Modify: `frontend/src/types/database.ts:269-270`, `:288-289`

- [ ] **Step 1: season_squads.Row에 pick_cost 추가**

`frontend/src/types/database.ts:269`의 `prediction_multiplier: number` 아래에:

```ts
          prediction_multiplier: number
          pick_cost: number
          synced_at: string
```

- [ ] **Step 2: predictions.Row에 비용 컬럼 추가**

`frontend/src/types/database.ts:288`의 `fwd_multiplier: number` 아래에:

```ts
          def_multiplier: number
          mid_multiplier: number
          fwd_multiplier: number
          def_cost: number
          mid_cost: number
          fwd_cost: number
          created_at: string
```

---

## Task 6: mock 데이터에 비용

**Files:**
- Modify: `frontend/src/lib/mock/data.ts` (`squadMember` 헬퍼)

- [ ] **Step 1: squadMember가 pick_cost를 배당에서 유도**

`frontend/src/lib/mock/data.ts`의 `squadMember` 반환 객체에서 `prediction_multiplier: multiplier,` 아래에 `pick_cost`를 추가한다(배당대→비용으로 근사, mock 예산 테스트용):

```ts
  prediction_multiplier: multiplier,
  pick_cost: multiplier >= 2.0 ? 3 : multiplier >= 1.5 ? 2 : 1,
```

(GK 포함 전 행이 헬퍼를 거치므로 한 곳만 고치면 된다. 실제 값은 mock에서 의미 없고 타입·예산 흐름 확인용.)

---

## Task 7: 제출 액션에 over_budget 전파

**Files:**
- Modify: `frontend/src/lib/actions/predictions.ts:12-25`

- [ ] **Step 1: SubmitPredictionResult 유니온에 over_budget 추가**

`frontend/src/lib/actions/predictions.ts`의 error 유니온(`:15-24`)에 `'over_budget'` 추가(`'unknown_player'` 아래):

```ts
        | 'unknown_player'
        | 'over_budget'
        | 'setup_required'
```

(`buildPredictionRows`가 반환하는 `built.error`가 그대로 전달되므로 이 유니온만 넓히면 된다. `:49` `return { error: built.error }`는 무변경.)

---

## Task 8: 전체 검증 + 커밋

- [ ] **Step 1: 전체 테스트**

Run: `cd frontend && npm test 2>&1 | tail -6`
Expected: 전부 통과(163). 기존 submit 테스트 + 신규 예산 테스트 포함.

- [ ] **Step 2: 타입 체크(빌드 대신 tsc)**

Run: `cd frontend && npx tsc --noEmit 2>&1 | tail -20`
Expected: 에러 없음. (특히 `Candidate.cost`, `pick_cost`, `def_cost` 관련 미스매치가 없어야 한다.) mock/data.ts·squads.ts·submit.ts·database.ts가 서로 맞물려 통과.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260830130000_toon_pick_cost.sql \
        supabase/rollback/revert_toon_pick_cost.sql \
        frontend/src/lib/predictions/submit.ts \
        frontend/src/lib/predictions/submit.test.mjs \
        frontend/src/lib/predictions/candidates.ts \
        frontend/src/lib/queries/squads.ts \
        frontend/src/lib/actions/predictions.ts \
        frontend/src/types/database.ts \
        frontend/src/lib/mock/data.ts
git commit -m "$(cat <<'EOF'
feat: 툰 비용 + 경기별 5툰 예산 검증 (툰 2단계)

- season_squads.pick_cost(1~3) 신규 컬럼, predictions에 비용 스냅샷(def/mid/fwd_cost)
- buildPredictionRows: 경기별 3픽 비용 합 > 5 → over_budget 거절, 비용 서버 재확인·스냅샷
- Candidate.cost, 후보 쿼리/타입/mock 동기화. 배당(multiplier)은 UI 정리 전까지 병존
- 점수 산식과 무관(순수 예산). 과거 예측은 기본 비용으로 백필(소급 무효 없음)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: DB 반영(배포 시점)**

`supabase db push`. 문제 시 `supabase/rollback/revert_toon_pick_cost.sql` 수동 실행. (1단계 마이그레이션과 함께 push 필요.)

---

## 자체 검토 체크리스트 (작성자 확인 완료)

- **스펙 커버리지**: 5툰 예산(Task 1 BUDGET) ✓, 경기별 검증(resolve 뒤 합산) ✓, 비용 1~3(Task 3 check) ✓, 비용 스냅샷 D-1(predictions 컬럼) ✓, 신규 컬럼 C-2 ✓, 과거 백필 소급무효 없음(default 2) ✓.
- **플레이스홀더 스캔**: 없음. 모든 코드 완성형.
- **타입 정합**: `Candidate.cost`(candidates.ts) → `toPickCandidates`가 채움(squads.ts) → `buildPredictionRows`가 소비(submit.ts) → `PredictionInsertRow.def_cost` → insert(actions/predictions.ts, `{...row}`) → `predictions.Row.def_cost`(database.ts). 컬럼명 `pick_cost`(season_squads) / `def_cost·mid_cost·fwd_cost`(predictions) 전 구간 일치. `over_budget`은 submit.ts 발생 → actions 유니온까지 전파.
- **배당 병존**: `multiplier`/`*_multiplier`는 유지(UI가 아직 읽음). 제거는 3단계 이후.
- **이 계획이 안 건드리는 것**: 점수 view(1단계), 화면 표시(3단계), 월별 산정 잡(4단계).
