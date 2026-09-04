# plan — 승부예측 주 경계 일요일 기준 변경

작성: 2026-09-04 · 작성자: developer 에이전트
**사람 승인 전까지 구현 시작 금지.**

**2026-09-04 갱신 1**: 구 0단계의 3가지 확인 항목이 전부 사람 승인으로 확정됐다(feature-spec.md §0,
§5, §6 참고). 이 문서는 그 결정을 그대로 반영해 1~6단계를 확정 SQL/코드로 채웠다. §6-3(신규 발견 —
프리시즌 빈 주 크래시 방지 로직)은 그때 세션에서 설계 중 새로 찾은 이슈라 승인 시 함께 확인받았다
(아래 "승인 시 함께 확인할 항목" 참고).

**2026-09-04 갱신 2(최종)**: 이 plan.md를 다시 다듬던 중 `supabase db query --linked` 실측으로
낙오 경기(fixture_id=4813748, 2025-26시즌 최종전) 크래시 버그를 새로 발견했고, 처리 방식(§9, "2526-1"
명시 처리)과 일반 방어 로직(§10, 화이트리스트 밖 과거 날짜는 throw 대신 null)까지 사람이 즉시
확정했다(feature-spec.md §9·§10 참고). 1단계·2단계·4단계에 반영했다. **이 갱신을 끝으로 이 프로젝트의
spec/plan 확정 라운드는 종료된다 — 아래 표에 정리된 항목 외에 재질문 대상은 없다.**

---

## 확정된 결정 전체 요약 (이 프로젝트, 2026-09-04 기준 최종)

세션이 여러 라운드를 거쳤으므로, 구현 승인 전 마지막으로 한눈에 검토할 수 있게 지금까지 확정된
모든 결정을 정리한다. 상세 근거는 각 행이 가리키는 절 참고.

| # | 항목 | 확정 내용 | 근거 절 |
|---|---|---|---|
| 1 | 주차 경계 | 월요일 0시(KST) → **일요일 0시(KST)**, 주 = 일요일~토요일 | intent.md, feature-spec §1 |
| 2 | 소급 적용 범위 | **전체 소급 적용** — 과거 랭킹도 새 기준으로 재계산됨을 감수 | intent.md, feature-spec §0-2 |
| 3 | 친선경기(프리시즌 6경기) 처리 | **계속 노출·예측 가능 상태 유지**, `competition_name` 필터 추가 안 함 | feature-spec §0-3, §4-1, §6-1 |
| 4 | `weekKey`의 "연도" 자리 | **시즌 코드 `"2627"`**(시작 연도+종료 연도 뒤 2자리) 고정, 안1/안2 기각 | feature-spec §0-4, §6-2 |
| 5 | `weekKey` 형식 | 정규 시즌 `"2627-N"`, 프리시즌 `"2627-0-M"`(M=경기 있는 프리시즌 주만 시간순 1부터) | feature-spec §0-5, §2-2 |
| 6 | 함수명 | `isoWeek()`/`weekKey()` **이름 유지**, 주석만 정정(개명 안 함) | feature-spec §0-6, §5 |
| 7 | 낙오 경기(fixture_id=4813748, 2025-26시즌 최종전) | **`"2526-1"`로 명시 처리** — 별도 상수 `PREVIOUS_SEASON_CODE`/`PREVIOUS_SEASON_STRAY_ANCHOR`, 순번 1 고정 | feature-spec §9 (신규) |
| 8 | 화이트리스트 밖 완전히 알 수 없는 과거 날짜 | `throw` 대신 **`null` 반환**, 상위 호출부(`groupFixturesByWeek`)가 그 경기 하나만 스킵 | feature-spec §10 (신규) |
| 9 | 프리시즌 빈 주(2026-08-02주) 크래시 방지 | `fillGapWeeks()`에서 `isoWeek(cursor) === null`이면 빈 그룹 생성 없이 건너뜀(항목 8과 같은 null 규약 재사용) | feature-spec §6-3 |
| 10 | 프리시즌 주 `weekNo` 음수 UI 카피("-1주차" 등) | **이번 스코프 제외 — 후속 이슈로 분리** | 아래 "스코프 밖(후속 이슈)" §A |
| 11 | 시즌 경계 자동 감지(사람이 앵커 상수 수동 갱신 안 해도 되게) | **이번 스코프 제외 — 후속 이슈로 분리**(클라이언트 순수 함수 구조와 충돌) | 아래 "스코프 밖(후속 이슈)" §B |
| 12 | 옛 ISO 주차 URL 호환성 | 스코프 밖, 근거 미확인 유지(리다이렉트 없음, 그냥 404) | feature-spec §4-2, §8 |
| 13 | Mixpanel 과거 이벤트 `week_key` 소급 변환 | 스코프 밖 | feature-spec §8 |

