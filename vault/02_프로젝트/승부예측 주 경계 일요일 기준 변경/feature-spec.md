# feature-spec — 승부예측 주 경계 일요일 기준 변경

작성: 2026-09-04 · 작성자: developer 에이전트
입력: `intent.md`(확정된 결정 3가지 + 근거 미확인 2건) — 이 문서는 그 위에 실측 조사 결과를 얹는다.
**2026-09-04 갱신 1**: §5, §6-1, §6-2의 미해결 3항목이 사람 승인으로 확정됨(아래 0번 3·4·5). §2-3·§6을
그 결정으로 갱신했다.
**2026-09-04 갱신 2(최종)**: plan.md 작성 중 `supabase db query --linked` 실측으로 새 크래시 버그(§9
"낙오 경기")를 추가로 발견했고, 사람이 그 처리 방식과 일반 방어 로직(§10)까지 즉시 확정했다. §9·§10을
새로 추가한다 — 이 갱신을 끝으로 spec/plan 확정 라운드는 종료된다(더 이상 재질문 대상 없음).

## 0. 전제 (재질문 대상 아님, intent.md + 2026-09-04 승인에서 확정)

1. 주차 경계: 일요일 0시(KST) 시작, 일요일~토요일.
2. 소급 범위: 전체 소급 적용(과거 랭킹도 새 기준으로 재계산됨을 감수).
3. **친선경기(시즌 앵커 이전 6경기) 처리 — 계속 노출·예측 가능 상태 유지**(구 §6-1의 A(제외)는
   기각). `getFixtureWeeksUncached()` 등 DB 조회 쿼리에 `competition_name` 필터를 추가하지 않는다.
   대신 이 경기들의 `weekKey`를 프리시즌 전용 포맷(아래 5번)으로 구분 표기한다.
4. `weekKey`의 "연도" 자리 — 구 §6-2의 안1(달력연도 고정)/안2(그 주 실제 달력연도) 둘 다 기각.
   **시즌 코드 `"2627"`**(시즌 시작 연도 2026의 뒤 2자리 + 종료 연도 2027의 뒤 2자리)로 대체, 시즌
   내내 고정.
5. `weekKey` 형식(최종): 시즌 코드 + 순번.
   - 정규 시즌(그 경기의 일요일 앵커 날짜가 2026-08-23 이후): `"2627-N"`,
     N = `floor((일요일 앵커 날짜 - 2026-08-23) / 7일) + 1`(기존 계산식 그대로, 프리픽스만 교체).
   - 프리시즌(2026-08-23 이전, 친선경기 6경기가 속한 4개 주): `"2627-0-M"`. "0"은 "시즌 시작 전"
     고정 마커, M은 그 경기가 속한 일요일 기준 주가 프리시즌 내에서 몇 번째 주인지(경기 단위가
     아니라 주 단위로) 시간순 1부터 매긴 순번. 계산식은 §2-2 참고.
6. `isoWeek()`/`weekKey()` 함수명은 그대로 유지(개명하지 않음). 주석만 "ISO 8601 규칙이 아니라
   시즌 앵커 기준 순번(정규 시즌: 시즌코드-N, 프리시즌: 시즌코드-0-M)"으로 정정한다(구 §5 확정).

---

## 1. DB 실측 (`supabase db query --linked`, 2026-09-04, project `xrvz…` = `.env.local`이 가리키는 실서비스 DB)

### 1-1. 지금 구조

- `prediction_week_start(target_fixture bigint)` (`20260823130000_predictions_weekly_window.sql:18`):
  `date_trunc('week', f.kickoff_at at time zone 'Asia/Seoul')` — **월요일 기준**. fixture_id를 받아 그 경기가 속한 주의 시작 시각을 반환.
- `prediction_week_first_kickoff(target_fixture bigint)` (같은 파일:30): 자기 안에 **별도의 인라인** `date_trunc('week', f.kickoff_at at time zone 'Asia/Seoul') = public.prediction_week_start(target_fixture)` 비교를 갖고 있다. 즉 `prediction_week_start()`만 고치면 이 비교가 깨진다 — **이 함수의 인라인 date_trunc도 같이 고쳐야 한다.**
- `predictions: insert own while week open` RLS 정책(최신본은 `20260827140000_restore_predictions_partial_submit.sql`, `20260825130908_remote_schema.sql`이 원격 정본)은 `prediction_week_first_kickoff(fixture_id)`만 호출한다 — 정책 문구 자체는 안 바뀐다. 함수 두 개만 고치면 정책은 자동으로 새 기준을 따른다.
- `week_leaderboard`(최신본 `20260827130000_fix_leaderboards_public_profiles.sql:36`)의 `week_key`는 `prediction_week_start()`를 **호출하지 않는다.** 독립된 인라인 식 `to_char(date_trunc('week', r.kickoff_at at time zone 'Asia/Seoul'), 'IYYY-IW')`로 `"2026-35"` 같은 ISO 문자열을 직접 만든다 — **이 뷰는 별도로 다시 정의해야** `weekKey()`가 만드는 `"2026-N"` 형식과 맞는다.
- `prediction_results`(`20260824120000_prediction_results_week_settled.sql:64-65`)도 독립된 인라인 `date_trunc('week', ...)` 2개(정산 게이트 — "그 주 다른 경기가 안 끝났으면 이 행을 숨긴다")를 갖고 있다. 이 비교는 "같은 주인가"만 판정하면 되므로 포맷은 필요 없지만, **일요일 기준 식으로 통일하지 않으면 정산 게이트가 월요일 기준 그룹으로 계속 판정**돼 목록 화면(일요일 기준으로 바뀐 `groupFixturesByWeek`)과 어긋난다.
- `season_leaderboard`(`20260827130000_fix_leaderboards_public_profiles.sql:51`)는 `week_key`/주차 개념 자체가 없다 — `prediction_results` 전체를 `user_id`로만 묶어 합산한다. **주 경계 변경의 영향을 받지 않는다** — 근거: 뷰 정의에 `week`/`date_trunc` 언급 없음, `group by r.user_id, p.display_name, p.avatar_url`뿐.

