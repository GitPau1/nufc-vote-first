# plan — 승부예측 끝난 경기 결과 미리 보기 (TEA-34)

승인: 2026-09-05 사용자 승인

작성: 2026-09-05 · 작성자: developer 에이전트
입력: 같은 폴더 `feature-spec.md`. **위 승인 완료 — 구현 진행 가능.**

전제: PR #30(TEA-33, `fix(TEA-33): 승부예측 수정 대상에서 킥오프된 경기 제외`)이 아직 미머지
상태(2026-09-05 확인, `gh pr view 30` → OPEN)이고, 이 PR이 `frontend/src/app/predictions/[weekKey]/page.tsx`와
`frontend/src/components/composition/predict/PredictionDone.tsx`를 이미 건드린다. **이 plan의
단계는 PR #30이 main에 머지된 뒤, 그 위에서 시작한다.** 아래 file:line은 지금(PR #30 머지 전)
main 기준이라 머지 후 몇 줄 밀릴 수 있다 — 각 단계 시작 시 grep으로 앵커(주석·변수명)를 다시
확인하고 진행할 것.

각 단계는 서로 다른 에이전트가 이어받을 수 있게 독립적으로 썼다. 단계 순서는 위→아래가 의존
순서(DB → 타입 → 쿼리 → 컴포넌트 → 배선 → 테스트/문서).

---

## 0단계 — 전제 확인 (구현 없음)

- `gh pr view 30 --json state,mergedAt`으로 PR #30 머지 확인.
- 머지 확인 후 `origin/main` 최신 상태에서 브랜치
  `geonhaa/tea-34-더블-매치위크에서-끝난-경기의-내-예측-판정을-예측` 생성:
  `git checkout main && git pull origin main && git checkout -b geonhaa/tea-34-더블-매치위크에서-끝난-경기의-내-예측-판정을-예측`.
  이후 모든 단계는 이 브랜치 위에서 진행한다.
- `git pull` / rebase 후 `npm test`로 TEA-33 관련 테스트(`PredictionDone.test.mjs`,
  `prediction-flow-page.test.mjs`)가 통과하는지 먼저 확인(이 plan의 베이스라인).

---

## 1단계 — 마이그레이션: `prediction_fixture_results` view 신설

**파일**: `supabase/migrations/<타임스탬프>_prediction_fixture_results.sql`(신규)

- `supabase/migrations/20260830150000_toon_cup_scoring.sql`의 `prediction_results` view 정의
  (L36-92)를 베이스로 복제:
  - SELECT 절·CTE(`current_season`, `ranked`)·JOIN 구조 전부 동일.
  - **WHERE 절에서 주차 게이트(L84-91의 `not exists (...)` 블록)만 제거**, `where f.finished`만
    남긴다.
  - 새 컬럼 `rated_players_count`를 SELECT에 추가: `(select count(*) from
    public.fixture_player_ratings fpr2 where fpr2.fixture_id = p.fixture_id) as
    rated_players_count`.
  - 확정(2026-09-05, §"사용자 결정 필요" 2번): 이 컬럼에 `comment on column`으로 "완료 판정
    임계값 11은 `supabase/functions/sync-fixture-ratings/index.ts`의 `MIN_RATED_PLAYERS`,
    `frontend/src/lib/queries/predictions.ts`의 `RATED_PLAYERS_SETTLED_THRESHOLD`와 같은 값이어야
    함"을 남긴다 — SQL/TS 경계 때문에 상수 자체를 공유할 수는 없으므로, 세 곳 모두 서로를
    가리키는 주석으로 매직넘버 중복을 감수한다.
  - `with (security_invoker = true)` 유지.
  - `comment on view` — "정산 게이트 없는 경기 단위 예측 결과. 종료된 경기면 주차 진행 상태와
    무관하게 나온다. 랭킹 view(`week_leaderboard`/`season_leaderboard`)는 이 view를 참조하지
    않는다."
