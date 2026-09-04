# feature-spec — 승부예측 주 경계 일요일 기준 변경

작성: 2026-09-04 · 작성자: developer 에이전트
입력: `intent.md`(확정된 결정 3가지 + 근거 미확인 2건) — 이 문서는 그 위에 실측 조사 결과를 얹는다.

## 0. 전제 (재질문 대상 아님, intent.md에서 확정)

1. 주차 경계: 일요일 0시(KST) 시작, 일요일~토요일.
2. 소급 범위: 전체 소급 적용(과거 랭킹도 새 기준으로 재계산됨을 감수).
3. `weekKey` 형식: `"2026-N"`(연도-순번), 시즌 1주차 기준일 = 2026-08-23(일요일).
   순번 = `floor((그 경기 킥오프의 일요일 앵커 날짜 - 2026-08-23) / 7일) + 1`.
   프리시즌 친선경기(Club Friendlies)는 시즌 주차 번호에 포함하지 않는다.

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

### 2-2. 새 구현 방향

```ts
const SEASON_WEEK1_ANCHOR = Date.UTC(2026, 7, 23) // 2026-08-23(일) 00:00, KST 기준 날짜로 취급

function sundayAnchorStart(kst: Date): Date {
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()) // getUTCDay(): 0=일요일
  return d
}

function seasonWeekNo(kst: Date): number {
  const start = sundayAnchorStart(kst)
  const diffDays = Math.round((start.getTime() - SEASON_WEEK1_ANCHOR) / 86_400_000)
  return Math.floor(diffDays / 7) + 1
}
```

`isoWeek()`/`weekKey()`를 이 계산으로 교체(이름은 §5 참고 — 확정 아님). `fillGapWeeks()`의 커서 로직은 "직전 일요일 찾기"(`cursor.getUTCDate() - cursor.getUTCDay()`)로 바꾼다.

### 2-3. 실측: 이 계산으로 나오는 값 (§1-2와 동일 실제 데이터)

| 경기 | 새 weekKey (연도 고정 가정 시) |
|---|---|
| PL 리버풀전 (08-23) | `2026-1` |
| EFL컵 웨스트브롬전 (08-26) | `2026-1` |
| PL 토트넘전 (08-29) | `2026-2` |
| 친선 Gateshead전 (07-25) | `2026--4` ← §6-1 참고, 미해결 |
| 친선 Strasbourg전 (08-16) | `2026-0` ← 미해결 |
| 2026-12-28(월) 09:00 KST | `2026-19` |

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

### 4-1. "프리시즌 친선경기가 승부예측 대상에서 제외되어 있는가" → **제외되어 있지 않음 (실측 확인, 결정 필요)**

- `frontend/src/lib/queries/fixtures.ts:295-314`(`getFixtureWeeksUncached`)의 쿼리는 `fixtures` 테이블 전체를 `competition_name` 필터 없이 `kickoff_at` 오름차순으로 가져온다. `groupFixturesByWeek()`(`lib/predictions/week.ts:189`)도 `cancelled`/`kickoff_at` 유무로만 거르고 `competition_name`은 보지 않는다.
- 리포 전체(`frontend/src`, `supabase/migrations`)에 `"Friendl"` 문자열이 **단 한 곳도 없음**(grep 확인) — 어디에도 친선경기를 걸러내는 코드가 없다.
- DB 직접 조회 결과, `Club Friendlies` 6경기(2026-07-25~08-16) 전부 `cancelled = false`이고 `kickoff_at`도 채워져 있음 → **지금 이 순간도 승부예측 목록·URL·제출에 정상적으로 나타나고 예측 가능한 상태**.
- **따라서 intent.md의 전제("승부예측 대상 자체가 아닐 가능성이 높음")는 틀렸다.** 이 6경기는 새 앵커(2026-08-23) 이전이라 §2-3처럼 순번이 음수/0이 되는데, 이 경기들을 화면에 계속 보여줄지에 대한 결정이 없으면 `weekKey`가 `"2026--4"`, `"2026-0"` 같은 값으로 URL·DB에 그대로 노출된다. **§6-1에서 승인 필요 항목으로 분리.**

