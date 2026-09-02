# feature-spec — season_squads에서 선수 삭제하면 아예 로드가 안 되는 문제 발생

작성: 2026-09-02 · 작성자: developer 에이전트
입력: `intent.md`(같은 폴더, 단일 소스) · 현재 `main` 코드 재실측
승인권자: 사람 — 특히 "4-1 컬럼 설계"(택일)와 "4-2 필터 적용 범위"(설계 재확인)

이 문서는 `plan.md`의 입력이다. 여기 없는 기능은 임의로 추가하지 않는다.

design-brief는 없다(intent.md 확정 — 앱 관리자 UI 신설 없음, Supabase 대시보드 직접 수정 방식 유지).

---

## 0. 두 이슈 요약

1. **이슈 1 — 픽 후보 캐시 무효화**: `getPickCandidates()`의 `unstable_cache`에 태그가 없어 관리자가 season_squads를 고쳐도 최대 1시간 반영이 안 된다. 태그를 달고, 기존 "경기 결과·평점 동기화" 버튼이 그 태그도 함께 비우게 한다. 스키마 변경 없음.
2. **이슈 2 — 이적(떠난 선수) 표시 + 후보 목록 제외**: `season_squads`에 신규 컬럼을 추가해 관리자가 대시보드에서 직접 표시하고, 픽 **선택** 경로(선수 픽 모달, 제출 검증)에서만 제외한다. 과거 채점·이름 표시·관리자 평점 입력 폼은 전부 그대로 유지한다. 스키마 변경 있음 — 마이그레이션 적용은 사람 승인 필요.

---

## 1. intent.md 근거 재확인

| intent.md 주장 | 재확인 결과 |
|---|---|
| ①`squads.ts:94` `unstable_cache(..., ['pick-candidates'], { revalidate: 3600 })`, tag 없음 | **일치.** `frontend/src/lib/queries/squads.ts:94-96`. 리포 전체에 `pick-candidates` 태그를 비우는 `revalidateTag`가 없음도 재확인(`grep -rn "revalidateTag" frontend/src/lib` 결과 `fixture-weeks`, `prediction-rankings` 2개뿐). |
| ②관리자 동기화 액션은 `fixture-weeks`만 비운다 | **일치.** `frontend/src/lib/actions/sync-fixtures.ts:68`. |
| ③행 삭제 자체로 화면이 깨지는 경로는 없다(`found?.name ?? null` 폴백) | **일치, 단 경로 재확인 필요.** `PredictionDone.tsx`의 폴백은 함수 `resolvePicks`(L28-45, intent가 인용한 L35-40은 이 함수 안 `found` 선언부 근처)에 있고, `PredictionResult.tsx`는 `resolvePick`(L396-409, intent 인용 L406-409와 정확히 일치)에 있다. **중요 추가 발견(아래 4-2)**: 이 두 폴백이 참조하는 `candidates`는 **`getPickCandidates()`가 반환하는 값 그 자체**다(`app/predictions/[weekKey]/page.tsx:24`에서 한 번 가져와 두 컴포넌트 모두에 그대로 내려보냄). 즉 이슈 2에서 "픽 후보"를 걸러내는 지점을 잘못 고르면(예: `getPickCandidates()` 안에서 SQL로 필터) 이 폴백 경로가 오히려 **새로 발동**해서 intent 목표 2("과거 픽했던 선수는 이름이 계속 보여야 한다")를 정확히 어긴다. 4-2에서 해결 설계를 다룬다. |
| ④`prediction_results` view의 `ranked` CTE가 `season_squads`와 inner join, 행 삭제 시 소급 재채점 | **일치.** `supabase/migrations/20260830150000_toon_cup_scoring.sql:33-40`. `predictions.{def,mid,fwd}_player_id`에 FK 없음도 확인(`20260821120000_create_predictions.sql`에 FK 제약 없음, DB가 참조 무결성을 막지 않음). |
| ⑤season_squads엔 이적 표시 수단이 없고, `sync-season-squad`는 명단에서 빠진 선수를 지우거나 표시하지 않는다 | **일치.** `supabase/migrations/20260821110000_create_season_squads.sql` 전체 컬럼 목록에 상태 컬럼 없음. `supabase/functions/sync-season-squad/index.ts`는 FotMob이 돌려준 `validPlayers`만 upsert하고(10절), 없어진 선수에 대한 삭제/표시 로직이 없음(11절 upsert만 존재). |
| ⑥`AdminTransfersPanel.tsx`는 리포에 없음(가이드 drift) | **일치, 더 심함.** `frontend/src/app/admin/AdminTransfersPanel.tsx` **없음**, 같이 언급된 `frontend/src/app/admin/AdminDashboard.tsx`도 **없음**(`find frontend/src/app/admin -maxdepth 2 -type f` 결과: `page.tsx`, `ratings/page.tsx`, `admin-page.test.mjs` 셋뿐). `AGENT_MAINTENANCE_GUIDE.md:64-68` "관리자 대시보드 분리 메모" 섹션 전체가 존재하지 않는 두 파일을 가리키는 상태 — CLAUDE.md 루트 문서의 "Repo conventions" 절에도 `AdminDashboard.tsx`가 예시로 남아있으나(리포 루트 CLAUDE.md는 이 작업 범위가 아니므로 수정하지 않음, 4-6에서 별도 기록) `vault/99_old/AGENT_MAINTENANCE_GUIDE.md`는 이번 작업 범위라 정정 대상(plan 4단계). |
| ⑦season_squads 쓰기 코드가 앱에 없음 | **일치.** `grep -rn "from('season_squads')" frontend/src` 결과 `fixtures.ts:156`, `squads.ts:83` 둘 다 `.select(...)`(읽기)뿐, `.insert`/`.update`/`.upsert`는 0건. |