### 1-2. 일요일 기준 치환식

Postgres `date_trunc('week', ts)`는 항상 월요일 기준(ISO)이라 파라미터로 바꿀 수 없다. 하루를 밀었다 당기는 방식으로 일요일 기준을 만든다:

```sql
date_trunc('week', (kickoff_at at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day'
```

실측 검증(실제 뉴캐슬 시즌 데이터, `fixtures` 테이블 직접 조회):

| 경기 | kickoff_at(UTC) | KST | 이 식의 결과(주 시작, 일요일 0시 KST) |
|---|---|---|---|
| PL 리버풀전 | 2026-08-23 15:30 | 08-24(월) 00:30 | 2026-08-23 (그 자신) |
| EFL컵 웨스트브롬전 | 2026-08-26 18:45 | 08-27(목) 03:45 | 2026-08-23 (리버풀전과 같은 주) |
| PL 토트넘전 | 2026-08-29 16:30 | 08-30(일) 01:30 | 2026-08-30 (다음 주로 갈라짐) |

intent.md가 서술한 "일→목 2경기 / 그다음 일요일부터 1경기" 분리가 실제 데이터로 정확히 재현됨을 확인.

---

## 2. 클라이언트 실측 (`frontend/src/lib/predictions/week.ts`)

### 2-1. 지금 구조

- `isoWeek(kst: Date): number` — ISO 8601 주차 번호(목요일이 속한 해 기준, 월요일 시작).
- `weekKey(kst: Date): string` — `"${ISO연도}-${isoWeek 2자리}"`, 예: `"2026-35"`.
- `currentWeekKey()` — `weekKey(now + 9h)`의 KST 시프트 래퍼.
- `groupFixturesByWeek()` — 경기를 `weekKey()`로 묶고, `fillGapWeeks()`가 **월요일 기준**으로 빈 주차를 채운다(`cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() || 7) - 1))`로 직전 월요일을 찾는 로직 — 일요일 기준으로 다시 써야 함).
- `emptyWeek()`가 `weekNo: isoWeek(kst)`를 채움 — 새 스킴에서는 `weekNo`와 `weekKey`의 숫자 부분이 **같은 값**이 된다(둘 다 시즌 순번이므로. 지금은 `weekNo`=ISO 주차, `weekKey`=`연도-ISO 주차`로 개념이 겹치되 값은 같았음 — 새 스킴에서도 값은 같지만 "ISO 주차"라는 의미가 없어짐).

### 2-2. 새 구현 방향 (2026-09-04 확정 반영)

```ts
const SEASON_CODE = '2627' // 2026-27시즌, 시즌 내내 고정

const SEASON_WEEK1_ANCHOR = Date.UTC(2026, 7, 23) // 2026-08-23(일) 00:00, KST 기준 날짜로 취급

// 프리시즌(친선경기) 주는 시즌 앵커 이전이라 정규 시즌처럼 "달력 주 하나 = 순번 1"인 닫힌
// 나눗셈 공식을 그대로 못 쓴다 — 친선경기 사이에 실제 경기가 없는 주(2026-08-02주)가 끼어
// 있어서, 날짜 산술만으로 "몇 번째 프리시즌 주인가"를 구하면 이 빈 주도 한 자리를 차지해
// M이 1,2,4,5가 되어버린다(§2-2-보충 "왜 닫힌 공식이 안 되는가" 참고). 사람이 확정한 값
// (M=1,2,3,4, 경기가 있는 주만 순서대로)과 어긋나므로, 실제 친선경기가 있는 주만 실측으로
// 나열한 앵커 목록에서 순번을 찾는 방식을 쓴다. 이번 시즌(2026-27) 프리시즌 전용 상수 —
// 다음 시즌 프리시즌 일정이 나오면 이 배열을 갱신해야 한다(§8, SEASON_WEEK1_ANCHOR와 동일한
// "시즌마다 갱신" 성격).
const PRESEASON_WEEK_ANCHORS = [
  Date.UTC(2026, 6, 19), // 07/19주 — 07-25(토) 킥오프
  Date.UTC(2026, 6, 26), // 07/26주 — 07-30(목) 킥오프
  Date.UTC(2026, 7, 9),  // 08/09주 — 08-09(일)·08-13(목)·08-15(토) 3경기
  Date.UTC(2026, 7, 16), // 08/16주 — 08-17(월, KST 기준) 킥오프
]

function sundayAnchorStart(kst: Date): Date {
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()) // getUTCDay(): 0=일요일
  return d
}

/**
 * 시즌 앵커 기준 순번. 정규 시즌은 양수(1부터), 프리시즌은 음수(-1 = 프리시즌 1번째 주 …
 * -4 = 프리시즌 4번째 주)로 반환해 두 구간이 절대 같은 숫자로 겹치지 않게 한다.
 * PRESEASON_WEEK_ANCHORS에 없는 프리시즌 주(예: 2026-08-02주처럼 친선경기가 없는 빈 주)는
 * null — 실제 경기가 있는 주에는 이 값이 나오지 않는다(§1 실측으로 6경기 전부 확인).
 */
function seasonWeekNo(kst: Date): number | null {
  const start = sundayAnchorStart(kst).getTime()
  if (start >= SEASON_WEEK1_ANCHOR) {
    return Math.floor((start - SEASON_WEEK1_ANCHOR) / (7 * 86_400_000)) + 1
  }
  const idx = PRESEASON_WEEK_ANCHORS.indexOf(start)
  return idx === -1 ? null : -(idx + 1)
}

function seasonWeekKey(kst: Date): string {
  const n = seasonWeekNo(kst)
  if (n === null) {
    throw new Error(
      `weekKey: PRESEASON_WEEK_ANCHORS에 없는 프리시즌 주(${sundayAnchorStart(kst).toISOString()}) — 앵커 목록 갱신 필요`,
    )
  }
  return n > 0 ? `${SEASON_CODE}-${n}` : `${SEASON_CODE}-0-${-n}`
}
```