### 4-2. "옛 ISO 주차 URL이 얼마나 실사용되는지" → **근거 미확인, 확인 불가 — 이번 스코프에서 호환성 미대응**

- 분석 데이터는 Mixpanel(외부 SaaS, `lib/analytics/mixpanel.ts`/`lib/analytics/server.ts`)에 있고, 이 리포/DB에는 페이지뷰·공유 링크 클릭 로그가 저장되지 않는다. 이 세션에서 접근 가능한 수단(코드, Supabase DB)으로는 옛 URL 실사용량을 확인할 방법이 없다.
- §3에서 확인한 대로 옛 포맷 URL은 배포 후 **그냥 404**로 처리된다(리다이렉트/301 없음). 이 동작을 그대로 두는 것으로 간주하고 진행한다 — 필요시 Mixpanel 콘솔을 직접 열람할 수 있는 사람이 실사용량을 확인 후 리다이렉트 요구사항을 추가할 수 있음(현재 스코프 밖).

---

## 5. 이름 관련 확인 필요 사항 (구조 발명 방지 — 결정 아님, 확인 요청)

`isoWeek()`/`weekKey()`라는 함수명은 "ISO 8601 주차"라는 뜻인데, 변경 후에는 ISO 규칙을 전혀 안 쓴다(임의 앵커 기준 순번). 이름을 그대로 두면 코드를 읽는 사람이 오해한다.

- 안: 이름은 그대로 두고 주석만 "시즌 앵커 기준 순번"으로 정정 (안전, 개명 없음)
- 안: `isoWeek` → `seasonWeekNo` 등으로 개명 (더 정확하지만 새 이름을 developer가 짓는 셈)

**둘 다 스스로 확정하지 않고 plan.md 승인 시 함께 확인받는다** — CLAUDE.md 1번 규칙(이름 임의 발명 금지) 위반을 피하기 위함. plan.md는 "이름 유지 + 주석 정정"을 기본안으로 제시하되 최종은 승인자 선택.

---

## 6. 미해결 — 구현 전 승인 필요 (에스컬레이션 대상)

### 6-1. 친선경기(시즌 앵커 이전 경기) 처리 방식 — **결정 없음, 프로덕션 데이터에 영향**

§4-1에서 확인했듯 이 6경기는 지금 실제로 화면에 노출되고 예측 가능하다. intent.md의 결정 3번은 "친선경기는 시즌 주차 번호에 포함하지 않는다"만 정했고, 그 경기들이 화면에서 **어떻게 보여야 하는지**는 정하지 않았다. 옵션(택 1, 발명 아님 — 실제로 선택 가능한 경우의 수를 나열):

- **A. 화면에서 제외** — `getFixtureWeeksUncached()` 쿼리 또는 `groupFixturesByWeek()`에 `competition_name <> 'Club Friendlies'` 필터 추가. intent.md가 원래 가정했던 상태를 실제로 만드는 것. **DB 조회 로직 변경**(스키마 자체는 안 바뀜)이라 developer-agent-rules 에스컬레이션 기준("스키마/프로덕션 데이터에 영향을 주는 변경")에 해당해 임의 진행하지 않음.
- **B. 화면엔 그대로 두고 음수/0 순번을 그대로 노출** — `weekKey`가 `"2026--4"`, `"2026-0"` 같은 형태로 URL에 나간다. 사용자 경험상 이상하지만 구현은 A보다 단순.
- **C. 화면엔 그대로 두되 시즌 앵커 이전 주차는 별도 표기**(예: 순번 없이 날짜만) — 이 경우 `weekKey` 포맷 자체에 "순번 없음" 케이스를 추가해야 해서 intent.md가 확정한 "`weekKey` = 연도-순번" 포맷의 예외를 새로 만드는 셈.