---

## 2. 이슈 1 — 픽 후보 캐시 무효화

### 2-1. 수정 파일

- `frontend/src/lib/queries/squads.ts:94-96` — `unstable_cache` 호출에 `tags: ['pick-candidates']` 추가.
- `frontend/src/lib/actions/sync-fixtures.ts:68` 근처 — `revalidateTag('fixture-weeks')` 다음 줄에 `revalidateTag('pick-candidates')` 추가.

### 2-2. 근거 패턴(리포 내 기존 선례)

`fixtures.ts:317-321`의 `getFixtureWeeks`가 이미 이 정확한 패턴이다:

```ts
export const getFixtureWeeks = unstable_cache(getFixtureWeeksUncached, ['fixture-weeks'], {
  revalidate: 300,
  tags: ['fixture-weeks'],
})
```

`squads.ts:94-96`은 세 번째 인자(`{ revalidate: 3600 }`)에 `tags`가 빠져 있어 `revalidateTag`가 물리적으로 아무것도 못 비운다 — Next.js `unstable_cache`는 두 번째 인자(key parts)가 아니라 `options.tags`만 태그로 쓴다. `predictions.ts:151-155`(`getWeekRankingRows`)도 같은 `{ revalidate, tags: [RANKING_TAG] }` 형태.

### 2-3. 버튼 동작 변경 — 확정 사항 재확인

intent.md 확정: "관리자 화면의 **기존** '동기화' 버튼이 후보 목록 캐시도 함께 비운다." 실제로 앱에 있는 동기화 버튼은 `AdminSyncButton.tsx`(`components/composition/admin/AdminSyncButton.tsx`) **하나뿐**이고, 이 버튼은 `syncFixtureData()`(`sync-fixtures.ts`)를 호출해 **경기 결과·평점**(`sync-fixture`, `sync-fixture-ratings`) 두 Edge Function만 돈다 — `season_squads`를 채우는 `sync-season-squad` Edge Function과는 **무관**하다(별도 함수, 앱에서 호출하는 곳 없음, `vault/99_old/SUPABASE_DATA_CONNECTIONS.md:588` "수동(시즌 시작·이적시장)"). 즉 이번 변경은 "경기 결과·평점 동기화" 버튼을 누르는 행위를, 그 버튼과 원래 무관했던 `season_squads` 캐시까지 함께 비우는 트리거로 **재사용**하는 것이다. 버튼 문구·UI는 바꾸지 않는다(intent 확정, design-brief 없음).

### 2-4. 이슈 2와의 관계

