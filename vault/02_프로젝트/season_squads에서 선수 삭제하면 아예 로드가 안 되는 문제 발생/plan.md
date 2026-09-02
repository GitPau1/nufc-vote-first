# plan — season_squads에서 선수 삭제하면 아예 로드가 안 되는 문제 발생

작성: 2026-09-02 · 작성자: developer 에이전트
입력: `feature-spec.md`(같은 폴더)
**이 문서는 사람 승인 전까지 구현에 들어가지 않는다.**

---

## 0. 승인 전 확정 필요 항목

| 항목 | 선택지 | 확정 방식 |
|---|---|---|
| season_squads 신규 컬럼 이름·타입 (feature-spec 4-1) | **A.** `is_departed boolean not null default false` (대시보드 체크박스, 가장 단순) · **B.** `departed_at timestamptz null default null` — **개발자 추천**(리스크 회피 판단: `users.deleted_at`/`farewells.left_at`과 같은 기존 소프트-삭제 컨벤션 재사용) · **C.** `status text not null default 'active' check (status in ('active','departed'))` (`players.squad_status`와 컨벤션 일치, 지금 요구엔 과설계) | 사람이 택일 (또는 이름만 다르게 지정) |
| 필터 적용 범위 설계 (feature-spec 4-2) | `getPickCandidates()`는 무필터 유지, 신규 `excludeDeparted()`를 제출 검증(`lib/actions/predictions.ts`)과 픽 모달 목록(`PredictionFlowClient.tsx:488`) 2곳에만 적용 — 나머지(완료/결과 화면, 관리자 평점 폼)는 코드 변경 없음 | 이견 없으면 이 설계로 진행(기본값) |

**이 표가 확정되기 전에는 3단계(마이그레이션 작성)부터 시작할 수 없다.** 1·2단계(캐시 무효화, 이슈 1)는 스키마와 무관하므로 이 표 확정과 무관하게 먼저 진행 가능하다.

**마이그레이션 적용(`supabase db push`)은 프로덕션 DB에 스키마를 바꾸는 되돌리기 어려운 작업이다 — 위 표 확정과는 별개로, 실제 적용 직전에 한 번 더 사람 확인을 받는다(아래 3-3단계).**

**✅ 확정 (2026-09-02, 사용자 답변):**
- season_squads 신규 컬럼: **`is_active boolean not null default true`** — false가 '떠난 선수'. 이름은 `players.is_active`(`initial_schema.sql:26`)와 같은 기존 관례를 따른다. feature-spec/plan의 `<departed_col>`은 전부 `is_active`로 읽는다(A/B/C 3안 중 어느 것도 아닌, `players.is_active`와 대칭 극성의 boolean으로 확정 — B 추천안은 채택되지 않음). 파생 필드 `Candidate.departed`, 순수 함수 `excludeDeparted()` 이름은 feature-spec 4-2 설계 그대로 유지(`departed = !row.is_active`로 파생식만 뒤집힘).
- 필터 적용 범위: feature-spec 4-2 기본안 그대로 채택. `getPickCandidates()`는 무필터 유지, `excludeDeparted()`를 픽 모달(`PredictionFlowClient.tsx:488`)과 제출 검증(`lib/actions/predictions.ts`) 2곳에만 적용.

---

## 1. 이슈 매핑

- **이슈 1 — 픽 후보 캐시 무효화**: 1~2단계.
- **이슈 2 — season_squads 이적 표시 + 후보 목록 제외**: 3~7단계, 0번 표 확정 후 시작.

---

## 2. 이슈 1 실행 단계

### 1단계 — 캐시 태그 추가 — **완료 (PR #12)**
- 파일: `frontend/src/lib/queries/squads.ts`
- 내용: L94-96 `unstable_cache(getPickCandidatesUncached, ['pick-candidates'], { revalidate: 3600 })`에 `tags: ['pick-candidates']` 추가(`getFixtureWeeks`, `fixtures.ts:317-321`과 같은 형태로 맞춘다).
- 의존: 없음, 즉시 시작 가능.
- 검증: `npm test`(회귀 확인 — `cache-policy.test.mjs`는 `tags`를 안 보므로 그대로 통과해야 함).

