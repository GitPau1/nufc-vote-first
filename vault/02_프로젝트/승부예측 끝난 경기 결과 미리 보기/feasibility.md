# feasibility — 승부예측 끝난 경기 결과 미리 보기 (TEA-34)

작성: 2026-09-05 · 작성자: developer 에이전트(조사 전용, 코드 수정 없음)

## 0. 먼저 알려야 할 것 — 같은 폴더에 상충하는 design-brief.md가 이미 있음

이 프로젝트 폴더(`vault/02_프로젝트/승부예측 끝난 경기 결과 미리 보기/`)에 **오늘 날짜(2026-09-05)로
이미 `design-brief.md`+`mockup.html`가 존재한다.** intent.md는 없다. 그 브리프는 이번 요구와
겹치지만 결론이 다르다:

- 그 브리프의 §0 "사용자 확정 사항": "표시 내용: **내 예측 판정만**(맞았는지, 그 경기 점수). 다른
  참여자 분포는 제외" — 그런데 §3 카드 상태표의 ③(종료·판정)은 "**포인트·랭킹 없음**(요구사항
  그대로, 기존 동작 유지)"이라고 못박았다. "그 경기 점수"라는 문구가 있음에도 실제 결론은 점수 비표시.
- 반면 이번 지시(TEA-34, 스크린샷 확정)는 "경기 예측" 카드 우상단 "+N점", "내 선수 픽" 카드 우상단
  "+N점" 합계까지 **명시적으로 요구**한다.

즉 같은 화면·같은 상태(끝난 경기, 주차 진행 중)에 대해 **점수를 보여줄지 말지가 정반대로 결론 나 있다.**
어느 쪽이 최신 확정인지, 기존 design-brief를 폐기/개정할지부터 사용자에게 확인이 필요하다(8절 결정
항목 1). 이 문서의 나머지는 TEA-34의 요구(점수 노출 포함)를 기준으로 조사했다.

---

## 1. 데이터 출처 표

| 요소 | 출처 | 게이트(주차 완료 필요?) |
|---|---|---|
| 내 예측 스코어 | `predictions` 테이블, `getMyPredictions()`(`lib/queries/predictions.ts`) | 없음 — 제출 즉시 조회 가능 |
| 실제 결과 스코어 | `fixtures.home_score`/`away_score`, `MatchView.actual`(`lib/predictions/week.ts`) | 없음 — 경기 종료(`finished`)만 있으면 됨 |
| **스코어 예측 점수("+N점")** | `prediction_results` view의 `match_points`(SQL 함수 `prediction_match_points()`, `supabase/migrations/20260830150000_toon_cup_scoring.sql:8-17`) | **있음** — view의 WHERE 절(같은 파일 L83-90, 그 주에 안 끝난 경기가 하나라도 있으면 행 자체가 안 나옴) |
| **선수 픽 점수("+N점")** | 같은 view의 `pick_points`(`prediction_pick_points()`, 포지션 후보 평점 순위 기반, 같은 파일) | **있음** — 위와 동일 WHERE 절 |
| 내 픽 선수·평점 | `getMyResults()`가 반환하는 `picks[position].rating`(같은 view) 또는 원본 스냅샷은 `getMyPredictions()` | 점수/순위 없이 "누굴 골랐는지"만 필요하면 게이트 없음(`getMyPredictions()`) |
| 후보 3명 목록(포지션별) | `getFixturePositionTop3(fixtureId)`(`lib/queries/fixtures.ts:224`) — `fixture_player_ratings` + `season_squads` 직접 조회 | **없음** — fixture 단위 함수, 이미 공개 조회, 주차 상태 무관 |

## 2. 경기 단위 계산 가능 여부 — 가능하다, 이미 순수 SQL 함수로 존재

`prediction_results` view의 실제 계산부(`supabase/migrations/20260830150000_toon_cup_scoring.sql:33-72`)는
**전부 `p.fixture_id = f.fixture_id` 조인 하나로 끝나는 경기 단위 계산**이다. 주차 개념이 전혀
안 들어간다:

- `prediction_match_points(pred_home, pred_away, actual_home, actual_away, is_cup)` — 스코어 예측 점수. 대회별 배점(리그 8/5, 컵 5/3)만 인자로 받는 순수 SQL 함수(`is cup` 판정은 `competition_name`으로 그 경기 안에서 끝남).
- `prediction_pick_points(pos_rank, is_cup)` — 선수 픽 점수. `pos_rank`는 `ranked` CTE(같은 파일 L40-52)가 **그 경기·그 포지션 안에서만**(`partition by fpr.fixture_id, s.position`) 평점 순위를 매긴 값이라, 이것도 경기 단위로 완결된다.

주차 개념이 들어가는 곳은 딱 한 군데, view 맨 아래 WHERE 절이다:

