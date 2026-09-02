# feature-spec — 이슈 2: 포지션별 평점 TOP3 데이터 확보 (TEA-15, 조사 전용)

작성: 2026-09-02 · 작성자: developer 에이전트 (읽기 전용 조사, 코드/DB 미수정)
입력: `plan.md`(같은 폴더) "3. 이슈 2" 착수 조건, `시안-v9.html`의 "포지션 평점 TOP3" 아코디언, `PredictionResult.tsx`(현재 브랜치 HEAD 기준)

---

## 0. 핵심 질문에 대한 답 — 가능, 스키마 신설 불필요

**한 경기(fixture)에 대해 "픽 후보 전체 선수"의 평점을 조회할 방법이 이미 있다.** 새 테이블/뷰가 필요 없고, 기존 `fixture_player_ratings` 테이블이 이미 전체 후보 평점을 담고 있는데 현재 코드(`getMatchRatings`)가 그중 포지션별 1위만 골라 쓰고 있을 뿐이다.

근거:

- `supabase/migrations/20260821120000_create_predictions.sql:47-56` — `fixture_player_ratings` 테이블 정의. PK `(fixture_id, player_id)`, 코멘트: "경기별 선수 평점 … 이 행이 없으면 그 선수 픽은 0점으로 계산된다(= 미출전/미집계)". 즉 이 테이블은 **그 경기에 평점이 매겨진 선수 전원**(뉴캐슬 스쿼드 전체, 상위 1명이 아님)을 담는다.
- `frontend/src/lib/queries/fixtures.ts:128-197`의 `getMatchRatings()`가 이미 이 테이블을 `.order('rating', { ascending: false })`로 **전체 조회**한 뒤(L132-136), `season_squads`와 조인해 포지션을 붙이고(L155-165), `topOf()`(L190)가 `rated.find()`로 포지션별 **1위만** 골라낸다(L190-196). 즉 "전체 후보 평점 조회"는 이미 하고 있고, "1위만 노출"은 `MatchdayHero`(홈 화면) 요구사항 때문에 그 함수 안에서 잘라낸 것 — **테이블/쿼리의 한계가 아니라 이 함수의 용도(1위 강조 카드) 때문에 생긴 절단**이다.
- `frontend/src/storybook/contents/MatchdayHero.mdx:43`이 같은 사실을 문서로도 확인해준다: "`fixture_player_ratings`에 평점이 있으면 … `season_squads.position`을 조인해 포지션별 1위를 뽑는다."

## 1. RLS/노출 범위 — 공개, 비로그인도 조회 가능

- `supabase/migrations/20260821120000_create_predictions.sql:91-94` — `create policy "fixture_player_ratings: public read" ... to anon, authenticated using (true)`.
- `supabase/migrations/20260825130908_remote_schema.sql:15,23,31` — `anon`/`authenticated`/`service_role` 모두에 `grant select`.
- `getMatchRatings()`가 `createPublicClient()`(anon key)로 이미 이 테이블을 읽고 있고 실제로 로그인 없는 홈 화면에서 동작 중이므로, 결과 화면(참여 여부 무관 공개 원칙, `PredictionResult.tsx:33-34` 주석)에서도 같은 방식으로 조회 가능하다. **스키마·RLS 변경 불필요.**

## 2. TEA-14가 남긴 인터페이스 (현재 브랜치 HEAD 기준 재확인)

- `Top3Entry` 타입은 `PredictionResult.tsx:411-417`에 **비공개(파일 내부) 타입**으로 이미 정의돼 있다: `{ playerId: number; name: string; photoUrl: string | null; rating: number; isMine: boolean }`.
- 소비 지점은 두 곳, 둘 다 `top3: Top3Entry[] | null` prop:
  - `PickResultRow`(모바일 행, `PredictionResult.tsx:547-597` 부근) — `top3`가 `null`/빈 배열이면 아코디언 트리거 자체를 렌더하지 않고(L568-574 주석·L575 조건) 정적인 행 하나로 끝난다.
  - `PickResultCard`(데스크탑 카드, `PredictionResult.tsx:608~`) — 같은 계약.
- 두 소비 지점 모두 현재 호출부(`MatchResultBlock` 안, `PredictionResult.tsx:353`·`363`)에서 **항상 `top3={null}`**로 호출된다 — "이슈 2가 데이터를 꽂을 자리" 주석(L346)이 그대로 남아있다.
- `Top3Row`(`PredictionResult.tsx:519-536` 부근)가 이미 순위·사진·이름·평점 배지·내 픽 강조(`entry.isMine`)까지 전부 구현돼 있다 — **UI는 완성 상태, 데이터만 없다.**
- 연결 지점은 정확히 하나다: `MatchResultBlock`(L284-294, props로 `match`/`state`/`predictions`/`candidates`를 이미 받는다) 안에서 `top3={null}`(L353, L363) 두 곳을 실제 값으로 바꾸면 된다.

## 3. 스키마 영향 — 없음 (에스컬레이션 불필요)