이 캐시 무효화는 이슈 2(신규 컬럼)와 **독립**이다 — 이슈 2 없이도 지금 당장 배포 가능하고, 이슈 2가 나중에 들어와도 같은 태그를 그대로 쓴다.

---

## 3. 이슈 2 — season_squads 이적 표시 + 후보 목록 제외

### 3-1. 목표 재확인 (intent.md)

1. 이적한 선수는 **픽 선택 대상**에서 빠진다(선수 픽 모달에 안 보이고, 서버 제출 검증도 거부한다).
2. 그 선수를 과거에 픽했던 제출·결과·채점·이름 표시는 **그대로 유지**된다(행을 지우지 않으므로 가능).

---

## 4. 설계

### 4-1. 컬럼 설계 — **✅ 확정 (2026-09-02, 사용자 답변)**

확정 컬럼: **`is_active boolean not null default true`** — `false`가 '떠난 선수'. 이름은 `players.is_active`(`initial_schema.sql:26`)와 같은 기존 관례를 따른 것으로, 아래 A/B/C 3안 중 어느 것도 아니라 `players.is_active`와 대칭 극성(양성 boolean)으로 별도 확정됐다. 이 문서와 plan.md의 `<departed_col>`은 전부 `is_active`로 읽는다. 파생 필드 `Candidate.departed`, 순수 함수 `excludeDeparted()` 이름은 아래 설계 그대로 유지하되 파생식만 `departed = !row.is_active`로 뒤집힌다.

아래는 확정 전 검토했던 원안(기록 보존용):

| 옵션 | 컬럼 정의 | 필터 조건(파생 `departed: boolean`) | 장점 | 단점 |
|---|---|---|---|---|
| **A. boolean** | `is_departed boolean not null default false` | `departed = row.is_departed` | Supabase 대시보드 Table Editor에서 체크박스 토글 — 가장 단순한 수기 입력 | "언제 이적했는지" 정보가 없음(요구사항엔 필요 없지만 향후 확장 시 컬럼 추가 필요) |
| **B. nullable timestamptz** | `departed_at timestamptz null default null` | `departed = row.departed_at !== null` | 이 코드베이스에 **이미 있는** 소프트 삭제 컨벤션과 정합 — `users.deleted_at`, `farewells.left_at`(둘 다 "null = 정상 상태"). "언제"까지 자연히 기록됨 | 대시보드에서 정확한 타임스탬프 값을 입력해야 함(체크박스보다 한 단계 더 신경 쓸 값) |
| **C. text enum** | `status text not null default 'active' check (status in ('active','departed'))` | `departed = row.status === 'departed'` | `players.squad_status`(`'first_team'\|'loan'\|'u21'`) 컨벤션과 일치, 향후 상태 세분화(예: `'loan_out'`) 여지 | 지금 요구사항은 이진값뿐이라 CHECK 제약·enum 확장 여지가 당장은 불필요(YAGNI) |

**개발자 추천: B(`departed_at timestamptz null`)** — 근거는 사용자가 직접 지시한 요구사항이 아니라 **기존 컨벤션 일치를 우선한 리스크 회피 판단**이다(`users.deleted_at`, `farewells.left_at`과 같은 패턴 재사용 → 다음 사람이 코드를 읽을 때 학습 비용이 적음). A(boolean)도 기능적으로 완전히 동등하고 대시보드 입력이 한 단계 더 단순하므로 충분히 타당한 대안이다. C는 지금 이진 요구사항에 비해 과설계로 보여 추천하지 않지만 옵션으로 남긴다.

**컬럼 이름도 함께 확정**: A라면 `is_departed`(또는 `players.is_active`와 대칭 극성으로 `is_active`), B라면 `departed_at`(또는 `left_squad_at`), C라면 `status`. 옵션·타입·이름을 한 번에 확정해달라 — 그 값을 그대로 마이그레이션에 쓴다(토큰 이름 확정 전례와 동일하게, developer가 후보 중 골라서 진행하지 않는다).

이 문서와 아래 4-2~4-5는 컬럼명을 `<departed_col>`로, 파생 불리언을 `Candidate.departed`로 지칭한다 — 어느 옵션이 확정되든 이후 설계는 동일하게 적용된다(4-4에서 왜 그런지 설명).

