# plan — 승부예측 주 경계 일요일 기준 변경

작성: 2026-09-04 · 작성자: developer 에이전트
**사람 승인 전까지 구현 시작 금지.**

**2026-09-04 갱신**: 구 0단계의 3가지 확인 항목이 전부 사람 승인으로 확정됐다(feature-spec.md §0,
§5, §6 참고). 이 문서는 그 결정을 그대로 반영해 1~6단계를 확정 SQL/코드로 채웠다. **다만 §6-3(신규
발견 — 프리시즌 빈 주 크래시 방지 로직)은 이번 세션에서 설계 중 새로 찾은 이슈라 이 plan.md
승인 시 함께 확인받는다(아래 "승인 시 함께 확인할 항목" 참고) — 나머지는 재질문 대상 아님.**

---

## 승인 시 함께 확인할 항목 — 확인 완료 (2026-09-04)

1. **weekNo(화면 "N주차" 표시값)가 프리시즌 주에서 음수로 나오는 문제(예: "-1주차"·"-2라운드")는
   이번 PR 스코프에서 처리하지 않고 후속 이슈로 분리하기로 확정됐다.** 친선경기 6주는 이미 지난
   과거 주라 "지금 진행 중인 주"로는 노출되지 않고 과거 기록·랭킹 화면에서만 보일 가능성이 높아
   노출 빈도가 낮다는 점을 근거로 승인자가 결정. `MatchWeekList.tsx`·`PredictionDone.tsx`·
   `PredictionResult.tsx`·`WeekRankCard.tsx`·`PredictionFlowClient.tsx`의 화면 문구는 이번 구현에서
   건드리지 않는다 — `weekKey`에 `"2627-0-"` 접두사로 프리시즌 여부를 판별할 수 있게 해뒀으니
   (§2단계), 후속 이슈에서 이 판별값을 그대로 재사용해 UI 처리(designer 경유)를 붙이면 된다.
2. **1~6단계의 SQL/코드(week_key 계산, DB 마이그레이션, 크래시 방지 로직)는 위 결정과 무관하게
   그대로 진행한다.** 아래 남은 미해결 항목은 없다 — plan.md는 구현 착수 가능 상태다.

---

## 1단계 — DB 마이그레이션

새 파일 `supabase/migrations/20260904140000_predictions_sunday_week_boundary.sql` (최신 마이그레이션
`20260903130000` 이후 타임스탬프).

### 1-1. `prediction_week_start` / `prediction_week_first_kickoff` 교체

```sql
-- 주차 경계를 월요일(ISO) → 일요일 시작으로 변경(2026-09-04 확정). 하루를 밀었다 당겨서
-- date_trunc('week', ...)의 고정 월요일 기준을 일요일 기준으로 바꾼다.
create or replace function public.prediction_week_start(target_fixture bigint)
returns timestamp
language sql
stable
as $$
  select date_trunc('week', (f.kickoff_at at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day'
  from public.fixtures f
  where f.fixture_id = target_fixture;
$$;

create or replace function public.prediction_week_first_kickoff(target_fixture bigint)
returns timestamptz
language sql
stable
as $$
  select min(f.kickoff_at)
  from public.fixtures f
  where f.cancelled = false
    and f.kickoff_at is not null
    and date_trunc('week', (f.kickoff_at at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day'
      = public.prediction_week_start(target_fixture);
$$;
```

`predictions: insert own while week open` RLS 정책 자체는 문구 변경 없음(두 함수만 고치면 자동으로
새 기준을 따름 — feature-spec §1-1 확인).

### 1-2. `public.week_leaderboard` 뷰 재정의 — `week_key`를 시즌 코드 포맷으로

친선경기(프리시즌)도 계속 집계 대상이어야 하므로(feature-spec §6-4 확인 — 필터 없음, 이미 0건이라
소급 데이터 없음), `week_key` 계산에 정규 시즌/프리시즌 분기를 모두 넣는다. 서브쿼리에 `sunday_start`
컬럼을 먼저 뽑아 재사용한다:

```sql
create or replace view public.week_leaderboard
with (security_invoker = true) as
select
  w.week_key,
  w.user_id,
  w.display_name,
  w.avatar_url,
  w.match_points,
  w.pick_points,
  w.total_points,
  rank()   over (partition by w.week_key order by w.total_points desc, w.user_id) as rank,
  count(*) over (partition by w.week_key)                                        as total_entries
from (
  select
    case
      when s.sunday_start >= date '2026-08-23'
        then '2627-' || (((s.sunday_start - date '2026-08-23') / 7) + 1)::text
      when s.sunday_start = date '2026-08-16' then '2627-0-4'
      when s.sunday_start = date '2026-08-09' then '2627-0-3'
      when s.sunday_start = date '2026-07-26' then '2627-0-2'
      when s.sunday_start = date '2026-07-19' then '2627-0-1'
      -- 앵커 목록 밖 프리시즌 주 — 지금 데이터로는 나오지 않음(feature-spec §2-2-보충/§1 실측
      -- 확인). 나오면 그 자체가 데이터 가정 위반이니 null로 걸러 랭킹에서 빠지게 한다(에러로
      -- 뷰 전체를 깨뜨리지 않는다).
      else null
    end as week_key,
    s.user_id,
    p.display_name,
    p.avatar_url,
    sum(s.match_points)::integer as match_points,
    sum(s.pick_points)::integer  as pick_points,
    sum(s.total_points)::integer as total_points
  from (
    select
      r.*,
      (date_trunc('week', (r.kickoff_at at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day')::date as sunday_start
    from public.prediction_results r
  ) s
  join public.public_profiles p on p.id = s.user_id
  where s.sunday_start is not null -- 안전장치, 실제로는 kickoff_at not null이 이미 보장
  group by 1, s.user_id, p.display_name, p.avatar_url
) w
where w.week_key is not null;

comment on view public.week_leaderboard is
  '주차별 랭킹. week_key는 lib/predictions/week.ts의 weekKey()와 같은 시즌 앵커 기준 문자열'
  '(정규 시즌 "2627-N", 프리시즌 "2627-0-M").';
```

`(s.sunday_start - date '2026-08-23')`는 Postgres에서 `date - date`라 정수(일수)로 나온다. 두
`sunday_start` 값은 항상 7일 배수 차이라(같은 방식으로 계산된 주 시작일끼리 비교) 정수 나눗셈이
그대로 정확한 몫이 된다 — 클라이언트의 `Math.floor` 트릭이 필요 없다.

### 1-3. `public.prediction_results` 뷰의 정산 게이트 — 같은 일요일 앵커 식으로 교체

`20260824120000_prediction_results_week_settled.sql:64-65`의 인라인 비교 2곳을 교체:

```sql
-- 기존(줄 64-65):
--   and date_trunc('week', f2.kickoff_at at time zone 'Asia/Seoul')
--     = date_trunc('week', f.kickoff_at  at time zone 'Asia/Seoul')
-- 신규:
      and date_trunc('week', (f2.kickoff_at at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day'
        = date_trunc('week', (f.kickoff_at  at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day'
```

이 비교는 "같은 주인가"만 판정하므로 시즌 코드/순번 포맷은 필요 없다 — `create or replace view`로
`prediction_results` 전체를 그대로 다시 선언하되 이 두 줄만 바꾼다(뷰 컬럼·나머지 로직은 원본
그대로).

### 1-4. 리버트 스크립트

`supabase/rollback/revert_predictions_sunday_week_boundary.sql` — `prediction_week_start`/
`prediction_week_first_kickoff`/`week_leaderboard`/`prediction_results`를 각각 월요일 기준 원래
정의로 되돌리는 `create or replace` 4개(리포 관례 — 43개 마이그레이션 중 13개가 리버트 스크립트
동반).