### 2단계 — 관리자 동기화 액션에서 함께 무효화 — **완료 (PR #12)**
- 파일: `frontend/src/lib/actions/sync-fixtures.ts`
- 내용: L68 `revalidateTag('fixture-weeks')` 다음 줄에 `revalidateTag('pick-candidates')` 추가. 주석으로 "경기 결과·평점 동기화 버튼이 season_squads 픽 후보 캐시도 함께 비운다" 이유를 남긴다(관례상 티켓 번호는 넣지 않는다, CLAUDE.md/developer-agent-rules 체크리스트 3번).
- 의존: 1단계 완료 후.
- 검증: `npm test`.

### 2-부속 단계 — cache-policy.test.mjs 보강 (회귀 방지) — **완료 (PR #12)**
- 파일: `frontend/src/lib/queries/cache-policy.test.mjs`
- 내용: `squads.ts` 소스에 `tags: ['pick-candidates']`(또는 `tags:\s*\[.*pick-candidates`) 패턴이 있는지 검사하는 새 `test(...)` 추가 — 이번 버그(태그 없이 1시간 캐시)의 재발 방지 목적. 기존 테스트 스타일(문자열 정규식 검사)을 그대로 따른다.
- 의존: 1단계 완료 후, 2단계와 **병렬 가능**.
- 검증: `npm test` (신규 테스트 통과 확인).

---

## 3. 이슈 2 실행 단계 — **0번 표 확정 후 시작**

### 3단계 — 마이그레이션 작성
- 파일: 신규 `supabase/migrations/<YYYYMMDDHHMMSS>_season_squads_departure.sql`(파일명은 리포 명명 규칙 `날짜시각_설명`을 따른다, 예: `20260902100000_season_squads_departed_flag.sql`)
- 내용: 0번에서 확정된 컬럼을 `season_squads`에 `alter table ... add column`으로 추가(예: `pick_cost` 추가 마이그레이션 `20260830130000_toon_pick_cost.sql`과 같은 형태 — 코멘트로 용도 남기기, RLS 정책 변경 불필요 근거를 주석에 명시: 기존 `season_squads: public read`가 컬럼 단위가 아니라 행 단위라 신규 컬럼도 자동으로 공개 조회된다).
- 의존: 0번 표 확정.
- 검증: 로컬에서 마이그레이션 문법만 확인(`supabase db push` 없이 SQL 리뷰) — **실제 적용은 3-3단계에서 별도 승인 후**.

### 4단계 — 타입/쿼리 계층 반영
- 파일: `frontend/src/types/database.ts`, `frontend/src/lib/queries/squads.ts`, `frontend/src/lib/predictions/candidates.ts`
- 내용(feature-spec 4-3 그대로):
  - `database.ts` L258-278 `season_squads.Row`에 신규 컬럼 추가.
  - `squads.ts` `SQUAD_COLUMNS`(L16-17), `SquadCandidateRow`(L19-30)에 신규 컬럼 추가.
  - `squads.ts` `toPickCandidates`(L34-59)에서 `Candidate.departed` 파생.
  - `squads.ts`에 `excludeDeparted(candidates: PickCandidates): PickCandidates` 신규 export 추가(`toPickCandidates` 근처, 순수 함수).
  - `candidates.ts` L17-30 `Candidate` 타입에 `departed?: boolean`(optional) 추가.
- 의존: 3단계(마이그레이션 SQL 작성, 적용 여부와 무관 — 타입은 미리 맞춰둘 수 있음). **단 실제 DB에 컬럼이 없는 상태로 실 모드 조회를 돌리면 에러**이므로, 실 모드 스모크 테스트는 3-3단계(마이그레이션 실제 적용) 이후로 미룬다.
- 검증: `npm test`, `npm run build`(타입 체크).
- ✅ plan 이탈 수용 (2026-09-02, 사용자 답변): `excludeDeparted()`는 `lib/predictions/candidates.ts`에 두고 `squads.ts`는 재export — squads.ts가 next/headers를 끌고 있어 클라이언트 컴포넌트(PredictionFlowClient)에서 import하면 `next build`가 실패했기 때문.