### 4-2. 핵심 설계 결정 — 필터를 어디에 걸 것인가 (신규 발견에 대한 해결안)

1번 표 ③에서 확인했듯, `getPickCandidates()`가 반환하는 `PickCandidates` 값 **하나**가 다음 4곳에 전부 흘러간다(`app/predictions/[weekKey]/page.tsx:24` 단일 fetch → prop 전달):

| 소비처 | 파일:줄 | 필요한 동작 |
|---|---|---|
| 선수 픽 모달 "선택 가능 목록" | `PredictionFlowClient.tsx:488` (`players={... candidates[pickTarget.position]}`) | **걸러야 함**(떠난 선수는 선택 불가) |
| 방금 고른 선수를 상태에 반영 | `PredictionFlowClient.tsx:502` (`candidates[position].find(...)`) | 안 걸러도 무방 — 찾는 id는 항상 위에서 이미 걸러진 목록에서 클릭된 값이라 자연히 안 떠난 선수 |
| 완료 화면 이름 표시(제출 후, 주차 진행 중) | `PredictionDone.tsx` `resolvePicks`(L28-45) | **걸리면 안 됨**(intent 목표 2) |
| 결과 화면 이름 표시(정산 후) | `PredictionResult.tsx` `resolvePick`(L396-409) | **걸리면 안 됨**(intent 목표 2) |
| 관리자 평점 입력 폼의 "픽 후보 전원" 목록(intent에 없던 추가 발견) | `app/admin/ratings/page.tsx:51` → `AdminRatingsForm` | **걸리면 안 됨** — 이 폼은 그 경기에 뛴 선수 전원(현재 이적했더라도 과거 경기 평점을 손보정해야 할 수 있음, 특히 오래 지나 소급 정정하는 경우)의 평점을 입력하는 화면이라, 여기서 떠난 선수를 빼면 관리자가 과거 평점을 못 고치는 회귀가 생긴다. |

**즉 `getPickCandidates()`를 SQL이나 그 안에서 필터링하면 5곳 중 3곳이 회귀한다.** 그래서 설계는 다음과 같다:

1. **`getPickCandidates()` 자체는 계속 이적 여부와 무관하게 시즌의 DEF/MID/FWD 전원을 반환한다**(지금과 동일 — 코드 변경 없음, `SQUAD_COLUMNS`에 `<departed_col>` 컬럼만 추가되고 `Candidate` 타입에 파생 `departed?: boolean` 필드가 실린다는 점만 다르다).
2. **신규 순수 함수 `excludeDeparted(candidates: PickCandidates): PickCandidates`**를 `squads.ts`에 `toPickCandidates` 옆에 추가한다(포지션별로 `departed`가 true인 항목만 걸러내는 순수 함수, DB 접근 없음 — `toPickCandidates`와 같은 성격).
3. `excludeDeparted()`를 **선택이 필요한 2곳에만** 적용한다:
   - `frontend/src/lib/actions/predictions.ts:48-49` — `getPickCandidates()` 직후, `buildPredictionRows()`에 넘기기 전에 `excludeDeparted()`를 거친다. `submit.ts`(순수 함수, 이미 "후보 목록에 없는 id = unknown_player" 로직을 갖고 있다 — `resolvePicks` L118-121)는 **코드 변경 없이** 그대로 동작한다: 이적 선수는 필터를 거친 뒤 후보 목록에서 사라지므로 `unknown_player`로 자연히 거절된다.
   - `PredictionFlowClient.tsx:488` — `candidates[pickTarget.position]` 대신 `excludeDeparted(candidates)[pickTarget.position]`(또는 `useMemo`로 한 번 계산). L502의 `candidates[position].find(...)`는 **그대로 둔다**(위 표 근거).
4. `PredictionDone.tsx`, `PredictionResult.tsx`, `app/admin/ratings/page.tsx`, `app/predictions/[weekKey]/page.tsx`는 **코드 변경 없음** — 지금처럼 `getPickCandidates()`의 미필터 결과를 그대로 쓴다. `Candidate.departed` 필드가 새로 실려도 이 파일들은 그 필드를 안 읽으므로 영향 없다.