이 3가지 모두 intent.md에 없는 판단이라 **임의로 고르지 않고 사람 확인 후 plan.md를 확정한다.**

### 6-2. `weekKey`의 "연도" 자리 — 시즌 시작 연도 고정 vs 그 주의 실제 달력 연도

intent.md는 순번 계산식만 확정했고 "연도" 자리의 정의는 없다. 시즌이 2026년 8월~2027년 5월경까지 이어지므로 12월 이후 주차는 실제 달력 연도가 2027로 넘어간다.

- **안 1(개발자 판단, 리스크 회피 관점에서 권장)**: "연도"를 시즌 개막 연도(2026)로 **시즌 내내 고정**. 스포츠 시즌 표기 관례(예: "2026-27시즌")와 맞고, 이미 확정된 순번 계산식이 달력 연도를 안 쓰므로 구현이 단순하며 연말 롤오버 버그 여지가 없다.
- **안 2**: 그 주 일요일 앵커의 실제 달력 연도를 씀 — 12월 마지막 주부터 "2027-N" 형태로 바뀐다. 이러면 순번(N)이 그대로 이어지는데 연도만 바뀌어 오해 소지(예: "2027-19"가 2026시즌 19번째 주).

§1-2 표의 `2026-12-28` 행은 안 1로 계산한 값(`2026-19`)이다. **이 항목도 확정된 결정에 없으므로 사람 확인 필요.**

---

## 7. 테스트 영향 (`lib/predictions/week.test.mjs`)

전부 갱신 필요. 값 재계산뿐 아니라 **시나리오 자체가 바뀌는 케이스**가 있다:

- `'currentWeekKey: ...'` 3개 테스트(41, 51, 58행) — 기대값을 새 포맷/앵커 기준으로 재계산.
- **`'같은 주 경기 2개는 한 예측 세션(주차)으로 묶인다 (더블 매치위크)'`(83행)는 이 스코프에서 픽스처 자체를 바꿔야 한다.** 지금 이 테스트가 쓰는 두 경기(8/23 PL, 8/29 EFL컵)는 실측 결과(§1-2) 그대로 재현되는 조합인데, **일요일 경계로 바뀌면 이 둘은 더 이상 같은 주가 아니다**(8/23→1주차, 8/29→2주차로 갈라짐 — §2-3 확인). 더블 매치위크가 실제로 유지되는 조합(예: 일요일 경기 + 그 뒤 목요일 경기)으로 픽스처 날짜를 바꿔 테스트 취지(같은 주 2경기 그룹핑)를 그대로 살려야 한다.
- `'경기 없는 중간 주차는 빈 그룹으로 채워진다'`(101행) — 구조(그룹 4개, 빈 그룹 2개)는 유지되지만 `weekKey` 값들은 재계산.
- `'findWeekSession: weekKey로 주차 세션을 찾는다'`(179행), `'toPredictWeeks: ...'`(197, 264, 285행) — 리터럴 `'2026-35'`, `'2026-36'`, `'1999-01'` 등 재계산.
- 이 갱신은 §6의 두 미해결 항목(연도 표기 방식)이 확정된 뒤에만 정확한 기대값을 쓸 수 있다 — 순번(N)은 확정 계산식으로 지금도 산출 가능하지만 문자열 전체(`"2026-N"`)는 §6-2 확정 후 채운다.

---

## 8. 스코프 밖 (건드리지 않음)

- 옛 ISO 주차 형식 URL → 새 형식 리다이렉트: intent.md가 이번 스코프에서 다루지 않기로 확정(§4-2 참고, 근거 미확인 유지).
- Mixpanel에 이미 쌓인 과거 이벤트의 `week_key` 소급 변환.
- 다음 시즌(2027-28) 앵커 재설정 — `SEASON_WEEK1_ANCHOR` 상수는 이번 시즌 전용이며, 시즌이 바뀌면 별도 작업으로 갱신 필요(이번 spec은 그 갱신 메커니즘을 설계하지 않는다).