**결론: 표의 1~9번은 구현 대상(이 plan.md 1~4단계에 SQL/코드로 반영), 10~13번은 이번 PR에서
건드리지 않는다.** 더 이상 미확정 항목은 없다.

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

## 스코프 밖 (후속 이슈로 분리)

이번 PR에서 다루지 않기로 확정된 2건. 둘 다 "구현이 어려워서"가 아니라 사람이 범위를 의도적으로
좁힌 결정이므로, 다음에 이 후속 이슈를 진행할 사람이 같은 고민을 처음부터 반복하지 않도록 결론과
근거를 남긴다.

### A. 프리시즌 주 `weekNo` 음수 UI 카피 (예: "-1주차", "-2라운드")

- **확정**: 이번 PR 스코프에서 처리하지 않는다(위 "승인 시 함께 확인할 항목" 1번, 2026-09-04
  확정). `MatchWeekList.tsx`·`PredictionDone.tsx`·`PredictionResult.tsx`·`WeekRankCard.tsx`·
  `PredictionFlowClient.tsx`의 화면 문구는 이번 구현에서 건드리지 않는다.
- **근거**: 친선경기 6주는 이미 지난 과거 주라 "지금 진행 중인 주"로는 노출되지 않고 과거 기록·
  랭킹 화면에서만 보일 가능성이 높아 노출 빈도가 낮다는 점을 근거로 승인자가 결정.
- **후속 이슈를 위해 준비해 둔 것**: `weekKey`가 `"2627-0-"` 접두사로 프리시즌 여부를 판별할 수
  있는 데이터를 이미 갖고 있다(§2단계). 후속 이슈는 이 판별값을 그대로 재사용해 화면 문구만
  designer 경유로 붙이면 된다 — 데이터 구조를 다시 바꿀 필요는 없다.

### B. 시즌 경계 자동 감지 (사람이 앵커 상수를 매 시즌 손으로 갱신할 필요 없애기)

- **논의**: `SEASON_WEEK1_ANCHOR`/`PRESEASON_WEEK_ANCHORS`(그리고 이번에 추가된
  `PREVIOUS_SEASON_STRAY_ANCHOR`)는 전부 사람이 시즌마다(또는 이번처럼 낙오 경기를 발견할 때마다)
  손으로 갱신해야 하는 상수다. "한 달 이상 경기 공백 = 시즌 경계"처럼 실제 fixture 데이터를 보고
  자동으로 시즌 경계를 감지하는 방식을 사람이 제안했다.