### 5단계 — 선택 경로 2곳에 필터 적용
- 파일: `frontend/src/lib/actions/predictions.ts`, `frontend/src/components/composition/predict/PredictionFlowClient.tsx`
- 내용(feature-spec 4-2 설계 그대로):
  - `predictions.ts` L48-49: `const candidates = await getPickCandidates()` 다음 줄에서 `excludeDeparted(candidates)`를 `buildPredictionRows`에 넘긴다. `submit.ts`는 **수정하지 않는다**(이미 `unknown_player`로 자연히 거절).
  - `PredictionFlowClient.tsx` L488: `players={pickTarget ? candidates[pickTarget.position] : []}`를 `excludeDeparted(candidates)[pickTarget.position]`로 변경(반복 호출 방지를 위해 컴포넌트 상단에서 `useMemo(() => excludeDeparted(candidates), [candidates])`로 한 번 계산해 재사용 권장). L502(`onSelect` 안의 `candidates[position].find(...)`)는 **그대로 둔다**(feature-spec 4-2 표 근거 — 클릭된 id는 이미 필터를 거친 목록에서 나온 값).
- 의존: 4단계 완료.
- 검증: `npm test`, `npm run build`.

### 5-부속 단계 — mock 데이터 반영
- 파일: `frontend/src/lib/mock/data.ts`
- 내용(feature-spec 4-3 그대로):
  - `squadMember`(L490-515) 헬퍼 내부에 신규 컬럼 기본값(활성 상태) 하드코딩 — 기존 `pick_cost`(L513) 계산 패턴과 같은 자리.
  - `MOCK_SQUAD`(L517-530)에 이적 처리된 예시 선수 1명 추가 — 기존 "GK 필터링 확인용"(L528-529, Pope) 관례를 재사용, 새 카테고리 발명 아님. 예시 선수의 실명 사용 여부는 파일의 기존 관례(현재 스쿼드 실명 사용)를 따른다.
- 의존: 4단계 완료, 5단계와 **병렬 가능**(다른 파일).
- 검증: `npm test`, `npm run dev`(mock 모드)로 선수 픽 모달에서 예시 선수가 실제로 안 보이는지 육안 확인.

### 6단계 — 신규 유닛 테스트
- 파일: 신규 `frontend/src/lib/queries/squads.test.mjs`(리포에 전례 없는 파일이지만, `submit.test.mjs`/`week.test.mjs`처럼 "쿼리·순수 로직 옆에 짝 테스트 파일" 관례를 따른다 — 새 디렉토리/네이밍 체계 발명 아님)
- 내용: `toPickCandidates`가 신규 컬럼을 `Candidate.departed`로 올바르게 매핑하는지, `excludeDeparted`가 포지션별로 `departed`인 항목만 제거하는지 — 순수 함수라 DB 없이 테스트 가능(기존 `submit.test.mjs`의 `ts.transpileModule` 로더 패턴 재사용).
- 의존: 4단계 완료.
- 검증: 새 테스트 파일이 `npm test`(전체 `*.test.mjs` 스윕)에 포함되는지 확인 — 개별 script는 없으므로 `npm test`로만 실행됨(CLAUDE.md 안내 그대로).

### 7단계 — 문서 갱신
- 파일: `vault/99_old/SUPABASE_DATA_CONNECTIONS.md`, `vault/99_old/AGENT_MAINTENANCE_GUIDE.md`
- 내용(feature-spec 5번 그대로):
  - `SUPABASE_DATA_CONNECTIONS.md`: `### season_squads` 섹션 신규 작성(다른 테이블 섹션과 같은 형식 — 역할/주요 컬럼/사용 위치/RLS/주의, 신규 컬럼 포함) + "Edge Function · 크론" 표의 `sync-season-squad` 행 근처에 "컬럼 보존 방식(payload에 없는 컬럼은 upsert가 안 건드림, `pick_cost`와 같은 원리)" 한 줄 추가.
  - `AGENT_MAINTENANCE_GUIDE.md:64-68`: "관리자 대시보드 분리 메모" 섹션에서 존재하지 않는 `AdminTransfersPanel.tsx`/`AdminDashboard.tsx` 언급을 제거하고, 실제 구조(`app/admin/page.tsx` 링크 허브 하나 + `ratings/page.tsx`, 이적/시즌스쿼드는 앱 UI 없이 Supabase 대시보드 직접 수정)로 정정.