```sql
where f.finished
  and not exists (
    select 1 from public.fixtures f2
    where f2.cancelled = false and f2.finished = false and f2.kickoff_at is not null
      and date_trunc('week', f2.kickoff_at at time zone 'Asia/Seoul')
        = date_trunc('week', f.kickoff_at  at time zone 'Asia/Seoul')
  );
```

이 `not exists` 절만 없으면 지금 이 view가 정확히 요구된 "끝난 경기 하나만" 미리보기 데이터다.
그 아래(`week_leaderboard`/`season_leaderboard`)는 이 view 위에 얹혀 있어서, 이 게이트를 건드리지
않는 한 랭킹 유출 위험은 없다.

## 3. 선수 평점 적재 시점

`fixture_player_ratings`는 Edge Function `sync-fixture-ratings`(크론 KST 08:05)가 채운다.
종료됐고 평점 행이 11개 미만인 경기를 최신순 최대 5경기씩 처리한다(`vault/99_old/AGENT_MAINTENANCE_GUIDE.md:98`,
`vault/99_old/SUPABASE_DATA_CONNECTIONS.md:626`). 이 적재는 **경기 단위**로 동작하고 주차 완료를
기다리지 않는다 — `getFixturePositionTop3()`도 마찬가지로 경기 단위 조회라 주차 진행 중에도 그 경기가
끝나고 크론이 한 번 돌면(당일 08:05, 늦어도 다음날) 바로 조회 가능하다. 다만 평점이 일부만 내려온
상태(크론 배치 상한 5경기, 또는 FotMob이 종료 직후 일부만 제공)에서는 후보 3명 중 일부가 비거나
`rating: null`일 수 있다 — 화면이 이 상태를 어떻게 보여줄지는 별도 확인 필요(8절).

## 4. 막는 요인 — 정책인가 구현 편의인가

**둘 다 아니고, "다른 목적(랭킹 조기 유출 방지)을 위해 만든 게이트가 이번 요구까지 같이 막고 있다"가
정확한 설명이다.**

- `supabase/migrations/20260824120000_prediction_results_week_settled.sql:1-19` 주석 원문: "점수·랭킹은
  주차가 다 끝난 뒤에만 공개한다(정산 게이트)... 주차가 진행 중인 동안의 부분 점수는 **랭킹으로서**
  의미가 없다." 즉 이 게이트가 막으려던 건 "부분 점수가 주차 랭킹에 새는 것"이지, "경기 하나의 점수를
  그 경기 참여자 본인에게 보여주는 것"이 아니다. `vault/10_gun/승부예측-랭킹-요구사항-명세서.md`의
  NFR-001/CST-006도 랭킹·집계 단위 이야기이지, 경기 단위 조기 공개를 금지하는 문구는 없다(근거
  미확인 — 명시적으로 "경기 단위 조기 공개 금지"라고 쓴 문장은 명세서에 없음).
- `PredictionDone.tsx`의 주석("점수·랭킹은 그 주차가 다 끝난 뒤에 공개된다(prediction_results의
  정산 게이트)")은 이 view가 유일한 점수 출처였기 때문에 자연스럽게 생긴 **구현 종속**이다 —
  view가 경기 단위로 점수를 안 주니 화면도 못 준 것이지, "경기 단위로는 절대 공개하면 안 된다"는
  별도 정책 결정이 있었던 근거는 찾지 못했다.
- 결론: 막는 것은 정책이 아니라 **하나의 view가 두 가지 역할(점수 계산 + 랭킹 노출 통제)을 동시에
  하고 있어서 생긴 구현 결합**이다. 계산과 노출 게이트를 분리하면 풀린다.

## 5. `MatchResultBlock`은 이미 주차 컨텍스트 없이 재사용 가능한 구조

`frontend/src/components/composition/predict/PredictionResult.tsx:291-381`의 `MatchResultBlock`이
정확히 요구된 두 카드("경기 예측"/"내 선수 픽", 우상단 배지, 포지션 카드 3장 + TOP3)를 그리는
컴포넌트이고, props는:

```
{ match: MatchView, state: MatchResultState, predictions: MyPredictionMap,
  candidates: PickCandidates, topRatings: FixturePositionTop3 }
```

주차 랭킹·합산 점수·`week` 객체를 전혀 받지 않는다 — 호출부(`PredictionResult` 컴포넌트, L78-93)가
`week.matches.map()`으로 경기마다 하나씩 그릴 뿐이다. 즉 **컴포넌트 재사용에는 구조적 장벽이 없다.**
막히는 건 오직 `state: MatchResultState`를 만드는 `matchResultState(match, results)`(`lib/predictions/result.ts`)의
`results: MyResultMap`이 `getMyResults()` → `prediction_results` view(게이트 걸림)에서만 온다는 점뿐이다.

---

## 6. 구현 접근 후보 (2개)

### 후보 1 — 게이트 없는 별도 view/쿼리 신설, `MatchResultBlock` 그대로 재사용