새 테이블·뷰·컬럼·마이그레이션이 필요 없다. 기존 `fixture_player_ratings`(공개 SELECT 이미 존재) + `season_squads`(포지션·이름·사진, 이미 공개 SELECT — `getPickCandidates()`가 같은 테이블을 anon으로 이미 읽음)의 조합만으로 데이터가 나온다. **이 이슈는 쿼리 계층 추가 + 컴포넌트 연결만으로 끝나는 작업이다.**

## 4. mock 모드 대응 — 확장 필요(schema 아님, mock 데이터 파일)

- `frontend/src/lib/mock/queries.ts:89-102`의 `mockGetHomeMatchdayFixture()`는 `topDefender: null` 등으로 **항상 하드코딩 null**이라, 실서비스와 달리 mock 모드에서는 평점 자체가 없다.
- `frontend/src/lib/mock/data.ts:550-573`의 `MOCK_RESULTS`(fixture id `'9001'`, `'9003'`)는 **내가 고른 선수 한 명씩의 평점**만 있다(`picks.DEF.rating` 등) — "포지션 후보 전체 평점" 목록은 어디에도 없다.
- 다만 후보 풀 자체는 이미 존재한다: `frontend/src/lib/mock/data.ts:517-529`의 `MOCK_SQUAD`가 DEF 4명(577175 보트만·180254 트리피어·184644 스카르·1140067 리브라멘투), MID 3명(869678 기마랑이스·1088651 토날리·586826 윌록), FWD 3명(725364 이사크·1146398 고든·487126 반스)을 이미 갖고 있고, `MOCK_RESULTS['9001']`의 픽(DEF 577175, MID 869678, FWD 725364)이 전부 이 풀 안의 실존 id다.
- **필요한 확장**: `MOCK_SQUAD`에 이미 있는 각 포지션 후보들에게 fixture별(최소 `'9001'`·`'9003'`) 가상 평점을 매겨 상위 3명을 뽑아낼 수 있는 mock 데이터 한 덩어리(예: fixture id → position → `{playerId, rating}[]`)를 추가한다. **새 player id를 지어내지 않고 기존 `MOCK_SQUAD` id만 재사용**하면 실서비스 조인 구조(같은 시즌 스쿼드 안에서 평점 매겨진 선수만 후보가 됨)와 어긋나지 않는다. 내 픽(`MOCK_RESULTS`)과 같은 id를 포함시켜야 `isMine` 강조도 mock에서 확인 가능하다(예: DEF top3에 577175를 포함).
- 이 확장은 `lib/mock/data.ts`에 상수 추가 + `lib/mock/queries.ts`에 조회 함수(아래 6번의 실쿼리와 짝을 이루는 mock 분기) 1개 추가로 끝난다. **DB/schema 변경 아님.**

## 5. 근거 미확인

- 없음 — 위 결론은 전부 파일:줄 근거로 확인됐다.

---

## 6. 쿼리 → prop → UI 연결 계획 (plan-top3 초안)

### 6-1. 새 쿼리 함수

- 위치 후보: `frontend/src/lib/queries/predictions.ts`(결과 화면이 쓰는 다른 조회 — `getMyResults`, `getWeekRanking`, `getFixtureRatings` — 가 전부 이 파일에 있어 같은 자리가 자연스럽다) **또는** `frontend/src/lib/queries/fixtures.ts`(`getMatchRatings`와 로직이 거의 동일해 재사용 여지가 큼). **이건 사람이 정할 구조 문제가 아니라 개발자 판단으로 plan 단계에서 정하되, 아래 트레이드오프를 그대로 plan.md에 남긴다**:
  - (선택 A) `fixtures.ts`의 `getMatchRatings()` 내부 로직(L132-196, 특히 `season_squads` 조인 부분)을 "포지션별 1위" / "포지션별 top N"으로 분기할 수 있게 인자화된 헬퍼로 쪼갠 뒤 양쪽에서 재사용 — 중복 제거, 다만 기존 홈 히어로 코드에 손을 대야 함(리스크: TEA-14 범위 밖 파일).
  - (선택 B) `predictions.ts`에 동일한 조회 로직을 그대로 새로 작성 — 기존 파일 무변경(안전), 대신 `fixture_player_ratings` + `season_squads` 조인 코드가 두 파일에 중복됨.
- 함수 시그니처(제안): `getFixturePositionTop3(fixtureId: number): Promise<Record<Position, { playerId: number; name: string; photoUrl: string | null; rating: number }[]>>` — 포지션당 최대 3명, 평점 내림차순. `isMine`은 여기서 넣지 않는다(이 함수는 "그 선수를 내가 골랐는지" 모른다 — 호출부가 이미 아는 정보라 여기 섞으면 관심사가 겹친다).
- 쿼리 본문은 `getMatchRatings()`(`fixtures.ts:132-165`)와 사실상 동일: `fixture_player_ratings`를 rating desc로 전체 조회 → 현재 시즌 `season_squads`에서 해당 player_id들의 `position`/`name`/`name_ko` 조인 → 포지션별로 묶어 **`find()` 대신 `filter().slice(0, 3)`**.