- **건드리지 않는 것**: `prediction_match_points`/`prediction_pick_points` 함수(재사용만),
  `week_leaderboard`/`season_leaderboard` view(무변경 — 랭킹 유출 위험 없음, feature-spec §4).
  `prediction_results` view는 이 단계에서는 무변경이 원칙이나, 4.5단계(정산 화면 갭 수정)가
  옵션 (a)를 택하면 그 view에 `rated_players_count` 컬럼을 추가하게 된다 — 그 경우에도
  `week_leaderboard`/`season_leaderboard`는 여전히 무변경(컬럼 추가만이라 두 view가 참조하는
  컬럼셋에 영향 없음). 이 단계 담당 에이전트는 4.5단계 담당자와 택일 결과를 맞춰볼 것.
- 검증: `supabase db push`는 사람이 실행(이 리포는 sandbox에 DB 접속 불가, `prod-db-query-no-docker`
  전례). 이 단계 담당 에이전트는 SQL만 작성하고 실제 적용은 사람에게 요청.

---

## 2단계 — 타입: `frontend/src/types/database.ts`

- `prediction_results` Views 엔트리(L319-349)를 참고해 `prediction_fixture_results` 엔트리
  추가(Views 객체 안, L349 다음). Row 필드는 동일 + `rated_players_count: number`.
- `export type PredictionFixtureResultRow = Database['public']['Views']['prediction_fixture_results']['Row']`
  추가(L429-430 근처, 기존 export 옆).
- 이 단계는 1단계(마이그레이션 SQL)만 있으면 되고, DB 반영 여부와 무관하게 작성 가능(수동
  타입이므로).

---

## 3단계 — 쿼리: `frontend/src/lib/queries/predictions.ts`

- `MyResult` 타입(L265-273)에 `ratingsSettled: boolean` 필드 추가.
- 확정(2026-09-05, §"사용자 결정 필요" 2번): 평점 완료 판정 임계값을 상수로 뺀다:
  `const RATED_PLAYERS_SETTLED_THRESHOLD = 11` — 주석으로
  `supabase/functions/sync-fixture-ratings/index.ts`의 `MIN_RATED_PLAYERS = 11` 및 1단계에서
  `rated_players_count` 컬럼에 남기는 `comment on column`과 반드시 같이 맞춰야 한다는 점을
  명시(매직넘버 세 곳 중복을 감수, feature-spec §5.4 근거와 동일 출처). 이 값이 왜 "완료" 기준인지:
  크론이 이 값 미만이면 그 fixture를 재시도 대상으로 계속 집는다(같은 파일 L32-34 주석) — 즉
  시스템이 이미 쓰고 있는 "그만 기다려도 되는" 기준을 그대로 재사용.
- 새 함수 `getMyFixtureResults(): Promise<MyResultMap>` 추가 — `getMyResults()`(L305-338)와
  거의 동일한 구조(로그인 확인 → `.eq('user_id', ...)` → 맵 변환), 다만:
  - `.from('prediction_results')` 대신 `.from('prediction_fixture_results')`
  - `RESULT_COLUMNS`에 `rated_players_count` 추가(또는 별도 상수 `FIXTURE_RESULT_COLUMNS`)
  - 맵 변환 시 `ratingsSettled: row.rated_players_count >= RATED_PLAYERS_SETTLED_THRESHOLD` 계산.
  - mock 모드(`IS_MOCK`): §6에서 만들 `MOCK_FIXTURE_RESULTS`(또는 확장된 `MOCK_RESULTS`)를 반환.
- 기존 `getMyResults()`/`MyResult`/`MyResultMap`은 **그대로 둔다**(정산 화면 동작 불변,
  feature-spec §7).

---

## 4단계 — 컴포넌트: `MatchResultBlock` 재사용 가능하게 export + 조건부 "집계 중"

**파일**: `frontend/src/components/composition/predict/PredictionResult.tsx`