`isoWeek()`/`weekKey()`를 각각 `seasonWeekNo()`/`seasonWeekKey()`의 계산 내용으로 교체(함수명 자체는
그대로 유지 — §0-6 확정). `fillGapWeeks()`는 "직전 일요일 찾기"(`cursor.getUTCDate() - cursor.getUTCDay()`)로
커서를 바꾸고, **`isoWeek(cursor)`가 `null`이면(프리시즌의 빈 주) 그 주는 빈 그룹으로 채우지 않고 건너뛴다**
(→ §6-신규-1, 이 스코프에서 새로 발견한 이슈).

> **§9·§10로 대체된 부분**: 위 `seasonWeekKey()` 스니펫의 `n === null`일 때 `throw`하는 부분은 이후
> §9(낙오 경기 "2526-1" 전용 앵커 추가)·§10(그 외 화이트리스트 밖 날짜는 throw 대신 null 반환)로
> 최종 대체됐다 — 이 스니펫은 "왜 이런 계산식이 필요한가"를 보여주는 최초 설계 의도만 유지하고,
> null 처리 방식의 최종 결정은 §9·§10을 따른다(구체 코드는 `plan.md` §2단계).

#### 2-2-보충: 왜 닫힌 공식(정규 시즌과 대칭 형태)이 안 되는가

정규 시즌 앵커(2026-08-23)에서 역방향으로 같은 나눗셈 공식(`floor(diffDays/7)+1`, diffDays가 음수)을
그대로 적용하면 나오는 값은 다음과 같다 — 사람이 확정한 M(1,2,3,4)과 다르다:

| 주 시작(일요일) | 닫힌 공식 결과(diffDays/7 그대로) | 확정된 M |
|---|---|---|
| 07-19 | -4 | 1 |
| 07-26 | -3 | 2 |
| 08-02 (경기 없음) | -2 | (해당 없음) |
| 08-09 | -1 | 3 |
| 08-16 | 0 | 4 |

08-02주는 친선경기가 없는데도 닫힌 공식에서는 한 자리(-2)를 차지한다. 확정된 M은 "경기가 있는
주만 시간순으로 1,2,3,4"이므로 이 빈 주를 건너뛴 순번이 필요하다 — 날짜 차이만으로는 어떤 주에
실제 경기가 있는지 알 수 없으므로(그건 실측 데이터이지 산술이 아니다) 닫힌 공식으로 대체할 수
없고, 실제 친선경기가 있는 주를 나열한 앵커 목록(`PRESEASON_WEEK_ANCHORS`)에서 인덱스를 찾는
방식을 채택했다. 이 목록은 §1 DB 실측(`Club Friendlies` 6경기, 전부 아래 표에 반영)으로 확정했다.

### 2-3. 실측: 이 계산으로 나오는 값 (§1-2·DB 재조회로 재확인, 2026-09-04)

| 경기 | kickoff_at(UTC) | KST | 새 weekKey |
|---|---|---|---|
| PL 리버풀전 | 2026-08-23 15:30 | 08-24(월) 00:30 | `2627-1` |
| EFL컵 웨스트브롬전 | 2026-08-26 18:45 | 08-27(목) 03:45 | `2627-1` |
| PL 토트넘전 | 2026-08-29 16:30 | 08-30(일) 01:30 | `2627-2` |
| 친선 (fixture 5898824, 07-25 11:30 UTC) | 2026-07-25 11:30 | 07-25(토) 20:30 | `2627-0-1` |
| 친선 (fixture 5898825, 07-29 18:30 UTC) | 2026-07-29 18:30 | 07-30(목) 03:30 | `2627-0-2` |
| 친선 (fixture 5898826, 08-08 19:00 UTC) | 2026-08-08 19:00 | 08-09(일) 04:00 | `2627-0-3` |
| 친선 (fixture 5739316, 08-12 16:15 UTC) | 2026-08-12 16:15 | 08-13(목) 01:15 | `2627-0-3` (위와 같은 주) |
| 친선 (fixture 5874663, 08-15 14:00 UTC) | 2026-08-15 14:00 | 08-15(토) 23:00 | `2627-0-3` (위와 같은 주, 3경기 그룹) |
| 친선 (fixture 5918243, 08-16 15:00 UTC) | 2026-08-16 15:00 | 08-17(월) 00:00 | `2627-0-4` |
| 2026-12-28(월) 09:00 KST | — | 12-28(월) 09:00 | `2627-19` |