이 설계로 intent가 요구한 "떠난 선수 필터가 후보 목록에만 걸리고 아래엔 안 걸림"을 파일 변경 0건으로 만족시킨다 — `PredictionDone`/`PredictionResult`/관리자 평점 폼 어느 것도 건드리지 않기 때문에 회귀 여지 자체가 없다.

### 4-3. 타입/쿼리 변경 상세

- `frontend/src/types/database.ts:258-278` `season_squads.Row`에 `<departed_col>` 추가(A라면 `boolean`, B라면 `string | null`, C라면 `string`). `Insert`/`Update`는 지금처럼 `Row`/`Partial<Row>` 그대로 따라간다(앱에 season_squads insert 코드가 없으므로 실제 영향 없음, 1번 표 ⑦ 재확인).
- `frontend/src/lib/queries/squads.ts`:
  - `SQUAD_COLUMNS`(L16-17)에 `<departed_col>` 추가.
  - `SquadCandidateRow`(L19-30, `Pick<SeasonSquadRow, ...>`)에 `<departed_col>` 추가.
  - `toPickCandidates`(L34-59)에서 `Candidate` 매핑 시 `departed: <파생식>` 추가.
  - `unstable_cache` 호출(L94-96)에 `tags: ['pick-candidates']` 추가(이슈 1과 같은 줄, 함께 커밋 가능).
  - 신규 export `excludeDeparted(candidates: PickCandidates): PickCandidates`.
- `frontend/src/lib/predictions/candidates.ts:17-30` `Candidate` 타입에 `departed?: boolean` 추가 — **선택 필드로 둔다**(값 안 실어도 컴파일 에러 안 나게). 근거: `PlayerPickModal.stories.tsx`의 `mockCandidate()`는 별개 타입(`PlayerPickCandidate`, `components/primitives/modal/contents/PlayerPick.tsx:10-20`)을 쓰므로 영향 없음을 확인했지만, `Candidate`를 직접 리터럴로 만드는 코드가 앞으로 생길 가능성에 대비해 optional로 두는 편이 안전하다(필수로 만들 이유가 없다).
- `frontend/src/lib/mock/data.ts`:
  - `squadMember`(L490-515) 헬퍼 안에서 `<departed_col>` 기본값을 직접 채운다(예: A/C면 상수, B면 `null`) — 기존 `pick_cost`(L513, `multiplier` 기반 계산)와 같은 패턴으로, 기존 11개 `squadMember(...)` 호출부는 **수정 없이** 그대로 컴파일된다.
  - `MOCK_SQUAD`(L517-530)에 이적 처리된 예시 선수 1명을 추가한다 — 기존 "GK는 픽 후보에서 걸러지는지 확인용"(L528-529, Pope) 관례를 그대로 따르는 것으로, 새 카테고리를 만드는 게 아니라 이미 있는 "엣지케이스 확인용 1명 추가" 패턴을 재사용한다. mock 모드에서 선택 목록 필터(`excludeDeparted`)를 눈으로 확인할 수 있게 한다.

### 4-4. 동기화 함수가 새 컬럼을 덮어쓰지 않는지 — 확인됨, 코드 변경 불필요

`supabase/functions/sync-season-squad/index.ts` 10절의 upsert `rows` 객체는 `season_id`, `fotmob_player_id`, `player_id`, `name`, `name_ko`, `shirt_number`, `position`, `position_ids_desc`, `nationality_code`, `nationality_name`, `date_of_birth`, `transfer_value`, `prediction_multiplier`, `synced_at` **만** 채운다 — **`pick_cost`가 이미 여기 없다**(`20260830130000_toon_pick_cost.sql`로 추가된 컬럼인데도 동기화 payload엔 없음). PostgREST의 upsert는 payload에 없는 컬럼을 `INSERT ... ON CONFLICT DO UPDATE SET`의 대상 컬럼 목록에서 아예 제외한다 — 그래서 기존 행은 그 컬럼이 **그대로 보존**되고, 신규 행은 컬럼 DEFAULT(`pick_cost`는 `2`)를 받는다. `pick_cost`가 지금 실제로 이 방식으로 월간 배치 잡(`recompute_pick_costs()`, `20260830140000_toon_monthly_cost.sql`)이 매긴 값을 매일 아침 동기화 후에도 유지하고 있다는 게 **이미 검증된 선례**다.