- **확정: 이번 PR에 넣지 않고 후속 이슈로 분리한다.**
- **왜 후속으로 분리했는지(핵심 근거)**: `weekKey()`/`isoWeek()`는 지금 "날짜 하나만 받는 순수
  함수"다(`kst: Date` 하나만 인자로 받고, DB나 다른 fixture 목록을 조회하지 않는다). "한 달 이상
  공백"을 감지하려면 그 날짜 앞뒤의 다른 fixture들과 비교해야 하므로, 함수가 최소한 "전체 fixture
  목록"이나 그로부터 미리 계산된 "감지된 앵커 목록" 같은 추가 입력을 받아야 한다 — 지금처럼 여러
  컴포넌트·쿼리 파일이 날짜 하나만 넘겨 이 함수들을 호출하는 구조(§2-4 클라이언트 호출 지점 전수
  조사 표 참고 — `lib/queries/fixtures.ts`, `lib/mock/queries.ts`, `AppAnalytics.tsx`,
  `PredictionFlowClient.tsx` 등 다수)를 상당 부분 바꿔야 한다는 게 이번 세션에서 확인됐다. 순수
  함수 시그니처를 유지한 채로는(즉 지금 이 PR이 확정한 "함수명·시그니처 유지" 원칙, feature-spec
  §5 안에서는) 자동 감지를 붙일 수 없다.
- **후속 이슈가 다시 검토해야 할 것**: (1) 앵커 자동 감지 로직을 어디서 계산할지(서버 컴포넌트/쿼리
  계층에서 fixture 목록을 먼저 훑어 앵커 배열을 만들고, 그 결과를 `week.ts` 함수들에 주입하는 구조가
  유력해 보이지만 이건 이번 세션의 판단일 뿐 확정이 아니다 — 근거 미확인, 후속 이슈에서 다시 설계),
  (2) 지금 `isoWeek`/`weekKey`가 "날짜만 받는 순수 함수"라는 성질에 의존하는 다른 코드(테스트,
  Storybook mock 등)에 미치는 영향, (3) 이번에 추가된 `PREVIOUS_SEASON_STRAY_ANCHOR` 같은 "낙오
  경기 전용 예외"까지 자동 감지가 커버할 수 있는지, 아니면 예외는 계속 화이트리스트로 남겨야 하는지.

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
      -- 낙오 경기(fixture_id=4813748, 2025-26시즌 최종전, PL, kickoff 2026-05-24 15:00 UTC =
      -- KST 2026-05-25) 전용 — 이 시즌 데이터는 이 경기 1건뿐이라 순번 고정(feature-spec §9).
      -- 예측 0건이라 지금은 이 분기가 실제로 나올 일이 없지만, 일관성·향후 방어를 위해 넣는다.
      when s.sunday_start = date '2026-05-24' then '2526-1'
      -- 앵커 목록 밖 과거 주 — 지금 데이터로는 나오지 않음(feature-spec §2-2-보충/§1/§9 실측
      -- 확인). 나오면 그 자체가 데이터 가정 위반이니 null로 걸러 랭킹에서 빠지게 한다(에러로
      -- 뷰 전체를 깨뜨리지 않는다 — 클라이언트 groupFixturesByWeek()의 null-skip과 같은 방향,
      -- feature-spec §10).
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
- **낙오 경기(fixture_id=4813748) 검증(feature-spec §9)**: `select public.prediction_week_start(4813748)`
  결과가 `2026-05-24 00:00:00`인지 확인(함수 반환 타입이 `timestamp`(tz 없음)라 UTC 변환 없이
  `at time zone`으로 이미 Seoul 벽시계 값으로 바뀐 그대로 나온다 — 위 §1-1처럼 UTC로 다시 환산하지
  않는다). 이 경기도 예측 0건이라 `week_leaderboard`에서 직접 확인은 안 되므로, `week_leaderboard`
  view의 소스 정의를 `pg_get_viewdef('public.week_leaderboard')`로 재조회해 `when s.sunday_start =
  date '2026-05-24' then '2526-1'` 분기가 실제로 반영됐는지 눈으로 확인한다.

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