친선경기 6경기의 `kickoff_at`은 `supabase db query --linked`로 2026-09-04 재조회해 확인한 실제 값
(§1 DB 실측과 동일 프로젝트, `fixtures` 테이블 `competition_name = 'Club Friendlies'`). 8/9·8/13·8/15
3경기가 한 주(`2627-0-3`)로 묶이는 것은 intent.md에서 이미 "신경 쓰지 않기로" 확인된 부분과 일치.

### 2-4. 호출 지점 전수 조사 (grep, `frontend/src`)

`isoWeek`/`weekKey`/`currentWeekKey`/`groupFixturesByWeek`를 참조하는 파일 전부:

| 파일 | 사용 방식 | 새 구현으로 교체 시 코드 변경 필요? |
|---|---|---|
| `lib/predictions/week.ts` | 정의 자체 | 예 (본체) |
| `lib/predictions/week.test.mjs` | 단위 테스트 | 예 — §7 참고 |
| `lib/queries/fixtures.ts` | `weekKey(toKst(kickoffAt))`로 `MatchdayFixture.weekKey` 채움, `groupFixturesByWeek()`로 주차 목록 생성 | 아니오 (함수 시그니처 그대로, 값만 바뀜) — 단 파일 내 주석(`"2026-35" — 승부예측 세션 URL 파라미터`)이 예시로 옛 포맷을 씀, drift로 갱신 필요 |
| `lib/mock/queries.ts` | 위와 동일(mock 모드) | 아니오 |
| `lib/actions/predictions.ts` | `weekKey: string`을 그대로 받아 `findWeekSession`/`revalidatePath`/analytics에 씀 | 아니오 (문자열로만 다룸) |
| `lib/queries/predictions.ts` | `getWeekRanking(weekKey)` → `week_leaderboard.week_key`와 `eq` 매칭 | 아니오 (DB 뷰의 `week_key` 포맷이 클라이언트와 같은 스킴으로 바뀌는 한) |
| `app/predictions/[weekKey]/page.tsx` | URL 파라미터 → `findWeekSession`으로 조회 | 아니오 (§4 참고 — URL 세그먼트 값만 바뀜) |
| `components/composition/common/AppAnalytics.tsx` | `currentWeekKey()`를 analytics 이벤트 속성(`week_key`)에 실음 | 아니오 |
| `components/composition/predict/PredictionFlowClient.tsx`, `PredictionDone.tsx`, `PredictionResult.tsx`, `PredictListClient.tsx` | `week.weekKey`/`week.weekNo`를 analytics 속성·라우팅·표시 텍스트(`N주차`, `N라운드`)에 씀 | 아니오 (값 위임) |
| `components/composition/predict/MatchdayHero.tsx` | `` `/predictions/${fixture.weekKey}` `` 라우팅 | 아니오 |
| `app/admin/ratings/page.tsx` | `weekLabel(week.weekNo)` → `"N주차"` 표시 | 아니오 |
| `types/database.ts:355` | `week_leaderboard.week_key` 타입 주석에 `"2026-35"` 예시 | drift, 주석 갱신 필요 |
| `app/dev/matchday-hero-preview/page.tsx`, `storybook/contents/MatchdayHero.stories.tsx` | 개발/스토리북 프리뷰에서 실제 `weekKey()` 호출 | 아니오 (자동으로 새 값) |
| `storybook/contents/MatchWeekList.stories.tsx` | `weekKey`/`weekNo`를 하드코딩한 mock prop(30~41 등, 실제 함수 호출 없음) | 아니오 — 함수를 안 거치는 순수 mock 데이터라 무관 |

**결론: `lib/predictions/week.ts` 본체 + 그 옆 테스트 파일 외에는 로직 변경이 필요한 호출부가 없다.** 나머지는 문자열 값이 새 포맷으로 바뀌는 것을 그대로 통과시킨다.

---

## 3. `weekKey` 형식 변경의 부수 영향 전수 조사

- **URL 라우팅** (`/predictions/[weekKey]`): `app/predictions/[weekKey]/page.tsx`는 `decodeURIComponent(params.weekKey)`로 그대로 `findWeekSession`에 넘기고, 못 찾으면 `notFound()`(HTTP 404). 정규식 검증이나 리다이렉트 로직은 없음 — 옛 포맷(`/predictions/2026-35`) URL은 배포 후 **그냥 404**가 된다(별도 처리 없음).
- **캐시 키**: `getWeekRankingRows`(`lib/queries/predictions.ts:153`)는 `unstable_cache(fn, ['week-ranking'], {revalidate: 60, tags:[RANKING_TAG]})` — Next.js가 `weekKey` 인자값 자체를 캐시 키에 포함시키므로(explicit key parts `['week-ranking']`는 네임스페이스일 뿐), 포맷이 바뀌어도 충돌 없이 새 키로 자연 분리된다. 옛 포맷으로 캐시된 항목은 `revalidate: 60`(60초)이라 배포 직후 곧 만료 — 별도 무효화 불필요.
- **`revalidatePath`** (`lib/actions/predictions.ts:107-108`): 경로 문자열에 `weekKey`를 그대로 삽입 — 포맷 무관하게 동작.
- **분석 이벤트** (`AppAnalytics.tsx`, `PredictionFlowClient.tsx`, `PredictionDone.tsx`, `PredictionResult.tsx`, `PredictListClient.tsx`, `lib/actions/predictions.ts`의 `trackServerEvent`): 전부 `week_key` 속성값으로 문자열을 그대로 싣는다. Mixpanel(외부 서비스)에 남는 과거 이벤트의 `week_key` 값은 그대로 옛 포맷으로 남고, 배포 시점부터 새 포맷이 섞여 들어간다 — **과거 이벤트를 소급 변환하는 절차는 없음(스코프 밖으로 간주, intent.md에 언급 없음)**.
- **DB 뷰 `week_leaderboard.week_key`**: §1에서 확인한 대로 별도 재정의 필요.