- 의존: 3~6단계 완료 후(실제 구현 내용을 반영해야 정확한 문서가 나온다).
- 검증: 없음(문서 작업) — 다만 리포 루트 `CLAUDE.md`의 `AdminDashboard.tsx` 언급은 **이번 작업 범위 밖**이라 건드리지 않는다(feature-spec 8-3, 필요하면 사람이 별도 작업으로 분리).

---

## 4. 마이그레이션 적용 — 별도 승인 게이트

### 3-3단계 — `supabase db push` 실행
- **이 단계는 3~7단계 코드 작업과 별개로, 실행 직전 사람에게 다시 확인받는다** — 스키마 변경은 되돌리기 어렵고 프로덕션 데이터에 영향을 준다(developer-agent-rules 4번 에스컬레이션 기준).
- 실행 전 확인 사항: `supabase link` 대상이 실제 서비스 프로젝트(`xrvz…`)가 맞는지(`vault/99_old/AGENT_MAINTENANCE_GUIDE.md`가 경고하는 `ykjf…` 방치 프로젝트로 잘못 적용하지 않도록 `.env.local`의 URL과 `supabase/.temp/project-ref`를 대조).
- 적용 후: `frontend/src/types/database.ts`가 실제 스키마와 맞는지 `npm run types:supabase`로 재확인(가능하면).
- 2026-09-02: 사용자가 SQL을 직접 실행하기로 함(SQL Editor). 마이그레이션은 if not exists로 idempotent 처리. 적용 → PR #12 병합 → PR #13 병합 순서 필요.

---

## 5. 실 모드 검증 — env 필요

이 체크아웃엔 `frontend/.env.local`이 없다(확인됨). 아래는 mock 모드로 대체 확인이 안 되고 사람이 env를 제공하거나 직접 스테이징에서 확인해야 한다:

| 검증 항목 | 필요 조건 |
|---|---|
| 관리자 동기화 버튼 클릭 → `pick-candidates` 캐시 실제로 비는지 | 실 Supabase 연결 + 관리자 계정 |
| 마이그레이션 적용 후 신규 컬럼으로 대시보드에서 값 세팅 → 선수 픽 모달/제출 검증에서 실제로 제외되는지 | 실 Supabase 연결 + 마이그레이션 적용 완료(3-3단계) |
| 완료/결과 화면에서 이적 선수를 과거에 픽한 케이스가 여전히 이름을 보여주는지 | 위와 동일 + 그 선수를 픽한 과거 제출 데이터 |
| `sync-season-squad` 재실행 후 신규 컬럼 값이 보존되는지(4-4 설계 실측 확인) | 실 Supabase 연결 + `sync-season-squad` 수동 트리거 권한(curl 또는 대시보드) |

---

## 6. 검증 시점 원칙 (developer-agent-rules.md 2번 그대로 적용)

- 1·2·2-부속·4·5·5-부속·6단계 진행 중에는 `npm test`(빠른 문자열/유닛 검사)를 수시로 돌린다.
- `npm run build`/`npm run lint`는 이슈 1 완료 시점(2-부속 단계 후)과 이슈 2 완료 시점(6단계 후) 각각 한 번씩 완료 게이트로 돌린다.
- 완료 게이트 명령(전부 `frontend/`에서 실행):
  ```
  npm test
  npm run lint
  npm run build
  ```
- 실패 시 결과를 그대로 보고하고 숨기지 않는다.
- 5번 표의 실 모드 검증은 env 제공 여부에 따라 별도로 진행 — mock 모드 통과만으로 완료 보고하지 않는다(CLAUDE.md Architecture 절, intent.md 확정).