- **바뀌는 파일**: 신규 migration(`prediction_results` 정의를 복제하되 `not exists` 주차 게이트 절만
  뺀 새 view, 예: `prediction_fixture_results`) · `lib/queries/predictions.ts`(새 쿼리 함수 추가,
  기존 `getMyResults()`는 그대로 둠) · `app/predictions/[weekKey]/page.tsx`(주차 미종료 분기에서
  새 쿼리 호출) · `PredictionDone.tsx`(끝난 경기만 `MatchResultBlock` 렌더, 안 끝난 경기는 기존 카드 유지).
- **DB 변경**: 있음(신규 view 1개, `prediction_results`/leaderboard 계열은 무변경이라 랭킹 유출 위험 없음).
- **리스크**: 계산 로직(`prediction_match_points`/`prediction_pick_points` 호출부)을 두 view가
  나눠 갖게 되어, 향후 배점 산식이 또 바뀌면(과거에도 2번 바뀜, 2026-08-21→08-24→08-30) **두 곳을
  같이 고쳐야 한다**(view 정의 자체는 복붙이지 SQL 함수는 공유하므로 함수 변경 자체는 한 곳). 실제
  중복은 "함수 호출 조합 + join 구조"뿐이라 결과 화면(`PredictionResult`)의 view와 낮은 편이지만,
  0은 아니다.

### 후보 2 — `PredictionDone.tsx`에서 필요한 필드만 직접 재계산(신규 view 없이)

- **바뀌는 파일**: `lib/predictions/result.ts`(또는 새 파일)에 `prediction_match_points`/`prediction_pick_points`와
  같은 로직을 TS로 재구현 · `lib/queries/predictions.ts`(픽 스냅샷+평점+순위를 직접 조회하는 새 함수) ·
  `PredictionDone.tsx`.
- **DB 변경**: 없음.
- **리스크**: **채점 로직 이중 관리** — DB 함수가 대회별 배점(8/5 vs 5/3)과 포지션 후보 순위(`rank()
  over`)를 갖고 있는데 이걸 TS로 다시 짜면, `20260830150000_toon_cup_scoring.sql` 주석이 명시한
  설계 원칙("산식을 고치면 view 하나만 고치면 과거 경기 점수까지 따라온다")이 깨진다. 배점표가
  또 바뀌면(실제로 이미 2번 바뀌었다) 두 언어(SQL/TS)에서 각각 고쳐야 하고, 하나만 고치면 화면
  점수와 최종 정산 점수가 어긋나는 사고가 날 수 있다. **후보 1보다 리스크가 크다.**

**추천**: 후보 1. 이 추천은 사용자 목표(정확한 점수를 미리 보여주는 것)보다 리스크 회피(채점 로직
단일 소스 유지)에서 나온 판단이다 — 후보 2도 요구사항 자체는 만족시킬 수 있지만, 이 코드베이스가
이미 "산식은 DB 함수 하나"라는 원칙을 두 번의 배점 변경 이력으로 실제로 지켜왔기 때문에 어기지 않는
쪽을 골랐다.

---

## 7. 추가로 짚이는 것 (결정 아님, 사실 보고)

- `PredictionDone.tsx`(2.3, design-brief §2.3에 이미 근거 있음)에는 **잠긴 제출 경기를 "수정하기"
  대상에서 빼야 한다는 이미 확정된 별개 결정(TEA-33)이 아직 미구현** 상태로 남아 있다. 이번 작업과
  같은 파일을 건드리므로 순서를 같이 고려해야 한다.
- design-brief.md가 이미 정의해 둔 "결과 반영중"(② 킥오프됨·진행 중·결과 대기) 상태와, 이번 TEA-34가
  다루는 "③ 종료" 상태는 서로 다른 상태라 충돌하지 않는다 — 다만 ③의 표시 내용(점수 노출 여부)만
  0절에서 짚은 대로 상충한다.

---

## 8. 사용자에게 물어야 할 결정

1. **(가장 시급)** 같은 폴더의 기존 `design-brief.md`(오늘 작성, ③ 상태 "포인트 없음" 확정)를
   TEA-34 요구(점수 노출)로 **개정할지, 폐기하고 새로 쓸지, 아니면 내가 두 문서를 잘못 이해한 것인지**.
2. 후보 1(신규 view)과 후보 2(TS 재계산) 중 확정 — 위 추천(후보 1)에 동의하는지.
3. 평점이 일부만 적재된 상태(크론이 아직 다 못 채웠을 때 후보 3명 중 일부 비어 있음)를 화면에서
   어떻게 보여줄지 — 빈 자리 숨김/"평점 집계 중" 문구/다른 처리.
4. design-brief.md §2.3(TEA-33, 잠긴 제출 경기 수정 제외)와 이번 작업을 같은 커밋으로 묶을지 분리할지.