---

## 4. 근거 미확인 재확인 결과

### 4-1. "프리시즌 친선경기가 승부예측 대상에서 제외되어 있는가" → **제외되어 있지 않음 (실측 확인, 2026-09-04 승인으로 확정: 계속 노출)**

- `frontend/src/lib/queries/fixtures.ts:295-314`(`getFixtureWeeksUncached`)의 쿼리는 `fixtures` 테이블 전체를 `competition_name` 필터 없이 `kickoff_at` 오름차순으로 가져온다. `groupFixturesByWeek()`(`lib/predictions/week.ts:189`)도 `cancelled`/`kickoff_at` 유무로만 거르고 `competition_name`은 보지 않는다.
- 리포 전체(`frontend/src`, `supabase/migrations`)에 `"Friendl"` 문자열이 **단 한 곳도 없음**(grep 확인) — 어디에도 친선경기를 걸러내는 코드가 없다.
- DB 직접 조회 결과, `Club Friendlies` 6경기(2026-07-25~08-16) 전부 `cancelled = false`이고 `kickoff_at`도 채워져 있음 → **지금 이 순간도 승부예측 목록·URL·제출에 정상적으로 나타나고 예측 가능한 상태**.
- **확정(2026-09-04)**: 이 상태를 그대로 유지한다 — `getFixtureWeeksUncached()`/`groupFixturesByWeek()`에 `competition_name` 필터를 추가하지 않는다(구 §6-1의 A 기각). 대신 순번 대신 프리시즌 전용 포맷(`"2627-0-M"`, §2-2)으로 표기해 정규 시즌 번호와 절대 겹치지 않게 한다.
- **추가 확인(2026-09-04, `supabase db query --linked`로 `predictions` 조인 재조회)**: 이 6경기 전부 `prediction_count = 0` — **이미 제출된 친선경기 예측 데이터는 없다.** 따라서 이번 변경으로 소급 처리해야 할 기존 친선경기 예측 데이터는 없음(§0-2의 "전체 소급 적용" 결정에 새로 추가되는 리스크 없음).

### 4-2. "옛 ISO 주차 URL이 얼마나 실사용되는지" → **근거 미확인, 확인 불가 — 이번 스코프에서 호환성 미대응**

- 분석 데이터는 Mixpanel(외부 SaaS, `lib/analytics/mixpanel.ts`/`lib/analytics/server.ts`)에 있고, 이 리포/DB에는 페이지뷰·공유 링크 클릭 로그가 저장되지 않는다. 이 세션에서 접근 가능한 수단(코드, Supabase DB)으로는 옛 URL 실사용량을 확인할 방법이 없다.
- §3에서 확인한 대로 옛 포맷 URL은 배포 후 **그냥 404**로 처리된다(리다이렉트/301 없음). 이 동작을 그대로 두는 것으로 간주하고 진행한다 — 필요시 Mixpanel 콘솔을 직접 열람할 수 있는 사람이 실사용량을 확인 후 리다이렉트 요구사항을 추가할 수 있음(현재 스코프 밖).

---

## 5. 함수명 — **확정됨(2026-09-04)**

`isoWeek()`/`weekKey()`라는 함수명은 "ISO 8601 주차"라는 뜻인데, 변경 후에는 ISO 규칙을 전혀 안 쓴다(시즌 앵커 기준 순번). 두 개명 안(이름 유지+주석 정정 / `seasonWeekNo` 등으로 개명) 중 **이름은 그대로 유지, 주석만 정정**으로 확정됐다.

- 주석: "ISO 8601 규칙이 아니라 시즌 앵커 기준 순번(정규 시즌: 시즌코드-N, 프리시즌: 시즌코드-0-M)".
- 함수 내부 구현은 §2-2의 `seasonWeekNo`/`seasonWeekKey` 계산 내용을 그대로 담되, export되는 이름은 기존 `isoWeek`/`weekKey`를 유지한다(내부 헬퍼 `seasonWeekNo`/`seasonWeekKey`/`sundayAnchorStart`는 §2-2 코드처럼 모듈 비공개 함수로 두거나 `isoWeek`/`weekKey` 본체에 인라인해도 무방 — 이건 이름 발명이 아니라 파일 내부 구현 선택이라 plan.md 단계에서 정한다).

---

## 6. 확정된 결정 (2026-09-04 사람 승인)

### 6-1. 친선경기(시즌 앵커 이전 경기) 처리 방식 — **확정: B(화면·쿼리 그대로, 순번 대신 전용 포맷)**

§4-1에서 확인했듯 이 6경기는 지금 실제로 화면에 노출되고 예측 가능하다. 구 초안이 나열했던 A(화면·쿼리에서 제외)/B(순번 그대로 노출)/C(별도 표기) 중 **B를 골랐으되, "음수/0 순번을 그대로 노출"이 아니라 §2-2의 `"2627-0-M"` 전용 포맷으로 대체**하는 형태로 확정됐다 — DB 조회 쿼리(`getFixtureWeeksUncached()`)에 `competition_name` 필터를 추가하지 않으므로 A는 기각, 순번이 사람이 읽기 이상한 음수/0 그대로 노출되는 대신 `"2627-0-M"`이라는 명확한 프리시즌 마커를 쓰므로 원래의 B안 그대로도 아니다.

