# feature-spec — 승부예측 끝난 경기 결과 미리 보기 (TEA-34)

작성: 2026-09-05 · 작성자: developer 에이전트
입력: `feasibility.md`(같은 폴더, 조사 완료) + 오케스트레이터의 확정 결정(2026-09-05, 아래 §0 인용)

이 문서는 **②(킥오프됨·진행중)와 ③(종료) 상태의 노출**을 함께 다룬다. 애초 초안은 ③만 명시했고
②는 스코프 편입 여부가 미확정이었으나(§8 참고), **확정(2026-09-05)**: ②도 이번 스코프에 포함한다.

---

## 0. 확정된 결정 (오케스트레이터 지시 그대로 인용)

- 더블 매치위크에서 주차 종료 전에도 끝난 경기는 `MatchResultBlock`(경기 예측 카드 + 내 선수 픽
  카드, 각 "+N점" 포함)을 완료 화면(`PredictionDone.tsx`)에서 보여준다. 주차 종합 점수·랭킹은
  주차 종료까지 비공개.
- 점수 출처: `feasibility.md` 접근 후보 1 — 기존 채점 함수(`prediction_match_points`,
  `prediction_pick_points`)를 재사용하는 **주차 게이트 없는 경기 단위 뷰**를 새 마이그레이션으로
  추가. 후보 2(TS 재계산)는 기각.
- 평점 부분 적재 시: 경기 스코어·경기 예측 점수는 먼저 노출, 선수 픽 카드는 그 경기 평점이 전부
  들어올 때까지 "집계 중" 상태. 판정 기준은 §5.4.