- `function MatchResultBlock(...)`(L291)을 `export function MatchResultBlock(...)`으로 변경.
  확정(2026-09-05, §"사용자 결정 필요" 4번): (A) 이 파일 안에서 export만 추가 — 별도 파일로
  추출하지 않는다.
- props에 `pickPointsReady?: boolean`(기본값 `true`) 추가.
- "내 선수 픽" `Card`(L353-378) 렌더를 분기: `pickPointsReady`가 `false`면 지금의 픽 리스트/카드
  대신 "집계 중" 상태 블록 하나만 그린다. 확정(2026-09-05, §"사용자 결정 필요" 3번): 카피는
  "평점 집계 중이에요", 레이아웃은 이 컴포넌트에 이미 있는 pending placeholder 박스(픽 미참여
  상태 렌더에 쓰는 것)를 그대로 재사용 — 새 박스를 만들지 않는다. 이 상태의 "내 선수 픽" 카드
  헤더에는 점수 배지를 달지 않는다(`PickPointsBadge(null)`이 "미참여"를 뜻하는 것과 혼동되므로
  배지 자체를 숨긴다).
- 기존 호출부(`PredictionResult` 컴포넌트, L85-91)는 `pickPointsReady`를 안 넘기므로 이 단계
  자체로는 동작 불변 — 실제 연결은 4.5단계에서 한다.
- 확정(2026-09-05, design-brief.md §8-3 근거, plan §"사용자 결정 필요"에 7번으로 추가):
  `MatchResultBlock`을 ③·④에 그대로 재사용하면서 생기는 대회 배지 소실·카드 그림자/패딩 차이는
  감수한다 — 이 단계에서 보정 작업(래퍼 추가 등)을 하지 않는다.

---

## 4.5단계 — 정산 화면(`PredictionResult.tsx`)의 평점 부분 적재 갭 수정

확정(2026-09-05, §"사용자 결정 필요" 6번): 정산 게이트가 `f.finished`만 보고 평점 완료 여부는
보지 않는 기존 갭을, 4단계에서 만든 `ratingsSettled`/`pickPointsReady` 경로를 그대로 이어 붙여
이번에 함께 고친다.

**파일**: `frontend/src/app/predictions/[weekKey]/page.tsx`(`getMyResults()` 호출부),
`frontend/src/components/composition/predict/PredictionResult.tsx`

- `getMyResults()`가 쓰는 `prediction_results` view(주차 게이트 있는 기존 view, 1단계에서 만드는
  `prediction_fixture_results`와 다른 view)에도 `rated_players_count`(또는 동등한 값)가 필요하다.
  구현 방법은 둘 중 택일(이 문서가 발명하지 않음, 구현 시 판단):
  (a) 1단계 마이그레이션에서 `prediction_results` view에도 같은 컬럼을 추가(컬럼 추가만이라
      기존 SELECT 결과·`week_leaderboard`/`season_leaderboard`가 참조하는 컬럼셋에는 영향 없음,
      feature-spec §4의 "랭킹 view는 안 건드린다" 원칙과 충돌하지 않는지는 구현 시 재확인),
  (b) `getMyResults()`가 `fixture_player_ratings` count를 별도 쿼리로 가져와 합친다.
- `MyResult` 타입(3단계에서 `ratingsSettled` 필드를 추가한 그 타입)의 `ratingsSettled` 값을
  `getMyResults()` 반환에도 채운다.
- `PredictionResult.tsx` 호출부(`PredictionResult` 컴포넌트, L85-91)에서 `MatchResultBlock`에
  `pickPointsReady={myResults[match.id]?.ratingsSettled ?? false}`를 넘기도록 변경 — 4단계에서
  만든 prop을 이 화면에 처음으로 연결하는 단계.
- 실사용 영향: 평점이 이미 다 채워진 일반적인 경우(현재 거의 모든 케이스)는 `ratingsSettled`가
  항상 `true`라 화면이 지금과 동일하게 보인다. 차이가 드러나는 건 "주차 마지막 경기가 끝난 당일,
  크론이 아직 안 돈" 좁은 시간대뿐(feature-spec §8 항목 2 근거, 재현 사례 확인된 바는 없음).