### 6-2. `weekKey`의 "연도" 자리 — **확정: 시즌 코드 `"2627"` 고정(안1/안2 둘 다 기각)**

구 초안의 안1(달력연도 2026 고정)/안2(그 주 실제 달력연도) 둘 다 채택되지 않고, **시즌 시작 연도(2026)와 종료 연도(2027)의 뒤 2자리를 합친 `"2627"`을 시즌 내내 고정 코드로 쓰는 방식**으로 확정됐다. 안1과 결과적으로 비슷하지만(둘 다 "연도 고정") 표기 자체가 스포츠 시즌 관례("26-27시즌")와 더 명확히 일치하고, 안1이 썼던 "2026" 그대로였다면 프리시즌(2026년 여름)과 정규 시즌 초반(마찬가지로 2026년) 표기가 헷갈릴 수 있었던 지점도 `"2627"`이라는 별도 코드로 구분된다.

### 6-3(신규 발견) — `fillGapWeeks()`가 프리시즌의 "경기 없는 빈 주"를 만나면 죽는 문제

**이번 세션에서 M 계산식을 설계하다가 새로 발견한 이슈** — 정확히는 "새 프로덕션 데이터 판단"이 아니라 **로직 결함(구현하면 확실히 터지는 버그) 발견**이라 에스컬레이션 대신 여기 설계로 반영하고, plan.md 승인 시 함께 확인받는다.

- `/predictions` 목록 페이지(`app/predictions/page.tsx`)는 `getFixtureWeeks()`로 **시즌 전체 픽스처**(친선경기 포함, 필터 없음)를 가져와 `groupFixturesByWeek()`에 넘긴다. 이 함수의 `fillGapWeeks()`는 "경기가 있는 두 주 사이에 빈 주가 있으면 빈 그룹으로 채운다"를 위해 커서를 한 주씩 뒤로 물리며 매번 `weekKey(cursor)`를 호출한다.
- 프리시즌 구간에는 실제로 경기가 없는 빈 주가 하나 있다 — **2026-08-02주**(07-26주와 08-09주 사이, §2-2-보충 표 참고). `PRESEASON_WEEK_ANCHORS`에는 "경기가 있는 주"만 등록했으므로, 이 빈 주에 대해 `weekKey()`를 그대로 부르면(§2-2의 `seasonWeekKey`) **예외를 던진다.**
- 즉 §2-2에서 설계한 대로 구현하면 `/predictions` 목록 페이지가 이 지점에서 **매 요청마다 에러를 던져 렌더링이 깨진다** — 순수하게 이번 M 설계(경기 있는 주만 순번을 매기는 방식) 때문에 새로 생기는 문제이고, 지금(월요일 ISO 기준)은 모든 달력 주에 번호가 있어 이런 "빈 주에서 못 구하는" 케이스 자체가 없었다.
- **해결(설계, plan.md에 반영)**: `fillGapWeeks()`의 루프에서 `isoWeek(cursor)`(§2-2의 `seasonWeekNo`)가 `null`이면 그 주는 **빈 그룹을 만들지 않고 건너뛴다**(에러를 던지지 않고 continue). 결과적으로 `/predictions` 목록에서 2026-08-02주는 "이번 주는 경기가 없어요" placeholder조차 뜨지 않고 07/26 친선주 다음에 08/09 친선주가 바로 이어진다 — 이 화면 동작(빈 프리시즌 주를 아예 표시하지 않음)이 맞는지는 **UI 관점에서 designer 확인이 필요할 수 있으나, 크래시를 막는 최소 방어 로직 자체는 구현에 반드시 필요**하다고 판단해 여기 명시한다.
- 정규 시즌 구간에는 이런 "번호를 못 구하는 빈 주"가 없다(닫힌 나눗셈 공식이라 모든 정수에 대해 항상 값이 나옴) — 이 문제는 프리시즌 전용이다.

### 6-4(신규 확인) — `week_leaderboard`가 친선경기 예측도 정상 집계하는지

§0-3 결정(친선경기 계속 노출·예측 가능)에 따라 **DB 랭킹 뷰에서도 친선경기 예측이 정상 집계돼야 한다.** 확인 결과:

- `public.week_leaderboard`(`20260827130000_fix_leaderboards_public_profiles.sql:22`)는 `public.prediction_results`를 `week_key`(현재는 `to_char(..., 'IYYY-IW')`)로 그룹핑할 뿐, **`competition_name`으로 거르는 필터가 없다.**
- `public.prediction_results`(`20260824120000_prediction_results_week_settled.sql:22`) 자체도 `where f.finished and not exists (...)` 조건만 있고 **`competition_name` 필터가 없다** — 친선경기든 정규 시즌 경기든 `finished = true`이고 그 주 다른 경기가 다 끝났으면 그대로 나온다. 6경기 전부 이미 종료된 과거 경기라 `finished = true`일 것(플레이됨 확인, §1 실측).
- 따라서 **친선경기 예측이 존재했다면 이미 `week_leaderboard`에 집계됐을 것**이고, 이번 변경(week_key 계산식을 `"2627-0-M"` 포맷으로 바꾸는 것)이 이 집계 여부 자체를 바꾸지는 않는다 — 바뀌는 건 그 집계 행의 `week_key` **값**(문자열 포맷)뿐이다.
- §4-1에서 확인한 대로 **이 6경기에 실제 제출된 예측은 0건**이므로, 소급 처리할 기존 데이터는 없다. 앞으로 이 경기들에 예측이 제출된다면(과거 경기라 이제 마감된 상태 — 실제로 새로 제출될 일은 없음, 이미 `kickoff_at`이 지남) `week_leaderboard`는 새 `"2627-0-M"` 포맷으로 정상 집계한다.