`<departed_col>`도 같은 원리로 동작한다 — 동기화 payload에 넣지 않으면(권장, 아래 참고) 기존 행의 관리자 입력값이 보존되고, FotMob이 새로 돌려주는 신규 선수는 DEFAULT(A/C: 활성, B: `null`=활성)를 받는다. **`sync-season-squad/index.ts` 코드 변경이 필요 없다.**

주의(참고용, 이번 작업 범위 아님): FotMob이 더 이상 안 돌려주는(이적한) 선수는애초에 `validPlayers`에 없어 `rows`에도 안 들어가므로, sync를 실행해도 그 행 자체가 **건드려지지 않는다**(update도 delete도 없음) — intent가 확정한 "위치 A"(자동 판정 C안 기각)와 일치한다. 복귀 선수가 다시 FotMob 목록에 나타나도 이 컬럼은 여전히 안 건드려지므로, 복귀 시 이적 표시를 지우는 건 관리자가 대시보드에서 수동으로 해야 한다 — intent가 이미 이렇게 확정했다(자동 판정 미채택).

### 4-5. 영향받지 않아야 하는 경로 — 최종 확인표

| 경로 | 파일 | 이번 변경으로 걸리는가 |
|---|---|---|
| `prediction_results` view 채점 | `20260830150000_toon_cup_scoring.sql:33-40`(`ranked` CTE) | **아니오** — SQL 자체를 안 건드림, `season_squads` join에 `<departed_col>` 조건을 추가하지 않는다 |
| 경기 평점 TOP3/포지션 1위 | `fixtures.ts:128-189` `getRatedSquadPlayers` | **아니오** — select 컬럼 목록(L155-158)에 `<departed_col>` 추가 안 함, 필터도 안 건다 |
| `toon_monthly_cost` 산정 | `20260830140000_toon_monthly_cost.sql` `recompute_pick_costs()` | **아니오** — SQL 안 건드림. 참고: 이적 선수는 픽 대상이 아니므로 이 값이 갱신되든 안 되든 사용자에게 노출되지 않아 무해 |
| 결과/완료 화면 이름 조회 | `PredictionDone.tsx`, `PredictionResult.tsx` | **아니오**(4-2 설계로 코드 변경 0건) |
| 관리자 평점 입력 폼 후보 목록 | `app/admin/ratings/page.tsx:51` | **아니오**(4-2에서 신규 발견, 코드 변경 0건) |
| 선수 픽 모달 선택 목록 | `PredictionFlowClient.tsx:488` | **예**(의도된 변경) |
| 제출 서버 검증 | `lib/actions/predictions.ts:48-49` → `submit.ts`의 `unknown_player` | **예**(의도된 변경, `submit.ts` 자체는 무변경) |

### 4-6. 스코프 밖으로 명시 확인

- `frontend/src/lib/predictions/submit.ts`: 무변경(4-2 근거).
- `frontend/src/components/composition/predict/PredictionDone.tsx`, `PredictionResult.tsx`: 무변경.
- `frontend/src/app/admin/ratings/page.tsx`, `AdminRatingsForm`: 무변경.
- `frontend/src/app/predictions/[weekKey]/page.tsx`: 무변경(`getPickCandidates()` 호출 그대로).
- `supabase/functions/sync-season-squad/index.ts`: 무변경(4-4 근거).
- `frontend/src/components/primitives/modal/contents/PlayerPick.tsx`, `PlayerPickModal.stories.tsx`: 무변경(구조적으로 호환, 3-1 근거).
- 리포 루트 `CLAUDE.md`의 `AdminDashboard.tsx` 언급(1번 표 ⑥): 이번 작업 범위(vault 문서)가 아니므로 여기서 고치지 않는다 — plan.md에 별도 기록만 남긴다(사람 판단 대상).
- 새 외부 라이브러리: 없음.
- 앱 관리자 UI 신설: 없음(intent 확정).

---

## 5. 문서 업데이트 필요 사항