// 2025-26시즌 최종전(fixture_id=4813748, PL, kickoff 2026-05-24 15:00 UTC = KST 2026-05-25)
// 하나만을 위한 예외 앵커(2026-09-04 신규 발견, feature-spec §9). PRESEASON_WEEK_ANCHORS(07/19주
// 시작)보다 훨씬 이전 날짜라 정규 화이트리스트로 커버되지 않는다 — 이 시즌(2526) 데이터가 이
// 경기 1건뿐이라(DB 실측) 별도 시즌 코드 + 고정 순번(1)으로 명시 처리한다. 다음 시즌 전환 때
// 갱신할 대상이 아니다(과거 시즌 낙오 경기 전용 상수 — SEASON_WEEK1_ANCHOR/PRESEASON_WEEK_ANCHORS와
// 달리 "시즌마다 갱신" 성격이 없음).
const PREVIOUS_SEASON_CODE = '2526'
const PREVIOUS_SEASON_STRAY_ANCHOR = Date.UTC(2026, 4, 24) // 2026-05-24(일)
const PREVIOUS_SEASON_STRAY_WEEK_NO = 1

function sundayAnchorStart(kst: Date): Date {
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay())
  return d
}
```

### 2-2. `isoWeek()`/`weekKey()` 본체 교체 (함수명 유지 — feature-spec §5 확정)

**2026-09-04 갱신**: 최초 초안은 화이트리스트 밖 날짜를 만나면 `weekKey()`가 `throw`했다. 이제
`throw` 대신 `null`을 반환하도록 바꾼다(feature-spec §10 확정) — `weekKey()`의 반환 타입이
`string`에서 `string | null`로 바뀐다. 그와 별개로 낙오 경기 전용 앵커(`PREVIOUS_SEASON_STRAY_ANCHOR`,
feature-spec §9)도 여기서 함께 처리한다.

```ts
/**
 * ISO 8601 규칙이 아니라 시즌 앵커 기준 순번이다(2026-09-04부터). 정규 시즌(2026-08-23
 * 이후)은 1부터 양수, 프리시즌은 -1(1번째 프리시즌 주)부터 음수 — 두 구간이 절대 같은
 * 숫자로 겹치지 않는다. 2025-26시즌 낙오 경기(PREVIOUS_SEASON_STRAY_ANCHOR)는 1을 반환하지만
 * weekKey()가 별도 시즌 코드("2526")를 붙이므로 정규 시즌 1주차("2627-1")와 문자열 값은
 * 겹치지 않는다. 세 화이트리스트(정규 시즌 앵커·PRESEASON_WEEK_ANCHORS·낙오 경기 앵커) 어디에도
 * 없는 날짜(친선경기 없는 빈 주 포함)는 null.
 */
export function isoWeek(kst: Date): number | null {
  const start = sundayAnchorStart(kst).getTime()
  if (start === PREVIOUS_SEASON_STRAY_ANCHOR) return PREVIOUS_SEASON_STRAY_WEEK_NO
  if (start >= SEASON_WEEK1_ANCHOR) {
    return Math.floor((start - SEASON_WEEK1_ANCHOR) / (7 * 86_400_000)) + 1
  }
  const idx = PRESEASON_WEEK_ANCHORS.indexOf(start)
  return idx === -1 ? null : -(idx + 1)
}

/**
 * 그룹 키. 정규 시즌 "2627-N", 프리시즌 "2627-0-M"(M = -isoWeek()), 2025-26시즌 낙오 경기는
 * "2526-1"(isoWeek()의 부호 기반 매핑과 별개로 여기서 직접 분기 — isoWeek()가 반환하는 1이
 * 정규 시즌 1주차의 1과 숫자로는 같기 때문에, weekKey()가 앵커 자체를 다시 확인해 시즌 코드를
 * 결정해야 "2526-1"과 "2627-1"이 안 섞인다). 화이트리스트 밖 날짜는 null — 예전엔 여기서
 * throw했지만(2026-09-04) "그 경기 하나만 목록에서 빠지고 페이지 전체는 안 깨지는" 안전망으로
 * 바꿨다(feature-spec §10). 호출부는 null을 반드시 처리해야 한다(§2-4 groupFixturesByWeek 참고).
 */