---

## 7. 테스트 영향 (`lib/predictions/week.test.mjs`)

전부 갱신 필요. 값 재계산뿐 아니라 **시나리오 자체가 바뀌는 케이스**가 있다:

- `'currentWeekKey: ...'` 3개 테스트(41, 51, 58행) — 기대값을 새 포맷/앵커 기준으로 재계산.
- **`'같은 주 경기 2개는 한 예측 세션(주차)으로 묶인다 (더블 매치위크)'`(83행)는 이 스코프에서 픽스처 자체를 바꿔야 한다.** 지금 이 테스트가 쓰는 두 경기(8/23 PL, 8/29 EFL컵)는 실측 결과(§1-2) 그대로 재현되는 조합인데, **일요일 경계로 바뀌면 이 둘은 더 이상 같은 주가 아니다**(8/23→1주차, 8/29→2주차로 갈라짐 — §2-3 확인). 더블 매치위크가 실제로 유지되는 조합(예: 일요일 경기 + 그 뒤 목요일 경기)으로 픽스처 날짜를 바꿔 테스트 취지(같은 주 2경기 그룹핑)를 그대로 살려야 한다.
- `'경기 없는 중간 주차는 빈 그룹으로 채워진다'`(101행) — 구조(그룹 4개, 빈 그룹 2개)는 유지되지만 `weekKey` 값들은 재계산.
- `'findWeekSession: weekKey로 주차 세션을 찾는다'`(179행), `'toPredictWeeks: ...'`(197, 264, 285행) — 리터럴 `'2026-35'`, `'2026-36'`, `'1999-01'` 등 재계산.
- §6 확정(시즌 코드 `"2627"`, 프리시즌 `"2627-0-M"`)에 따라 위 리터럴은 전부 `"2627-N"`/`"2627-0-M"` 형태로 재계산한다(plan.md 4단계에서 구체 값 확정).
- **신규 추가 케이스(§6-3 반영)**: `groupFixturesByWeek()`가 프리시즌 경기(예: 07-25·08-09 등)를 포함한 입력을 받았을 때 (a) 각 친선경기가 올바른 `"2627-0-M"` weekKey로 묶이는지, (b) 3경기가 겹치는 08/09주가 한 그룹으로 묶이는지(트리플 매치위크와 동일한 방식), (c) **친선경기 사이 빈 주(2026-08-02주)가 있어도 에러 없이 정상 동작하는지**(§6-3의 크래시 방지 로직 검증)를 확인하는 테스트를 추가한다.

---

## 8. 스코프 밖 (건드리지 않음)

- 옛 ISO 주차 형식 URL → 새 형식 리다이렉트: intent.md가 이번 스코프에서 다루지 않기로 확정(§4-2 참고, 근거 미확인 유지).
- Mixpanel에 이미 쌓인 과거 이벤트의 `week_key` 소급 변환.
- 다음 시즌(2027-28) 앵커 재설정 — `SEASON_WEEK1_ANCHOR` 상수는 이번 시즌 전용이며, 시즌이 바뀌면 별도 작업으로 갱신 필요(이번 spec은 그 갱신 메커니즘을 설계하지 않는다).
- 프리시즌 주 `weekNo` 음수 표시(UI 카피)와 "시즌 경계 자동 감지" 2건은 2026-09-04에 추가로
  후속 이슈 분리가 확정됐다 — 근거·결론은 `plan.md`의 "스코프 밖(후속 이슈)" 절 참고.

---

## 9. 낙오 경기(2025-26시즌 최종전) — 신규 발견, 2026-09-04 확정

plan.md 작성 중 `supabase db query --linked`로 `fixtures` 테이블을 전수 조회하다가 발견한, §1(DB 실측)
때는 안 보였던 별도 버그다.

### 9-1. 실측

- `fixture_id = 4813748`, `competition_name = 'Premier League'`, `kickoff_at = '2026-05-24 15:00:00+00'`
  (KST로는 `2026-05-25`, 월요일), `cancelled = false`, 이 경기에 제출된 예측 `0`건.
- 2025-26시즌 최종전이다. `SEASON_WEEK1_ANCHOR`(2026-08-23)보다 한참 이전이고, `PRESEASON_WEEK_ANCHORS`
  (07/19주부터 시작)보다도 이전 날짜라 두 화이트리스트 어디에도 안 걸린다.
- `sundayAnchorStart(kst)` 계산 결과는 `2026-05-24`(일요일) — 실제로 이 값 자체가 일요일이다(파이썬으로
  직접 재계산해 확인: KST `2026-05-25`(월)의 그 주 일요일 = `2026-05-24`).
- `getFixtureWeeksUncached()`(`lib/queries/fixtures.ts:295-314`)가 `fixtures` 테이블 전체를 필터 없이
  가져오므로(§4-1에서 이미 확인한 대로 `competition_name` 필터가 없음) 이 경기가 그대로 걸린다. 지금
  설계(§2-2)의 `seasonWeekNo()`는 이 날짜에 대해 `null`을 반환하고 `seasonWeekKey()`는 `throw` —
  **`/predictions` 목록 페이지가 배포 즉시(첫 요청부터) 크래시한다.** 변경 전 코드(순수 ISO 계산,
  월요일 시작)는 이런 화이트리스트 자체가 없어 이 문제가 없었다 — **이번 PR이 새로 만드는 회귀**다.