- `vault/99_old/SUPABASE_DATA_CONNECTIONS.md`: `season_squads` 테이블 섹션이 **아예 없다**(문서 최종 갱신 2026-08-24, 테이블 생성은 2026-08-21이라 시점상 있어야 하는데 drift). `### season_squads` 절 신규 작성(다른 테이블 섹션과 같은 형식 — 역할/주요 컬럼/사용 위치/RLS/주의) + `<departed_col>` 반영 + "Edge Function · 크론" 표의 `sync-season-squad` 행 옆에 컬럼 보존 방식(4-4) 한 줄 추가.
- `vault/99_old/AGENT_MAINTENANCE_GUIDE.md:64-68` "관리자 대시보드 분리 메모": `AdminTransfersPanel.tsx`/`AdminDashboard.tsx` 언급을 걷어내고 실제 구조(`page.tsx` 링크 허브 하나, 이적/시즌스쿼드 수정은 앱 UI가 아니라 Supabase 대시보드 직접 수정)로 정정.

---

## 6. 영향받는 테스트

- `frontend/src/lib/queries/cache-policy.test.mjs`: 정규식 검사만 하는 파일(1번 표 근거 재확인 완료) — `unstable_cache`/`throw error`/`catch...return EMPTY` 패턴만 보고 `tags` 유무는 안 본다. **이번 변경으로 깨지지 않는다.** 다만 이슈 1의 실제 회귀 방지를 위해 `tags: ['pick-candidates']` 존재를 검사하는 새 단정문을 이 파일에 추가하는 걸 권장(plan에서 다룸).
- `frontend/src/lib/predictions/submit.test.mjs`: `submit.ts` 무변경이므로 기존 10개 테스트 전부 그대로 통과해야 함(회귀 확인용, 이번 변경으로 새 케이스 추가 불필요 — `excludeDeparted`가 호출부에서 적용되므로 "떠난 선수 픽 거부"는 이미 있는 `unknown_player` 테스트, L154-186 "마감/미완성/범위초과/모르는 선수는 전부 거절된다"가 그대로 그 시나리오를 대표한다).
- `squads.ts`/`excludeDeparted`/`toPickCandidates`에 대한 전용 유닛 테스트가 지금 **없다**(리포 전체에 `squad*.test.mjs`, `candidates*.test.mjs` 없음 확인). plan에서 신규 테스트 파일 추가를 다룬다.

---

## 7. 실연동 검증 제약

이 체크아웃에는 `frontend/.env.local`이 없다(확인됨, `ls frontend/.env.local` 결과 없음 — plan에서 재확인). 아래는 mock 모드만으로는 검증 불가능하고 실 Supabase 연결이 필요하다:

- 이슈 1: 관리자 동기화 버튼을 눌렀을 때 실제로 `pick-candidates` 캐시가 비는지(mock 모드는 `IS_MOCK` 분기라 애초에 캐시된 DB 조회를 안 탐).
- 이슈 2: 마이그레이션 적용 후 실제 `season_squads` 행에 `<departed_col>`을 세팅하고 → 선수 픽 모달에서 사라지는지 → 제출 시 거부되는지 → 완료/결과 화면엔 이름이 그대로 뜨는지 → `sync-season-squad` 재실행 후에도 값이 보존되는지.

실 모드 검증은 사람에게 env 제공을 요청하거나, 사람이 직접 스테이징에서 확인하는 것으로 plan에 표시한다.

---

## 8. 사람 확인 필요 목록 (요약)

1. **4-1 컬럼 이름·타입**(필수, 임의 확정 금지): A(boolean)/B(timestamptz, 개발자 추천)/C(text enum) 중 택일 — 또는 다른 이름 지정.
2. **4-2 필터 적용 범위 설계 재확인**(선택, 이견 있으면 알려달라): "`getPickCandidates()`는 무필터 유지 + `excludeDeparted()`를 선택 2곳에만 적용" 설계에 동의하는지. 별다른 이견이 없으면 이 설계로 plan을 진행한다.
3. **CLAUDE.md `AdminDashboard.tsx` 언급 정정 여부**(선택, 이번 작업 범위 밖이라 plan에서 실행하지 않음, 필요하면 별도 작업으로 분리).