- 완료 기준: `PredictionResult.tsx`에서 `pickPointsReady`가 실제로 배선되고, 위 (a)/(b) 중 택한
  방식으로 `rated_players_count`(또는 동등한 값)가 `getMyResults()`까지 도달함. 8단계 테스트
  항목 참고.

---

## 5단계 — 컴포넌트: `PredictionDone.tsx`에 종료 경기 카드 교체

**파일**: `frontend/src/components/composition/predict/PredictionDone.tsx`

전제(0단계): PR #30 머지로 `editableMatches` 변수가 이미 있음. 아래는 그 위에 얹는다.

- import 추가: `MatchResultBlock`(`./PredictionResult`), `matchResultState`(`@/lib/predictions/result`,
  이미 `matchHit`은 import돼 있음 — 같이 정리), `FixturePositionTop3`(`@/lib/queries/fixtures`),
  `MyResultMap`(`@/lib/queries/predictions`).
- 컴포넌트 props에 `fixtureResults: MyResultMap`, `topRatings: Record<string,
  FixturePositionTop3>` 추가.
- `submittedMatches.map(...)` 블록(L164-223, PR #30 머지 후 라인 밀림 주의) 안에서 분기:
  - `match.finished`면 기존 "실제 결과 서브카드 + HitBadge" 대신
    `<MatchResultBlock match={match} state={matchResultState(match, fixtureResults)}
    predictions={/* 이 화면이 이미 갖고 있는 prediction */} candidates={candidates}
    topRatings={topRatings[match.id]} pickPointsReady={fixtureResults[match.id]?.ratingsSettled
    ?? false} />`를 렌더.
    - `predictions` prop은 `MatchResultBlock`이 기대하는 `MyPredictionMap` 형태 — `PredictionDone`은
      지금 `WeekPrediction`(주 단위 스냅샷, `prediction` 인자)만 갖고 있어 타입이 다르다. 이
      화면 전용으로 `{ [match.id]: { score: prediction.scores[match.id]!, picks: prediction.picks[match.id] } }`
      형태의 단일 항목 맵을 그 자리에서 만들어 넘긴다(새 헬퍼 함수 불필요, 인라인으로 충분 — 매
      loop iteration마다 그 경기 하나만 필요하므로).
  - `!match.finished`면(①·② 공통) 기존 마크업(스코어만) 그대로 두되, 확정(2026-09-05,
    §"사용자 결정 필요" 5번 — ②도 이번 스코프에 포함): `match.locked`가 `true`이면(②, 킥오프됨·
    진행 중) 그 카드 스코어 아래에 회색 캡션 한 줄 "결과를 기다리는 중이에요"만 추가한다
    (design-brief.md §8-1 후보 1 표현 — 배지 추가 없음). `match.locked`가 `false`이면(①, 킥오프
    전) 지금 그대로 변경 없음.
  - 기존 `HitBadge`/`HIT_LABEL`/`PickResultList`/`PickCard`/`resolvePicks`가 이 분기 이후로도
    쓰이는지 확인 — `resolvePicks`는 여전히 필요 없어질 수 있음(종료 경기는 `MatchResultBlock`이
    picks를 자체적으로 그림). **더 이상 안 쓰이는 헬퍼는 같은 커밋에서 지운다**(1번 체크리스트,
    문서 drift 방지와 같은 원칙).

---

## 6단계 — 배선: `page.tsx` → `PredictionFlowClient` → `PredictionDone`

**파일**: `frontend/src/app/predictions/[weekKey]/page.tsx`

- `getMyFixtureResults`를 import(`@/lib/queries/predictions`에서, `getMyResults` 옆).
- `else if (prediction)` 분기(현재 L118-126, PR #30 영향 없는 블록으로 보이나 재확인 필요)에서:
  - `submittedMatches` 중 `match.finished`인 것만 골라 `getFixturePositionTop3` 호출(결과
    화면의 `top3PerMatch` 패턴, L33-40과 동일하게 `Promise.all` + fixture id 키 맵으로 변환).
  - `getMyFixtureResults()` 호출 결과를 `fixtureResults`로 `PredictionFlowClient`에 전달.
- **파일**: `frontend/src/components/composition/predict/PredictionFlowClient.tsx`
  - props에 `fixtureResults?: MyResultMap`, `topRatings?: Record<string, FixturePositionTop3>`
    추가(L88-106 프롭 목록).
  - `submitted` 분기(L353-354)에서 `<PredictionDone week={week} prediction={submitted}
    candidates={candidates} fixtureResults={fixtureResults ?? {}} topRatings={topRatings ?? {}} />`로
    확장.

---

## 7단계 — mock 모드

**파일**: `frontend/src/lib/mock/data.ts`, `frontend/src/lib/mock/queries.ts`

- `MOCK_FIXTURES`(L450-453)에 더블 매치위크 시나리오 추가 — 같은 주에 경기 2개, 하나는
  `finished: true`(+ 제출 쿠키/스냅샷 존재), 하나는 아직 `finished: false`(킥오프 전 또는
  진행 중). 기존 `mockFixture(...)` 헬퍼 재사용, 새 fixture id는 기존 9001/9002/9003과 겹치지
  않게 채번(예: 9004/9005 — 정확한 번호·상대팀명은 구현 시 판단, 이 문서가 발명하지 않음).
- `MOCK_RESULTS`(L531-554)와 같은 모양으로 이 새 fixture의 결과를 추가하되, **`ratingsSettled`가
  `false`인 케이스를 최소 1개 포함**해야 "집계 중" 분기를 mock에서 확인할 수 있다.
- `getMyFixtureResults()`의 mock 분기가 참조할 mock 데이터 상수(§3에서 이름 확정 —
  `MOCK_FIXTURE_RESULTS` 또는 `MOCK_RESULTS` 확장) 추가.
- 확정(2026-09-05, §"사용자 결정 필요" 5번 — ②도 스코프 포함): 두 fixture 중 `finished: false`인
  쪽은 `locked: true`(킥오프 지남, 진행 중)로 만들어 ② 캡션("결과를 기다리는 중이에요")을 mock
  모드에서 확인할 수 있게 한다.
- 확정(2026-09-05, §"사용자 결정 필요" 6번): 4.5단계(정산 화면 갭 수정) 확인용 mock 시나리오는
  `week.status === 'result'`가 된 주차의 `MOCK_RESULTS` 항목 중 `ratingsSettled: false` 케이스가
  필요한지, 정산 화면 mock 데이터 구조를 확인한 뒤 구현 시 판단(이 문서가 발명하지 않음).

---

## 8단계 — 테스트

- `frontend/src/components/composition/predict/PredictionDone.test.mjs`(정규식 기반, 소스
  문자열 검사): 새로 추가한 분기(`match.finished` → `MatchResultBlock` 렌더, prop 전달)를
  검증하는 단정문 추가. PR #30이 추가한 기존 단정문(`editableMatches` 등)과 충돌 없는지 확인.
- `frontend/src/components/composition/predict/PredictionResult.test.mjs`(있다면 — 존재 확인
  필요, `export function MatchResultBlock`/`pickPointsReady` 기본값이 기존 정산 화면 렌더를
  안 바꾼다는 단정문 추가).
- `frontend/src/app/predictions/prediction-flow-page.test.mjs`: `fixtureResults`/`topRatings`
  전달 라인 검증.
- 확정(2026-09-05, §"사용자 결정 필요" 5번): `PredictionDone.test.mjs`에 `match.locked &&
  !match.finished`(②)일 때 "결과를 기다리는 중이에요" 캡션이 렌더 분기에 들어가는지(정규식 검사)
  단정문 추가.
- 확정(2026-09-05, §"사용자 결정 필요" 6번): `PredictionResult.test.mjs`(있다면)에 4.5단계에서
  연결한 `pickPointsReady={myResults[...]?.ratingsSettled ?? false}` 배선이 실제로 소스에
  있는지 단정문 추가.
- 로직 테스트(정규식 아님) 대상 확인: `lib/predictions/result.ts`에 새 로직을 추가하지 않았다면
  `result.test.mjs`는 변경 불필요 — `matchResultState`/`MyResultMap` 시그니처가 그대로라서.
  `ratingsSettled` 판정(임계값 비교)은 순수 로직이 아니라 쿼리 파일 안의 매핑 한 줄이라 별도
  단위 테스트 파일보다는 `npm test`의 정규식 검사로 충분한지 구현 시 재판단.

---

## 9단계 — 검증 명령 (구현 완료 후 1회, CLAUDE.md 규칙)

```bash
cd frontend
npm test            # 전체 *.test.mjs
npm run lint
npm run build
```

빌드 전 타입 오류만 빠르게 보고 싶으면 `npx tsc --noEmit`(개발자 규칙 6번). 실 Supabase
연동 확인(마이그레이션 반영 후)은 mock이 아닌 모드에서 완료 화면 smoke test — AGENT_MAINTENANCE_GUIDE.md
체크리스트 8번.

---

## 10단계 — 문서 갱신

- `vault/99_old/AGENT_MAINTENANCE_GUIDE.md`의 "승부예측" 섹션(L83-103) — 새 view/쿼리 추가,
  기존 L100 "결과 화면 진입 전... 점수는 정산 게이트를 지나야 나온다" 문장이 **이 작업 이후로는
  틀린 서술**이 되므로(끝난 경기는 이제 정산 전에도 경기 단위 점수가 나온다) 반드시 같이 고친다.
- `vault/99_old/SUPABASE_DATA_CONNECTIONS.md` — 새 view(`prediction_fixture_results`)를 데이터
  흐름표에 추가.
- `feature-spec.md`/`plan.md`는 구현 완료 후 별도로 "완료" 기록을 남기지 않는다(이 리포 관례상
  Linear 이슈 코멘트가 그 역할 — `linear-ops` 위임 대상, 개발자 에이전트가 직접 쓰지 않음).

---

## 사용자 결정 필요

1. **새 view 이름** — `prediction_fixture_results` 제안. 근거: 기존 명명 관례가 집계 단위를
   접두어로 쓴다(`prediction_results`=경기+게이트, `week_leaderboard`/`season_leaderboard`=랭킹
   단위). 이 추천은 리스크 회피(관례 일관성)에서 나왔다 — 다른 이름을 원하면 지정.
   **확정(2026-09-05)**: `prediction_fixture_results` 채택.
2. **"평점 전부 적재" 판정 기준** — `fixture_player_ratings` 행 수 ≥ 11(`sync-fixture-ratings`의
   `MIN_RATED_PLAYERS`와 동일값 재사용, 근거: `supabase/functions/sync-fixture-ratings/index.ts:34`).
   이 값을 UI 게이트로도 쓰는 것에 동의하는지, 매직넘버가 두 곳(엣지 함수·새 view)에 중복되는
   부담을 감수할지. 대안: view에 상수를 두지 않고 그때그때 다른 임계값을 쓸 근거가 있다면 제시.
   **확정(2026-09-05)**: `fixture_player_ratings` 행 수 ≥ 11(크론 `MIN_RATED_PLAYERS`와 동일값)
   채택, 매직넘버 중복 감수. 가능하면 상수 하나를 공유하되, SQL/TS 경계 때문에 공유가 불가하므로
   양쪽(및 1단계 view 컬럼 주석)에 같은 값을 두고 서로를 가리키는 주석을 남긴다(1·3단계 반영).
3. **"집계 중" 카피** — 아직 확정 문구 없음(design-brief.md의 ② 카피 미확정과 같은 성격의
   항목). plan 4단계는 자리표시 문구로 구현하고 실제 카피는 디자이너/사람 승인을 기다린다.
   **확정(2026-09-05)**: 카피 "평점 집계 중이에요". `MatchResultBlock`의 기존 pending placeholder
   박스를 재사용하고, 그 상태에서 "내 선수 픽" 카드 헤더에는 점수 배지를 달지 않는다
   (`PickPointsBadge(null)`="미참여"와 혼동 방지, 4단계 반영).
4. **`MatchResultBlock` 재사용 방식** — (A) `PredictionResult.tsx`에서 export만 추가해 그대로
   import(이번 plan의 기본안, 최소 diff) vs (B) 별도 파일(`MatchResultBlock.tsx`)로 추출해 두
   화면이 같은 파일을 import(구조는 더 깨끗하나 리팩터 범위가 커짐, 기존 파일의 다른
   private 헬퍼도 같이 옮길지 판단 필요). **추천 A** — 이유는 리스크 회피(이번 스코프는 재사용이지
   구조 개편이 아님). B를 원하면 별도 승인 후 진행.
   **확정(2026-09-05)**: (A) 채택 — 기존 파일에서 export만 추가(4단계 반영).
5. **② 상태(킥오프됨·진행중) 포함 여부** — 이번 지시는 ③만 명시했다. `design-brief.md`는 ②까지
   포함한 전체 프로젝트다. 이 plan은 ③만 다뤘는데, ②도 같이 이번 구현 범위에 넣을지 확인
   필요(브리프 §10 항목 1~3이 아직 미승인이라, 넣더라도 카피·레이아웃 확정 전에는 실제 구현이
   막혀 있다는 점 감안).
   **확정(2026-09-05)**: ② 포함. 표현은 design-brief.md §8-1 후보 1(최소 변경): 기존 카드 스코어
   아래 회색 캡션 한 줄, 문구 "결과를 기다리는 중이에요". 배지 추가 없음(5단계·7단계·8단계 반영).
6. **정산 화면(`PredictionResult.tsx`)의 "평점 부분 적재" 갭도 같이 고칠지** — 정산 게이트는
   `f.finished`만 보고 평점 완료를 안 보므로, 주차 마지막 경기가 끝난 당일(크론 실행 전)에는
   정산 화면도 이론상 부분 점수를 최종처럼 보여줄 수 있다(근거: `20260824120000_prediction_results_week_settled.sql`
   WHERE 절에 평점 완료 조건이 없음 — 재현 사례가 실제 있었는지는 확인 못함, "발생 가능성"만
   확인). 이번 작업 스코프 밖으로 두고 별도 이슈로 남길지, 4단계의 `pickPointsReady` prop을
   정산 화면 호출부에도 연결해 같이 고칠지.
   **확정(2026-09-05)**: 이번에 함께 고친다. 같은 `ratingsSettled`/`pickPointsReady` 경로를 정산
   화면 데이터에도 연결(신설 4.5단계, 테스트 항목은 8단계에 반영).
7. **`MatchResultBlock`을 ③·④에 재사용할 때의 시각적 부작용** — design-brief.md §8-3이 짚은 대회
   배지 소실·카드 그림자/패딩 차이를 감수할지, 개발자가 보정(래퍼 추가 등)할지. (plan 원본에는
   없던 항목이나 4단계 구현과 직결돼 함께 확정)
   **확정(2026-09-05)**: `MatchResultBlock` 그대로 사용, 대회 배지 소실·카드 그림자/패딩 차이는
   감수한다(보정 작업 없음, 4단계 반영).

---

## 구현 완료 기록 (2026-09-05, 2차 담당 — 7~10단계 + PR)

0~6단계는 이전 담당이 커밋(마지막 `50e1f92`)했고, 이번 작업은 그 위에 7~10단계를 이어 붙였다.

- **7단계(mock)**: `MOCK_FIXTURES`에 9009(종료, 결과 있음)/9010(잠김, 미종료) 추가 — 같은 주(프리
  시즌 앵커 08/09주, weekKey `2627-0-3`)에 끝난 경기와 아직 안 끝난 경기가 섞인 더블 매치위크.
  `MOCK_RESULTS`에 9009 결과, `MOCK_FIXTURE_RATINGS`에 9009 TOP3 후보 추가. 신설
  `MOCK_RATINGS_PENDING_FIXTURE_IDS`(현재 `['9003']`)로 `getMyResults()`/`getMyFixtureResults()`의
  mock 매핑이 목록에 있는 fixture만 `ratingsSettled: false`를 내려주도록
  `lib/queries/predictions.ts`도 함께 고쳤다(plan이 지목한 `lib/mock/queries.ts`가 아니라 실제로는
  이 파일이 mock 매핑을 갖고 있었음 — 6단계까지 진행되며 구조가 이동함). 기존 9001/9002/9003
  기반 시나리오와 그 주차 상태는 건드리지 않았다(전부 새 fixture id로 격리).
- **8단계(테스트)**: `PredictionDone.test.mjs`에 종료 경기 → `MatchResultBlock` 렌더 + `pickPointsReady`
  배선, `match.locked && !match.finished` → "결과를 기다리는 중이에요" 캡션 단정문 추가.
  `prediction-flow-page.test.mjs`에 완료 허브의 `getMyFixtureResults()` 조회 +
  `fixtureResults`/`topRatings` 배선 단정문 추가. `PredictionResult.test.mjs`는 여전히 존재하지
  않아(확인함) 그 항목은 스킵. `RATED_PLAYERS_SETTLED_THRESHOLD`는 정규식 검사 대상이 아니라
  export하지 않았다.
- **9단계(검증)**: `npx tsc --noEmit`(에러 없음), `npm test`(281개 전부 통과), `npm run lint`(에러
  없음, 기존에도 있던 `<img>`/훅 경고만 무관 파일에 잔존), `npm run build`(성공). mock 서버(포트
  3417)를 띄워 curl + 수동 `mock-prediction-*` 쿠키로 스모크 테스트: `2627-0-3`(더블 매치위크)에서
  종료 경기(Fulham) MatchResultBlock("+3점" 배지) 렌더, "결과를 기다리는 중이에요" 캡션 렌더 확인.
  `2627-2`(9003 단일 주차, 정산 게이트 있는 기존 결과 화면)에서 "평점 집계 중이에요" 렌더 확인.
  서버는 스모크 테스트 후 PID로 종료.
- **10단계(문서)**: `vault/99_old/AGENT_MAINTENANCE_GUIDE.md`·`SUPABASE_DATA_CONNECTIONS.md`의
  "점수는 정산 게이트를 지나야 나온다" 서술을 새 동작(정산 전에도 경기 단위 결과 표시, 평점
  미집계 시 픽 카드만 대체)으로 고치고 `prediction_fixture_results` view·`rated_players_count`
  임계값(11) 상호 참조를 추가했다. `intent.md`가 없어 이 절만 plan.md 끝에 남긴다(원래 plan
  10단계는 "완료 기록 없음, Linear 코멘트가 역할" 관례를 전제했으나, 이번 위임 지시가 이 절
  추가를 명시해 그대로 따랐다 — 관례와 다른 점이라 여기 남겨둔다).
- **부수 발견**: 이 프로젝트 폴더(`design-brief.md`/`feasibility.md`/`feature-spec.md`/
  `mockup.html`/`plan.md`)가 이번 브랜치에 오기 전까지 git에 커밋된 적이 없었다(0~6단계 커밋
  이력에 없음) — 10단계 커밋에 함께 추가해 처음으로 git 이력에 들어간다.
- PR: 본문에 링크·검증 결과 기재(제목 "feat(TEA-34): 더블 매치위크에서 끝난 경기의 내 예측 결과를
  주차 종료 전에 표시"). 배포 전 `supabase db push`로 마이그레이션 2건 적용 필요.