### 9-2. 처리 방식 — 확정(재질문 대상 아님)

이 경기를 `"2526-1"`로 명시 처리한다.

- 시즌 코드 `"2526"`(2025-26시즌, 정규 시즌 시즌 코드 `"2627"`과 별개 상수).
- 순번은 `1` 고정 — DB 실측 결과 이 시즌(2026-07-19 이전) 데이터가 이 경기 1건뿐이라(2025년 데이터
  0건, 2026-07-19 이전 fixture가 이 1건 외엔 없음) 별도 순번 계산식이 필요 없다.
- 구현 패턴은 `PRESEASON_WEEK_ANCHORS`(화이트리스트에 앵커 추가)와 동일하되, "2627 프리시즌"이
  아니라 "이전 시즌(2526)"이라는 점이 다르다 — 별도 상수 `PREVIOUS_SEASON_CODE`(`'2526'`)와
  `PREVIOUS_SEASON_STRAY_ANCHOR`(`Date.UTC(2026, 4, 24)`, 2026-05-24 일요일)로 둔다. 구체 코드는
  `plan.md` §2단계 참고.
- DB `week_leaderboard` 뷰의 `case`문에도 같은 분기(`when s.sunday_start = date '2026-05-24' then
  '2526-1'`)를 추가한다 — 이 경기는 예측 0건이라 뷰에서 실제로 나올 일은 없지만, 일관성과 향후
  방어를 위해 넣는다(구체 SQL은 `plan.md` §1단계 참고).

---

## 10. 방어 로직 — 화이트리스트 밖 과거 날짜는 throw 대신 null

§9의 "2526-1"은 **이번에 알려진 특정 낙오 경기 하나만** 화이트리스트에 추가해 명시적으로 해결한
것이다. 그와 별개로, 지금 설계(§2-2)는 (정규 시즌 앵커 이후도 아니고, 프리시즌 화이트리스트에도
없고, §9의 "2526-1" 앵커에도 안 걸리는) **완전히 알 수 없는 과거 날짜**를 만나면 여전히 `throw`
한다 — 예를 들어 다음 시즌 전환 때 `PRESEASON_WEEK_ANCHORS`/`SEASON_WEEK1_ANCHOR` 갱신을 사람이
깜빡하면 같은 유형의 크래시가 또 재현된다.

**확정(2026-09-04)**: 이 `throw`를 버리고 `null`을 반환하도록 바꾼다.

- `seasonWeekNo()`/`seasonWeekKey()`(export명은 그대로 `isoWeek()`/`weekKey()`, §5 확정 유지)가
  세 화이트리스트(정규 시즌 앵커, 프리시즌 앵커, 낙오 경기 앵커) 어디에도 없는 날짜를 만나면 `null`을
  반환한다. `weekKey()`의 반환 타입이 `string`에서 `string | null`로 바뀐다.
- 이 `null`이 상위 호출부(`lib/queries/fixtures.ts`의 `getFixtureWeeksUncached()`가 호출하는
  `groupFixturesByWeek()`)에 전파되면, **그 경기 하나만 목록에서 조용히 빼고(스킵) 페이지 전체는
  안 깨지도록** 한다. `groupFixturesByWeek()`가 이미 갖고 있던 "친선경기 없는 빈 주를 건너뛰는"
  `fillGapWeeks()`의 null-skip 패턴(§6-3)과 같은 방향으로, **실제 fixture 행에 대해서도** null이면
  스킵하도록 일관되게 확장한다 — 앞서 §6-3/plan.md 초안이 "실제 fixture 행의 null은 앵커 목록이
  실제 데이터와 어긋난 이상 상태이니 바로 알 수 있게 던진다"고 했던 설계는 **이 확정으로 대체된다**
  (조용히 스킵 + `console.error`로 로그만 남김 — 구체 코드는 `plan.md` §2단계 참고).
- 목적: 다음 시즌 전환 때 사람이 앵커 상수 갱신을 깜빡해도 "크래시"가 아니라 "경기 하나 누락" 정도로
  그치는 안전망을 만드는 것.
- DB `week_leaderboard` 뷰는 이미 `else null` → `where w.week_key is not null`로 이 패턴을 쓰고
  있으므로(§1-2/6-1 원 설계) **DB 쪽은 변경 불필요, 그대로 유지**(이미 안전).
- **타입 파급**: `weekKey()`가 `string | null`이 되면서, `weekKey(...)`를 직접 호출해 넌널 문자열
  필드(`MatchdayFixture.weekKey: string`)에 대입하는 다른 호출부(`lib/queries/fixtures.ts:114`의
  `toMatchdayFixture()`, `lib/mock/queries.ts:137`의 `mockGetHomeMatchdayFixture()`,
  `app/dev/matchday-hero-preview/page.tsx:19`의 `withWeekKey()`)와 `currentWeekKey()`를 쓰는
  `AppAnalytics.tsx:71`도 타입 상 `string | null`을 받게 된다. 실측 확인: 이 네 곳은 전부 "지금"에
  가까운 날짜만 다룬다(다음/최근 경기 1건, mock의 `Date.now()` 기준, dev 프리뷰의 `Date.now()` 기준)
  — 화이트리스트가 최신 상태인 한 실제로 `null`이 나올 일은 없다. 다만 컴파일이 깨지므로 구현
  시 `?? ''`(또는 적절한 폴백)로 타입만 좁혀줘야 한다 — 이건 로직 변경이 아니라 타입 정리이므로
  plan.md 단계에서 구체 처리한다.