- TEA-33(PR #30, 잠긴 제출 경기를 "수정하기" 대상에서 제외)은 별도 진행 중. 이 작업은 **PR #30이
  main에 머지된 뒤** 그 위에서 시작한다(§7 전제).

### 0.1 추가 확정 결정 (2026-09-05, §8 항목 해소 포함)

- **②(킥오프됨·진행중) 상태 포함** — 표현은 design-brief.md §8-1 후보 1(최소 변경): 기존 카드
  스코어 아래 회색 캡션 한 줄, 문구 "결과를 기다리는 중이에요". 배지 추가 없음(§8 항목 1 해소).
- **정산 화면(`PredictionResult.tsx`)의 평점 부분 적재 갭도 함께 수정** — 같은
  `ratingsSettled`/`pickPointsReady` 경로를 정산 화면 데이터에도 연결한다(§8 항목 2 해소,
  plan.md 4.5단계).
- 새 view 이름 `prediction_fixture_results` 채택(plan.md §"사용자 결정 필요" 1번).
- "평점 전부 적재" 판정 = `fixture_player_ratings` 행 수 ≥ 11(크론 `MIN_RATED_PLAYERS`와 동일값),
  매직넘버 중복 감수 — 공유 상수가 SQL/TS 경계로 불가하므로 양쪽에 같은 값+상호 참조 주석(plan.md
  §"사용자 결정 필요" 2번).
- "집계 중" 카피 = "평점 집계 중이에요", 기존 pending placeholder 박스 재사용, 그 상태의 "내 선수
  픽" 카드 헤더에는 점수 배지 없음(plan.md §"사용자 결정 필요" 3번).
- `MatchResultBlock` 재사용 = (A) 기존 파일에서 export만 추가(plan.md §"사용자 결정 필요" 4번).
- ③·④ 카드는 `MatchResultBlock` 그대로 사용, 대회 배지 소실·카드 그림자/패딩 차이는 감수(보정
  작업 없음, plan.md §"사용자 결정 필요" 7번).

---

## 1. 사용자 시나리오

1. 더블 매치위크. 사용자가 리그 경기(A)만 먼저 제출하고 나간다. 컵 경기(B)는 아직 제출 전.
2. 리그 경기(A) 킥오프 → 킥오프 지남(`locked && !finished`) — **확정(2026-09-05, §0.1)**: 이 상태도
   이번 스코프에 포함. 기존 카드는 그대로 두고 스코어 아래에 회색 캡션 한 줄 "결과를 기다리는
   중이에요"만 추가한다(배지 없음, design-brief.md §8-1 후보 1 표현).
3. 리그 경기(A)가 끝난다(`finished`). 사용자가 완료 화면에 재방문 — 이 시점부터 A 카드가
   `MatchResultBlock` 두 장(경기 예측 "+N점" / 내 선수 픽 "+N점")으로 바뀐다. 컵 경기(B)는 아직
   진행 전이라 기존 카드(스코어만, 결과 서브카드 없음) 그대로.
4. A 경기 종료 직후: 크론(`sync-fixture-ratings`, KST 08:05)이 아직 안 돌았거나 평점이 일부만
   내려온 상태. 이 경우 "경기 예측" 카드(스코어·+N점)는 그대로 보이고, "내 선수 픽" 카드만 "집계
   중" 상태로 대체된다(§5.4 판정 기준 통과 전까지).
5. 컵 경기(B)도 끝나면 같은 방식으로 B 카드도 전환된다. 두 경기 다 끝나도 **주차 종합 점수·등수는
   여기서 안 보여준다** — `week.status === 'result'`가 된 뒤 `PredictionResult.tsx`(정산 화면)의
   몫(기존 동작 그대로, 변경 없음).
6. 단일 매치위크도 같은 규칙 — 경기가 1개면 그 경기가 끝나는 순간 바로 이 상태로 전환된다.

---

## 2. 상태별 표시 규칙

`PredictionDone.tsx`의 `submittedMatches.map(...)` 루프 안에서 갈린다(카드 자체 골격은
`design-brief.md` §6 "카드 프레임" 원칙 유지 — 안쪽 콘텐츠만 바뀐다):

| 조건 | 지금 | 이번 변경 후 |
|---|---|---|
| `!match.locked && !match.finished`(①, 킥오프 전) | 스코어만(결과 서브카드 없음) | **변경 없음** |
| `match.locked && !match.finished`(②, 킥오프됨·진행 중) | 스코어만(결과 서브카드 없음) | **확정(2026-09-05, §0.1)**: 스코어 아래 회색 캡션 한 줄 "결과를 기다리는 중이에요" 추가(배지 없음) |
| `match.finished`(③·④) | "실제 결과" 서브카드 + `HitBadge`(등급만, 점수 없음) | `MatchResultBlock` 두 장(경기 예측 카드 "+N점" + 내 선수 픽 카드, §5.4 조건부 "집계 중") |

카드 안 세부 배치(간격·라벨 위치 등 순수 시각 디테일)는 `design-brief.md`가 확정되면 그걸 따른다 —
지금 이 문서는 **컴포넌트·데이터 인터페이스**만 정의한다. `MatchResultBlock`은 이미
`PredictionResult.tsx:291-381`에 구현돼 있고 주차 컨텍스트를 전혀 받지 않으므로(props:
`match, state, predictions, candidates, topRatings`) 그대로 재사용한다(`feasibility.md` §5).

---

## 3. 데이터 요구

### 3.1 신규 view — `prediction_fixture_results`

`supabase/migrations/20260830150000_toon_cup_scoring.sql`의 `prediction_results` 정의를 기반으로,
주차 게이트(같은 파일 L83-92의 `not exists ...` 절)만 제거한 새 view. 계산 함수
(`prediction_match_points`/`prediction_pick_points`)는 기존 것을 그대로 호출 — 새 함수 없음.

추가 컬럼: `rated_players_count integer` — 그 fixture의 `fixture_player_ratings` 행 수. 용도는
§5.4. 나머지 컬럼(`pred_home/away, actual_home/away, *_player_id, *_rating, *_points,
match_points, pick_points, total_points` 등)은 `prediction_results`와 동일 셋.

`security_invoker = true` 유지 — RLS는 base 테이블(`predictions`, `fixture_player_ratings`)에
이미 걸려 있고, 이 view는 그걸 우회하지 않는다(§4 참고).

### 3.2 신규 쿼리 — `getMyFixtureResults()`

`frontend/src/lib/queries/predictions.ts`의 `getMyResults()`(L305-338)와 같은 패턴 — 로그인
사용자만, `user_id` 필터, 캐시 없음(사용자별 데이터). 반환 타입은 기존 `MyResult`를 확장한
`MyResult & { ratingsSettled: boolean }`(§5.4). fixture별로 여러 건 필요할 수 있으므로 기존과
같이 `Record<fixtureId, ...>` 맵으로 반환.

### 3.3 타입 — `frontend/src/types/database.ts`

`prediction_results` Views 엔트리(L319-349)와 같은 형태로 `prediction_fixture_results` 엔트리
추가, `rated_players_count: number` 컬럼 포함. `PredictionFixtureResultRow` export(L429 패턴).

### 3.4 컴포넌트가 새로 받는 props

- `MatchResultBlock`에 옵션 prop `pickPointsReady?: boolean`(기본 `true`) 추가. `false`면
  "내 선수 픽" 카드 콘텐츠 대신 "집계 중" 상태를 그린다. **확정(2026-09-05, §0.1)**: 정산 화면
  호출부도 이 prop을 실제로 연결한다(plan.md 4.5단계) — 다만 평점이 이미 다 채워진 일반적인
  경우는 항상 `true`가 되어 화면이 지금과 동일하게 보인다.
- `PredictionDone`에 `fixtureResults: MyResultMap`(§3.2 결과)과 `topRatings: Record<string,
  FixturePositionTop3>`(기존 `getFixturePositionTop3()` 재사용, `PredictionResult.tsx`
  page.tsx 호출 패턴과 동일) 추가.
- ②(킥오프됨·진행중) 상태는 새 props가 필요 없다 — `PredictionDone`이 이미 갖고 있는
  `match.locked` 필드만으로 캡션 분기를 판별한다(plan.md 5단계).

---

## 4. 기존 제약 3종 점검

- **투표 제출 후 수정 불가** — 해당 없음(승부예측은 이미 예외, 이 작업은 조회 전용 view 추가라
  제출/수정 로직 자체를 건드리지 않는다).
- **결과는 참여 후에만 공개** — 새 view도 `predictions p join fixtures f` 조인이라 그 사용자가
  제출한 fixture만 행이 나온다(참여 안 한 경기는 애초에 `predictions` 행이 없음). 쿼리도 기존과
  동일하게 `.eq('user_id', user.id)`로 좁힌다. RLS 정책
  `predictions: read own or locked fixtures`(`20260826122000_fix_predictions_pre_kickoff_exposure.sql`)가
  이미 "본인 행 OR 마감된 경기"만 허용하므로, 새 view가 `f.finished`만 있고 마감(`started`)보다도
  좁은 조건이라 base RLS보다 엄격 — 추가 RLS 변경 불필요. **다만 이 view는 주차 종합
  점수·랭킹(`week_leaderboard`/`season_leaderboard`)과 무관하므로 랭킹 조기 유출 위험 자체가
  없다**(feasibility.md §2 마지막 문단과 같은 근거).
- **댓글은 투표 참여자만** — 해당 없음(이 기능은 댓글을 다루지 않는다).

---

## 5. 비기능

### 5.1 캐시/`revalidate`

`getMyFixtureResults()`는 `getMyResults()`와 동일하게 **캐시하지 않는다**(`unstable_cache` 미사용,
사용자별 데이터라 `RANKING_TAG` 같은 공용 태그 대상이 아님). `getFixturePositionTop3()`도 기존과
같이 캐시 없이 요청마다 조회 — 새 캐시 태그 신설 불필요. 평점 저장(`lib/actions/fixture-ratings.ts`)이
이미 비우는 `prediction-rankings` 태그는 랭킹 view 전용이라 이 작업과 무관.

### 5.2 mock 모드

`lib/mock/data.ts`의 `MOCK_FIXTURES`(L450-453)는 전부 단일 경기 주차로 보인다(각 경기 사이
7일 이상 차이) — **더블 매치위크에서 한 경기만 끝난 상태**를 재현하는 mock 데이터가 지금 없다.
새 mock 시나리오(같은 주차에 종료+제출된 경기 1개, 미종료 경기 1개)를 추가해야 이 기능을 mock
모드에서 확인할 수 있다(§7 6단계).

---

## 6. 엣지케이스

- 평점 0건(`rated_players_count = 0`, 크론 실행 전) → "집계 중"(§5.4 기준 미달).
- 평점 일부(1~10건) → 여전히 "집계 중" — `coalesce(rating, 0)`로 인해 미집계 포지션이 0점으로
  섞여 `pick_points`가 실제보다 낮게 나올 수 있어, 부분값을 최종값처럼 보여주면 안 된다(이게 이
  기능의 핵심 위험이자 §5.4를 만든 이유).
- 평점 11건 이상이지만 내가 고른 선수가 그 안에 없음(미출전) → 기존 동작 그대로(`rating: null` →
  `RatingBadge` 비표시, 점수 0) — 이건 "집계 중"이 아니라 정상적인 "미출전 0점"이라 구분해야 한다.
- 취소된 경기(`cancelled`) → `f.finished`가 애초에 true가 안 되므로 새 view에 안 잡힘(기존
  `prediction_results`와 동일 전제).

---

## 7. 스코프 밖 (건드리지 않음)

- ~~`design-brief.md`의 ②(킥오프됨·진행중) 상태 신설~~ — **확정(2026-09-05, §0.1, §8 항목 1
  해소)**: 이번 스코프에 포함됨. 더 이상 스코프 밖이 아니다.
- `PredictionResult.tsx`(이미 정산된 주차 결과 화면)의 표시 로직 재설계(레이아웃·카피 변경)는
  여전히 스코프 밖. 다만 **확정(2026-09-05, §0.1, §8 항목 2 해소)**: 그 화면의 평점 부분 적재
  갭(`pickPointsReady` 미연결)만은 이번에 함께 고친다 — plan.md 4.5단계.
- `MatchWeekList.tsx`(목록 화면)의 미사용 `myResult.totalPoints` 배선 — `design-brief.md` §2.4가
  이미 스코프 밖으로 명시.
- TEA-33 구현(PR #30) 자체 — 전제 조건일 뿐 이 작업이 다시 만들지 않는다.

---

## 8. 스코프 판단 — 사람 확인 필요 (plan.md §"사용자 결정 필요"에도 동일 항목 있음)

1. 이번 지시(오케스트레이터 §0)는 ③만 명시했다. `design-brief.md`는 ①~④ 전체를 한 프로젝트로
   다루고 있고 ②는 아직 §10에서 카피·레이아웃이 미승인 상태다. 이 문서는 ③만 계획했는데, 맞는
   스코프인지 확인 필요 — ②도 같이 이번 구현에 넣을지, 브리프 승인 후 별도 이슈로 갈지.
   **확정(2026-09-05)**: ②도 이번 구현 범위에 포함. 표현은 design-brief.md §8-1 후보 1(최소
   변경): 기존 카드 스코어 아래 회색 캡션 한 줄, 문구 "결과를 기다리는 중이에요", 배지 추가 없음
   (§0.1, §1, §2, plan.md 5·7·8단계 반영).
2. `PredictionResult.tsx`(정산 화면)에도 같은 "평점 부분 적재" 문제가 이론상 있다(정산 게이트는
   `f.finished`만 보고 평점 완료 여부는 안 본다 — 주차 마지막 경기가 끝난 당일, 크론이 돌기 전에
   `week.status`가 바로 `'result'`가 되면 그 화면도 부분 점수를 최종처럼 보여줄 수 있다). 이건
   기존에도 있던 갭이라 이번 작업이 만든 문제는 아니지만, §3.4의 `pickPointsReady` prop을 그
   화면에도 연결할지는 스코프 확장 여부라 별도 확인 필요(근거: 실제 코드 경로 확인, 재현 사례는
   아직 없음 — "발생 가능성"만 확인됨).
   **확정(2026-09-05)**: 이번에 함께 고친다. 같은 `ratingsSettled`/`pickPointsReady` 경로를 정산
   화면 데이터에도 연결한다(§0.1, §7, plan.md 신설 4.5단계 및 8단계 테스트 항목).