### 1-5. 검증

`supabase db push`(사전에 `supabase link` 대상이 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`과 같은
프로젝트인지 재확인 — `AGENT_MAINTENANCE_GUIDE.md` 경고 참고), 이후 `supabase db query --linked`로:

- feature-spec §2-3 표의 실제 경기(리버풀 `2627-1`, 웨스트브롬 `2627-1`, 토트넘 `2627-2`, 친선
  6경기 `2627-0-1`~`2627-0-4`)가 `week_leaderboard`(예측이 있는 경우) 또는 `prediction_week_start()`
  직접 호출로 예상대로 나오는지 확인. 친선경기는 현재 제출된 예측이 0건이므로(§6-4) `week_leaderboard`에서
  직접 확인은 안 되고, `select public.prediction_week_start(<fixture_id>)`를 6개 fixture_id에
  직접 호출해 반환값(일요일 0시 KST → UTC로는 전날 15:00)이 맞는지 확인한다.

---

## 2단계 — 클라이언트 (`frontend/src/lib/predictions/week.ts`)

### 2-1. 상수·헬퍼 추가

```ts
const SEASON_CODE = '2627' // 2026-27시즌, 시즌 내내 고정 — 다음 시즌 시작 전 갱신 필요(§8)

const SEASON_WEEK1_ANCHOR = Date.UTC(2026, 7, 23) // 2026-08-23(일) 00:00, KST 기준 날짜로 취급

// 이번 시즌(2026-27) 프리시즌 전용 — 실제 친선경기가 있는 주만 시간순으로 나열(2026-09-04
// supabase db query --linked 실측). 다음 시즌 프리시즌 일정이 나오면 갱신 필요(§8).
// 닫힌 나눗셈 공식을 못 쓰는 이유는 feature-spec §2-2-보충 참고(친선경기 없는 08/02주가
// 끼어 있어 날짜 산술만으로는 "몇 번째 프리시즌 주"인지 못 구함).
const PRESEASON_WEEK_ANCHORS = [
  Date.UTC(2026, 6, 19), // 07/19주
  Date.UTC(2026, 6, 26), // 07/26주
  Date.UTC(2026, 7, 9),  // 08/09주 (3경기 그룹)
  Date.UTC(2026, 7, 16), // 08/16주
]

function sundayAnchorStart(kst: Date): Date {
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d
}
```

### 2-2. `isoWeek()`/`weekKey()` 본체 교체 (함수명 유지 — feature-spec §5 확정)

```ts
/**
 * ISO 8601 규칙이 아니라 시즌 앵커 기준 순번이다(2026-09-04부터). 정규 시즌(2026-08-23
 * 이후)은 1부터 양수, 프리시즌은 -1(1번째 프리시즌 주)부터 음수 — 두 구간이 절대 같은
 * 숫자로 겹치지 않는다. PRESEASON_WEEK_ANCHORS에 없는 프리시즌 주(친선경기가 없는 빈 주)는
 * null.
 */
export function isoWeek(kst: Date): number | null {
  const start = sundayAnchorStart(kst).getTime()
  if (start >= SEASON_WEEK1_ANCHOR) {
    return Math.floor((start - SEASON_WEEK1_ANCHOR) / (7 * 86_400_000)) + 1
  }
  const idx = PRESEASON_WEEK_ANCHORS.indexOf(start)
  return idx === -1 ? null : -(idx + 1)
}

/** 그룹 키. 정규 시즌 "2627-N", 프리시즌 "2627-0-M"(M = -isoWeek()). */
export function weekKey(kst: Date): string {
  const n = isoWeek(kst)
  if (n === null) {
    throw new Error(
      `weekKey: PRESEASON_WEEK_ANCHORS에 없는 프리시즌 주(${sundayAnchorStart(kst).toISOString()}) — 앵커 목록 갱신 필요`,
    )
  }
  return n > 0 ? `${SEASON_CODE}-${n}` : `${SEASON_CODE}-0-${-n}`
}
```

`currentWeekKey()`는 변경 없음(`weekKey(new Date(now.getTime() + KST_OFFSET_MS))` 그대로 — 내부 계산만
바뀐 `weekKey()`를 그대로 호출).

### 2-3. `emptyWeek()` — `weekNo` 타입이 `number`인데 `isoWeek()`가 `number | null`을 반환하므로 null 케이스를 호출부에서 미리 걸러야 함

```ts
function emptyWeek(kst: Date, key: string, weekNo: number): WeekGroup {
  return {
    weekNo,
    weekKey: key,
    monthKey: `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}`,
    deadlineAt: null,
    status: 'upcoming',
    matches: [],
  }
}
```

시그니처에 `weekNo`를 추가해 호출부(§2-4의 `groupFixturesByWeek` 본문, `fillGapWeeks`)가 이미
`isoWeek()`로 null 여부를 확인한 값을 그대로 넘기게 한다 — `emptyWeek()` 내부에서 다시 `isoWeek()`를
불러 null 분기를 또 처리하지 않는다.

### 2-4. `groupFixturesByWeek()`/`fillGapWeeks()` — 프리시즌 빈 주는 건너뛴다 (feature-spec §6-3)

```ts
export function groupFixturesByWeek(fixtures: FixtureRow[], now: number): WeekGroup[] {
  const dated = fixtures
    .filter(f => !f.cancelled && f.kickoff_at)
    .sort((a, b) => (a.kickoff_at! < b.kickoff_at! ? -1 : 1))

  const groups: WeekGroup[] = []
  const byKey = new Map<string, WeekGroup>()
  const rowsByKey = new Map<string, FixtureRow[]>()

  for (const fixture of dated) {
    const kst = toKst(fixture.kickoff_at!)
    const weekNo = isoWeek(kst)
    if (weekNo === null) {
      // 실제 경기가 있는 주는 항상 정규 시즌이거나 PRESEASON_WEEK_ANCHORS에 등록된 주다
      // (feature-spec §1 실측으로 6개 친선경기 전부 확인) — 여기 도달하면 앵커 목록이
      // 실제 데이터와 어긋난 것이므로 조용히 넘기지 않고 바로 알 수 있게 던진다.
      throw new Error(`groupFixturesByWeek: 알 수 없는 주차(fixture_id=${fixture.fixture_id})`)
    }
    const key = weekKey(kst)
    let group = byKey.get(key)

    if (!group) {
      fillGapWeeks(groups, byKey, kst)
      group = emptyWeek(kst, key, weekNo)
      byKey.set(key, group)
      rowsByKey.set(key, [])
      groups.push(group)
    }
    rowsByKey.get(key)!.push(fixture)
    group.matches.push(toMatchView(fixture, now))
  }

  for (const group of groups) {
    const rows = rowsByKey.get(group.weekKey) ?? []
    group.deadlineAt = rows[rows.length - 1]?.kickoff_at ?? null
    group.status = weekStatus(rows, now)
  }

  return groups
}

/** 직전 그룹과 이번 주차 사이에 비어 있는 주를 빈 그룹으로 메운다. */
function fillGapWeeks(groups: WeekGroup[], byKey: Map<string, WeekGroup>, kst: Date) {
  const previous = groups[groups.length - 1]
  if (!previous) return

  const cursor = new Date(kst.getTime())
  cursor.setUTCDate(cursor.getUTCDate() - cursor.getUTCDay()) // 이번 주 일요일로 정렬
  const gaps: WeekGroup[] = []

  for (let i = 0; i < 12; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - 7)
    const weekNo = isoWeek(cursor)
    if (weekNo === null) continue // 프리시즌의 빈 주(친선경기 없음) — placeholder를 만들지 않고 계속 더 앞으로
    const key = weekKey(cursor)
    if (byKey.has(key)) break
    const gap = emptyWeek(cursor, key, weekNo)
    byKey.set(key, gap)
    gaps.unshift(gap)
  }

  groups.push(...gaps)
}
```

기존 코드 대비 바뀌는 지점: (a) `weekNo`/`isoWeek(kst)`를 미리 구해 null을 확인한 뒤 `emptyWeek`에
넘김, (b) `fillGapWeeks`의 커서 시작점이 "직전 월요일"(`- ((getUTCDay()||7) - 1)`)에서 "이번 주
일요일"(`- getUTCDay()`)로 바뀜, (c) 루프 안에서 `isoWeek(cursor) === null`이면 `continue`로 그
주를 건너뛰고 계속 더 앞으로 간다(에러를 던지지 않음 — §6-3, 이 필드에서 크래시가 나면 안 되는
지점은 여기뿐이고 이유는 "빈 주라 아직 못 채운 주"이지 "데이터 이상"이 아니기 때문. 반면
`groupFixturesByWeek` 본문에서 **실제 fixture 행**에 대해 `isoWeek`이 null이면 그건 앵커 목록이
실제 데이터와 어긋난 이상 상태라 위 (a)에서처럼 던진다 — 같은 null이라도 "실제 경기 vs 빈 주
채우기"에 따라 처리가 다르다는 점을 구현 시 정확히 지켜야 한다).

이 파일 외 다른 소스 파일은 코드 변경 없음(feature-spec §2-4 표 — 전부 값만 위임받는 호출부).
`getFixtureWeeksUncached()`(`lib/queries/fixtures.ts`)에는 `competition_name` 필터를 추가하지
않는다(feature-spec §0-3, §6-1 확정).

---

## 3단계 — 문서 drift 정리 (developer-agent-rules 체크리스트 1번)

- `lib/queries/fixtures.ts:56` 주석 `"2026-35" — 승부예측 세션 URL 파라미터` → `"2627-35" 형태(정규 시즌) / "2627-0-2" 형태(프리시즌) — 승부예측 세션 URL 파라미터`로 교체.
- `types/database.ts:355` 주석 `lib/predictions/week.ts의 weekKey()와 같은 ISO 주차 문자열('2026-35')` → `lib/predictions/week.ts의 weekKey()와 같은 시즌 앵커 기준 문자열('2627-35' 또는 프리시즌 '2627-0-2')`로 정정.
- `supabase/migrations/20260823140000_week_leaderboard.sql:8-9`, `20260823130000_predictions_weekly_window.sql:17,43`, `20260824120000_prediction_results_week_settled.sql:55` 등 "월요일 시작"을 언급하는 주석들 — **기존 마이그레이션 파일은 수정하지 않는다**(이미 적용된 히스토리). 대신 1단계에서 만드는 새 마이그레이션 파일 상단에 "이 함수는 지금부터 일요일 기준이며, 과거 파일의 '월요일 시작' 주석은 히스토리 기록이라 그대로 둔다"를 명시.
- `lib/predictions/week.ts` 자체의 기존 주석(`/** ISO 8601 주차 번호 (월요일 시작). */`, `/** 그룹 키 — 연도가 넘어가도 주차가 겹치지 않게 ISO 연도까지 포함. */` 등)을 §2-2 코드의 새 JSDoc으로 교체.

---

## 4단계 — 테스트 (`lib/predictions/week.test.mjs`)

1. `currentWeekKey` 3개 테스트(41, 51, 58행) — 기대값을 새 포맷으로 재계산:
   - "KST 자정 직후" 테스트: `mondayEarlyKst = 2026-08-23T15:30:00Z`(= 08-24 00:30 KST, 월요일).
     `sundayAnchorStart` = 08-23(일). `currentWeekKey(mondayEarlyKst)` = `'2627-1'`(그대로 08-23 이후
     첫 정규 시즌 주). `weekKey(mondayEarlyKst)`(시프트 없이 직접 호출, 버그 재현용)는 UTC 그대로 계산되어
     08-23(일, UTC) 기준 그 주 = `'2627-1'`도 될 수 있어 기존처럼 "지난 주차로 밀리는" 차이가 안
     보일 수 있다 — **일요일 경계에서는 이 버그 재현 시나리오 자체를 08-24(월)이 아니라 정규 시즌
     경계에 걸치는 다른 시각으로 다시 설계해야 한다**(예: 일요일 0시 KST 직후 vs UTC 자정 기준
     계산 시 하루 전 주로 밀리는 시각을 새로 골라야 함 — 정확한 시각은 구현 시 `sundayAnchorStart`
     로직으로 직접 재계산해 확인).
   - "주 중간" 테스트: 그대로 같은 주 판정만 확인하면 되므로 시각은 유지하고 기대값만 `'2627-N'`
     형태로 재계산.
   - "연말 경계" 테스트: `2026-12-28T00:00:00Z` → `sundayAnchorStart` = 12-27(일). N = 19(§2-3 표
     확인). 기대값 `'2627-19'`.
2. 더블 매치위크 테스트(83행) — 지금 쓰는 두 경기(08-23 PL, 08-29 EFL컵)는 일요일 경계에서 서로
   다른 주(`2627-1`/`2627-2`)로 갈라지므로(§2-3 확인) **같은 주에 남는 다른 조합으로 픽스처를
   교체해야 한다.** feature-spec §1-2가 실측으로 확인한 "같은 주" 조합을 그대로 쓴다: 리버풀전
   (`2026-08-23T15:30:00+00:00`, 08-24 월 00:30 KST)과 웨스트브롬 EFL컵전(`2026-08-26T18:45:00+00:00`,
   08-27 목 03:45 KST) — 둘 다 `sundayAnchorStart` = 08-23(일)이라 같은 주(`2627-1`)로 남는다. 테스트
   내 `KICKOFF` 상수·`weeks[0].deadlineAt` 기대값도 이 새 두 번째 fixture의 `kickoff_at`으로 갱신.
3. 빈 그룹 테스트(101행) — 두 경기(08-23, 09-14)의 그룹 개수(4)·빈 그룹 위치 구조는 유지, `weekKey`
   리터럴만 `'2627-N'` 형태로 재계산(정규 시즌 구간이라 프리시즌 null-skip 로직과는 무관 — 이 케이스는
   §6-3 방어 로직을 검증하지 않는다, 그건 아래 5번의 새 테스트가 맡는다).
4. `findWeekSession`(179행)·`toPredictWeeks`(197, 264, 285행) 테스트의 리터럴(`'2026-35'`,
   `'2026-36'`, `'1999-01'` 등)을 `'2627-N'` 형태로 재계산. `'1999-01'`처럼 "존재하지 않는 주차를
   찾으면 null" 케이스는 리터럴 값 자체는 임의 문자열이라도 무방(찾아지지 않음만 검증하면 되므로)
   — 다만 새 포맷과 헷갈리지 않게 `'9999-1'`처럼 명백히 존재하지 않는 시즌 코드로 바꾸는 편을
   권장.
5. **신규 테스트 추가** (feature-spec §7 "신규 추가 케이스" 반영):
   - 친선경기(예: `fixture({ fixture_id: 10, kickoff_at: '2026-07-25T11:30:00+00:00', competition_name: 'Club Friendlies' })`)를
     `groupFixturesByWeek()`에 단독으로 넣었을 때 `weekKey === '2627-0-1'`인지 확인.
   - 08-09(일)·08-13(목)·08-15(토) 3경기를 함께 넣었을 때 한 그룹(`'2627-0-3'`)으로 묶이고
     `matches.length === 3`인지 확인(트리플 매치위크와 동일한 그룹핑 방식 — intent.md에서 이미
     "신경 쓰지 않기로" 확인된 부분).
   - **크래시 방지 회귀 테스트**: 07-26 친선주 픽스처와 08-09 친선주 픽스처를 함께 넣어(중간
     08-02주는 비어 있음) `groupFixturesByWeek()`를 호출했을 때 **에러를 던지지 않고** 정상적으로
     그룹을 반환하는지 확인 — 이 테스트가 §6-3에서 발견한 문제(빈 프리시즌 주에서 크래시)의
     회귀 테스트다. 08-02주에 해당하는 빈 그룹이 **생기지 않는 것**(§2-4 설계대로)까지 함께
     단언한다.

실행: `cd frontend && npm test`(94개 전체 — 개별 script에 `week.ts`가 없으므로 반드시 `npm test`로
확인, CLAUDE.md 명령어 섹션 참고).

---

## 5단계 — 검증 (구현 완료 후 1회, developer-agent-rules 6번)

```bash
cd frontend
npm test          # week.test.mjs 포함 전체
npm run lint
npm run build
```

DB 변경이 있으므로 추가로:

- mock 모드(`.env.local` 없이 `npm run dev`)에서 승부예측 목록·제출·결과 화면 스모크 확인(CLAUDE.md — "mock 모드에서만 확인하고 끝내지 말 것"과 짝으로, 실 Supabase 연동 확인도 필요하면 `supabase db push` 반영 후 별도 확인).
- `supabase db query --linked`로 `week_leaderboard`/`prediction_results`가 새 `week_key`로 정상 집계되는지 재확인.
- **친선경기 화면 노출 확인**: mock 또는 실연동 모드에서 `/predictions` 목록에 07/19~08/16 사이
  친선경기 4개 그룹이 크래시 없이 나오는지, 2026-08-02주(빈 주)가 목록에서 조용히 생략되는지
  직접 확인(§6-3 회귀 확인 — 유닛 테스트로도 커버되지만 실제 화면에서 한 번 더 스모크 확인).

---

## 6단계 — PR

- 브랜치명: Linear 프로젝트 브랜치(이 워크트리 `predictions-week-boundary-saturday`는 이름만 검토 초기의 오기 — 실제 PR 브랜치명은 Linear 이슈 생성 후 그 규칙을 따른다).
- PR 설명에 관련 Linear 이슈 ID + `Fixes TEA-XX`, "무엇을·왜" 요약, **feature-spec §0/§6에서 확정된
  결정 사항(일요일 경계, 전체 소급 적용, 친선경기 계속 노출, 시즌 코드 "2627" + 프리시즌 "0-M"
  포맷, 함수명 유지)을 그대로 명시**(리뷰어가 이 PR만 보고도 왜 이렇게 됐는지 알 수 있게). §6-3에서
  새로 발견한 "프리시즌 빈 주 크래시 방지" 로직도 별도로 언급 — 리뷰어가 "왜 fillGapWeeks에 null
  분기가 생겼는지" 바로 알 수 있게.

---

## 요약 — 지금 상태

- 구 0단계의 3가지 확인 항목(친선경기 처리, weekKey 연도 자리, 함수명)은 2026-09-04 사람 승인으로
  전부 확정됐고, 이 문서에 반영했다(feature-spec.md §0/§5/§6 참고).
- 1~6단계 전부 확정 SQL/코드로 채워졌다 — TBD 없음.
- **남은 것은 "승인 시 함께 확인할 항목"(문서 상단)뿐**: 친선경기 주의 화면 표시값(`weekNo`가
  음수로 나오는 것을 "N주차"/"N라운드" 문구에 그대로 노출할지, 아니면 별도 UI 처리를 이번 스코프에
  포함할지)은 UX 카피 결정이라 개발자가 임의로 정하지 않고 여기 제시한 기본안(데이터만 준비, 화면
  문구 처리는 필요시 별도 작업)으로 승인을 구한다 — 이 항목은 나머지 구현(DB·week.ts 계산 로직)을
  막지 않는다.
- 이 plan.md가 사람 승인을 받으면 구현을 시작한다.