### 6-2. page.tsx에서 조회 + prop 전달

- `frontend/src/app/predictions/[weekKey]/page.tsx:26-38` — `week.status === 'result'` 분기에서 `Promise.all([getMyResults(), getWeekRanking(week.weekKey)])`(L28)를 호출하는 자리에 같이 묶는다. 더블 매치위크 대응을 위해 `week.matches`(2경기까지) 각각의 fixture id로 조회해야 하므로 `Promise.all(week.matches.map(m => getFixturePositionTop3(Number(m.id))))` 형태로 만들고, 결과를 `match.id`(string) 키로 다시 묶어 `Record<string, Record<Position, Top3Entry_원본[]>>`을 만든 뒤 `<PredictionResult>`에 새 prop(예: `topRatings`)으로 넘긴다.
- 이 방식은 기존 `results: MyResultMap`/`predictions: MyPredictionMap`이 이미 fixture id(string) 키 맵인 것과 같은 관례라 새 규칙을 발명하지 않는다.

### 6-3. PredictionResult.tsx 연결

- `PredictionResult` 함수 시그니처(L34-48)에 `topRatings` prop 추가 → `MatchResultBlock` 호출부(L79-84)에 `topRatings={topRatings[match.id]}` 전달 → `MatchResultBlock` props(L284-294)에 `topRatings` 추가.
- `MatchResultBlock` 안, `top3={null}`인 두 자리(L353, L363)에서 각 포지션별로:
  ```
  top3={(topRatings?.[position] ?? []).map(r => ({
    ...r,
    isMine: scored?.picks[position].playerId === r.playerId,
  }))}
  ```
  `scored`는 이미 L308에서 계산돼 있어 그대로 쓸 수 있다. 후보가 3명 미만인 포지션은 배열이 그만큼 짧게 나오면 되고(패딩 발명 금지), 0명이면 기존처럼 `top3={[]}`가 되어 트리거가 자동으로 숨는다(L568-574 관례 그대로 유지).

### 6-4. mock 분기

- `lib/queries/predictions.ts`(또는 6-1에서 정한 위치)의 새 함수 안에 `if (IS_MOCK) return MOCK_FIXTURE_TOP3[fixtureId] ?? EMPTY` 분기 추가, `lib/mock/data.ts`에 4번에서 설명한 `MOCK_FIXTURE_TOP3` 상수 신설.

---

## 7. 검증 방법

- 단위: 새 쿼리 함수는 순수 변환 로직(rating 정렬 + slice)이 아니라 DB 조회 함수라 `*.test.mjs`로 직접 단위 테스트하기 어렵다 — 기존 관례상 `lib/queries/*`는 별도 테스트가 없고(`result.ts`/`week.ts` 같은 순수 함수만 `*.test.mjs` 대상), 이 쿼리도 같은 패턴을 따르면 된다. **다만 `Top3Entry` 조립 로직(`isMine` 판정 등)을 컴포넌트 밖 순수 함수로 뽑을 수 있으면 그 함수는 테스트 대상으로 추가**(발명이 아니라 `result.ts`의 기존 관례 확장).
- 회귀: `npm test`(design-foundation.test.mjs 등 소스 문자열 검사가 `PredictionResult.tsx`를 이미 대상으로 하고 있을 가능성 높음 — 3단계 구현 시 실제로 걸리는지 확인 필요, 근거 미확인이라 실행해서 확인).
- 화면 확인: mock 모드에서 종료 주차(`'9001'`/`'9003'` 포함 주차) 결과 화면 진입 → 모바일 행 탭 시 TOP3 펼침, 데스크탑 카드 아래 TOP3 노출, 내 픽 행 강조(`isMine`) 확인. **mock만으로 끝내지 않고** 실제 Supabase 연동 모드에서도 평점이 채워진 종료 경기로 같은 화면을 확인한다(CLAUDE.md 원칙).
- 완료 게이트: `npm run lint`, `npm run build` (CLAUDE.md 표준 검증, plan.md 5단계와 동일 기준으로 이슈 2 완료 시점에도 실행).

## 8. plan-top3 단계 초안 (착수 승인 시 그대로 plan.md에 편입)

1. 쿼리 함수 신설(6-1) — 위치는 A/B 트레이드오프를 사람에게 확인 후 확정.
2. mock 데이터 확장(4번, 6-4) — 새 player id 발명 없이 `MOCK_SQUAD` 재사용.
3. `page.tsx` 조회 + prop 전달(6-2).
4. `PredictionResult.tsx`/`MatchResultBlock` 연결(6-3) — `top3={null}` 두 자리 교체.
5. 검증(7번) — `npm test` → mock 화면 확인 → 실 Supabase 모드 화면 확인 → `npm run lint`/`npm run build`.

이 계획은 이슈 1의 3단계(`PredictionResult.tsx` 재구성)가 먼저 끝나 있어야 충돌 없이 들어간다 — 같은 파일(`top3={null}` 두 자리, `MatchResultBlock` props)을 다루기 때문이다.