export function weekKey(kst: Date): string | null {
  if (sundayAnchorStart(kst).getTime() === PREVIOUS_SEASON_STRAY_ANCHOR) {
    return `${PREVIOUS_SEASON_CODE}-${PREVIOUS_SEASON_STRAY_WEEK_NO}`
  }
  const n = isoWeek(kst)
  if (n === null) return null
  return n > 0 ? `${SEASON_CODE}-${n}` : `${SEASON_CODE}-0-${-n}`
}
```

`currentWeekKey()`는 계산 로직 변경 없음(`weekKey(new Date(now.getTime() + KST_OFFSET_MS))` 그대로 —
내부 계산만 바뀐 `weekKey()`를 그대로 호출). 다만 반환 타입이 `weekKey()`를 따라 `string | null`로
바뀐다 — 이 타입 변경이 미치는 다른 호출부는 아래 "2-4 이후" 절 참고.

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
    const key = weekKey(kst)
    if (weekNo === null || key === null) {
      // 세 화이트리스트(정규 시즌 앵커·PRESEASON_WEEK_ANCHORS·낙오 경기 앵커) 어디에도 없는
      // 과거 날짜다(2026-09-04 확정, feature-spec §10) — 앵커 상수 갱신이 빠졌다는 뜻이지만,
      // 경기 하나 때문에 목록 페이지 전체가 죽으면 안 되므로 이 경기만 조용히 빼고 넘어간다.
      // (예전 초안은 여기서 throw했다 — 실제로 fixture_id=4813748이 이 경로를 타면서 배포
      // 직후 크래시가 재현됐다, feature-spec §9.)
      console.error(`groupFixturesByWeek: 주차를 알 수 없는 경기(fixture_id=${fixture.fixture_id}) — 건너뜀`)
      continue
    }
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

기존 코드 대비 바뀌는 지점: (a) `weekNo`/`weekKey(kst)`를 미리 구해 null을 확인한 뒤 `emptyWeek`에
넘김, (b) `fillGapWeeks`의 커서 시작점이 "직전 월요일"(`- ((getUTCDay()||7) - 1)`)에서 "이번 주
일요일"(`- getUTCDay()`)로 바뀜, (c) **`groupFixturesByWeek` 본문과 `fillGapWeeks` 둘 다 이제
같은 규약을 쓴다** — `isoWeek`/`weekKey`가 null이면 에러를 던지지 않고 `continue`로 건너뛴다.
2026-09-04 갱신 전에는 "실제 fixture 행에서 null이면 앵커 목록이 실제 데이터와 어긋난 이상
상태이니 던진다 / 빈 주 채우기에서 null이면 조용히 스킵한다"로 둘을 다르게 처리했는데, 이 구분이
바로 낙오 경기(fixture_id=4813748, feature-spec §9) 크래시의 원인이었다 — 실제 데이터에 여전히
화이트리스트 밖 날짜가 나올 수 있다는 게 이번에 실측으로 확인됐으므로, "실제 경기든 빈 주든 null이면
그 자리만 건너뛴다"로 두 경로를 통일했다(feature-spec §10).

이 파일 외 다른 소스 파일은 코드 변경 없음(feature-spec §2-4 표 — 전부 값만 위임받는 호출부).
`getFixtureWeeksUncached()`(`lib/queries/fixtures.ts`)에는 `competition_name` 필터를 추가하지
않는다(feature-spec §0-3, §6-1 확정).

### 2-5. `weekKey()` 타입 변경(`string` → `string | null`)의 파급 — 다른 호출부 3곳 (feature-spec §10)

`weekKey()`를 직접 호출해 넌널 `string` 필드에 대입하는 호출부가 `lib/predictions/week.ts` 밖에
3곳 있다(grep 확인, 2026-09-04) — 전부 "지금 시각"에 가까운 날짜만 다뤄 실제로 `null`이 나올 일은
없지만(화이트리스트가 최신 상태인 한), 타입이 `string | null`로 바뀌면 컴파일이 깨지므로 아래처럼
`?? ''`로 좁혀준다(로직 변경이 아니라 타입 정리):

- `lib/queries/fixtures.ts:114` (`toMatchdayFixture()`, `MatchdayFixture.weekKey: string`에 대입) —
  `weekKey: weekKey(toKst(kickoffAt)) ?? ''`. 이 함수는 `getHomeMatchdayFixtureUncached()`(같은 파일
  245행 부근)가 "다음 경기"(`kickoff_at` between staleCutoff와 preMatchCutoff) 또는 "가장 최근 종료
  경기"(`order by kickoff_at desc limit 1`)로 조회한 행만 받으므로(2026-09-04 코드 확인) 화이트리스트가
  최신인 한 null이 나올 수 없다 — 주석으로 이 전제를 남긴다.
- `lib/mock/queries.ts:137` (`mockGetHomeMatchdayFixture()`) — 같은 필드, `kickoffAt`이 `Date.now()`
  기준이라 마찬가지로 동일 처리(`?? ''`).
- `app/dev/matchday-hero-preview/page.tsx:19` (`withWeekKey()`) — 개발 프리뷰 전용, `kickoffAt`이
  `Date.now()` 기준. 같은 처리(`?? ''`) 또는 반환 타입을 `string | null`로 바꿔도 무방(프리뷰
  페이지라 리스크 낮음 — 구현 시 판단).
- `components/composition/common/AppAnalytics.tsx:71` (`currentWeekKey()`) — `trackEvent(...,
  { week_key: weekKey })`에 그대로 실리므로, `trackEvent`의 프로퍼티 타입이 `string | null`을
  받는지 구현 시 확인하고, 안 받으면 `currentWeekKey() ?? undefined`로 좁힌다.

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
6. **신규 테스트 추가 — 낙오 경기 "2526-1" 케이스** (feature-spec §9 반영):
   - 함수 단위: `isoWeek(toKst('2026-05-24T15:00:00+00:00'))`가 `1`(=`PREVIOUS_SEASON_STRAY_WEEK_NO`)을
     반환하는지, `weekKey(toKst('2026-05-24T15:00:00+00:00'))`가 `'2526-1'`을 반환하는지 확인(실제
     fixture_id=4813748의 `kickoff_at`과 같은 값).
   - `groupFixturesByWeek()` 통합: 이 낙오 경기 1건을 정규 시즌 초반 경기(예: 08-23 리버풀전)와
     함께 넣었을 때 (a) 에러 없이 그룹 배열이 반환되고, (b) `weekKey === '2526-1'`인 그룹이 정확히
     1개 생기며 `weekNo === 1`, (c) 이 그룹과 정규 시즌 1주차(`'2627-1'`) 그룹이 **서로 다른
     그룹으로 분리**(숫자만 보면 둘 다 `weekNo === 1`이라 문자열 키로만 구분되는 지점이라, 이 둘이
     실수로 하나로 합쳐지지 않는지가 이 테스트의 핵심)되는지 확인.
7. **신규 테스트 추가 — 화이트리스트 밖 과거 날짜는 크래시 대신 null** (feature-spec §10 반영):
   - 함수 단위: 세 화이트리스트(정규 시즌 앵커·`PRESEASON_WEEK_ANCHORS`·`PREVIOUS_SEASON_STRAY_ANCHOR`)
     어디에도 없는 임의의 과거 날짜(예: `2026-04-01T00:00:00+00:00`, 2526-1 앵커보다도 이전이고
     프리시즌 앵커와도 안 겹치는 날짜)로 `isoWeek()`/`weekKey()`를 직접 호출했을 때 **에러를 던지지
     않고** 둘 다 `null`을 반환하는지 확인(회귀 방지 — 예전 초안은 여기서 `throw`했다).
   - `groupFixturesByWeek()` 통합: 이 알 수 없는 날짜의 fixture 1건을 정상 fixture 2~3건(예: 낙오
     경기 1건 + 정규 시즌 경기 1~2건)과 함께 넣었을 때 (a) 함수가 에러를 던지지 않고, (b) 알 수
     없는 날짜의 그 경기는 반환된 어떤 그룹의 `matches`에도 나타나지 않으며(조용히 스킵됨), (c)
     나머지 정상 fixture들은 각자 올바른 그룹으로 정상 반환되는지 확인 — 이 테스트가 이번 세션에서
     실제로 재현된 크래시(fixture_id=4813748이 방어 로직 추가 전 코드를 만났다면 이 경로를 탔을
     것)의 일반화된 회귀 테스트다.

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
- **낙오 경기 회귀 확인(feature-spec §9)**: `supabase db push` 반영 후(mock 모드는 이 fixture가
  `MOCK_FIXTURES`에 없으므로 이 항목은 실연동 모드에서만 확인 가능) `/predictions` 목록 페이지가
  fixture_id=4813748(2025-05-24 킥오프, 2025-26시즌 최종전) 존재 상태에서 크래시 없이 로드되는지
  직접 확인 — 이 확인이 이번 세션에서 발견한 회귀의 최종 검증이다.

---

## 6단계 — PR

- 브랜치명: Linear 프로젝트 브랜치(이 워크트리 `predictions-week-boundary-saturday`는 이름만 검토 초기의 오기 — 실제 PR 브랜치명은 Linear 이슈 생성 후 그 규칙을 따른다).
- PR 설명에 관련 Linear 이슈 ID + `Fixes TEA-XX`, "무엇을·왜" 요약, **feature-spec §0/§6에서 확정된
  결정 사항(일요일 경계, 전체 소급 적용, 친선경기 계속 노출, 시즌 코드 "2627" + 프리시즌 "0-M"
  포맷, 함수명 유지)을 그대로 명시**(리뷰어가 이 PR만 보고도 왜 이렇게 됐는지 알 수 있게). §6-3에서
  발견한 "프리시즌 빈 주 크래시 방지" 로직과, §9·§10에서 새로 발견한 "낙오 경기(2526-1) 명시 처리 +
  화이트리스트 밖 날짜 null-skip 방어 로직"도 별도로 언급 — 리뷰어가 "왜 fillGapWeeks·
  groupFixturesByWeek에 이 null 분기들이 생겼는지" 바로 알 수 있게(둘 다 이번 PR이 실제로 재현
  가능한 배포 직후 크래시를 미리 막기 위한 것이라는 맥락 포함).

---

## 요약 — 지금 상태

- 구 0단계의 3가지 확인 항목(친선경기 처리, weekKey 연도 자리, 함수명)은 2026-09-04 사람 승인으로
  전부 확정됐다(feature-spec.md §0/§5/§6).
- §6-3(프리시즌 빈 주 크래시 방지)도 같은 날 사람 승인으로 확정됐다("승인 시 함께 확인할 항목" 참고).
- **이번 최종 갱신에서 추가된 §9(낙오 경기 "2526-1" 명시 처리)·§10(화이트리스트 밖 날짜 null-skip
  방어 로직)도 사람이 즉시 확정했다** — 1단계(DB, `week_leaderboard` view의 CASE 분기 추가)·2단계
  (클라이언트, `PREVIOUS_SEASON_STRAY_ANCHOR` 상수 + `isoWeek`/`weekKey`의 null 반환 + 타입 파급
  3곳)·4단계(테스트 6·7번)에 전부 반영했다.
- **프리시즌 `weekNo` 음수 UI 카피**(항목 A)와 **시즌 경계 자동 감지**(항목 B) 2건은 후속 이슈로
  분리하기로 확정됐다 — 근거·논의는 위 "스코프 밖 (후속 이슈로 분리)" 절 참고. 둘 다 나머지 구현
  (DB·week.ts 계산 로직)을 막지 않는다.
- 1~6단계 전부 확정 SQL/코드로 채워졌다 — TBD 없음, 더 이상 미확정 항목이나 재질문 대상이 없다.
- 이 plan.md가 사람 승인을 받으면 구현을 시작한다.
