# intent — season_squads에서 선수 삭제하면 아예 로드가 안 되는 문제 발생

작성: 2026-09-02 · 작성자: Fable(오케스트레이터), 사용자 답변 기반
승인권자: 사용자 (프로덕트 디자이너)
Linear 프로젝트: https://linear.app/teamboo/project/season-squads에서-선수-삭제하면-아예-로드가-안-되는-문제-발생-5bc8c4ad4c42

## 문제 (사용자가 겪은 것)

Woltemade처럼 이적한 선수를 Supabase 대시보드에서 `season_squads` 행 삭제로 빼냈더니, 실 서버의 승부예측 선수 픽 모달에 **삭제 전 목록이 그대로** 보였다(mock 모드는 mock 데이터만 보임 — DB를 읽지 않으니 정상). 지금은 행을 복구해 둔 상태.

- 재현 화면: 승부예측 선수 픽 모달 (`/predictions/<주차>` 제출 플로우)
- 삭제 방법: Supabase Table Editor에서 행 삭제
- 1시간 넘게 기다렸는지는 **미확인**(사용자 답변 "정확히 모르겠다")

## 조사 결과 (Fable, 코드 근거)

1. **후보 목록은 1시간 캐시이고 비우는 경로가 없다.** `frontend/src/lib/queries/squads.ts:94` — `unstable_cache(..., ['pick-candidates'], { revalidate: 3600 })`, tag 없음. 리포 전체에 `pick-candidates`를 무효화하는 `revalidateTag`가 없다. 관리자 동기화 액션(`frontend/src/lib/actions/sync-fixtures.ts:68`)은 `fixture-weeks`만 비운다. → 증상("이전 데이터만 보임")과 일치.
2. **행 삭제 자체로 화면이 깨지는 경로는 없다.** `PredictionDone.tsx:35-40`, `PredictionResult.tsx:406-409`, `PredictionFlowClient.tsx:502` 모두 없는 선수를 `found?.name ?? null` → "선수 정보 없음"으로 처리. `getPickCandidates`는 조회 실패 시 EMPTY를 돌려주지만(`squads.ts:104-111`) 행 삭제는 조회 실패를 만들지 않는다.
3. **행 삭제는 과거 채점을 바꾼다.** `supabase/migrations/20260830150000_toon_cup_scoring.sql:45-49` — `prediction_results` view의 `ranked` CTE가 현재 시즌 `season_squads`와 **inner join**으로 포지션 순위를 매긴다. 행을 지우면 (a) 그 선수를 픽한 예측은 소급해서 0점, (b) 같은 포지션 다른 선수들의 과거 순위가 당겨져 점수가 바뀐다. `predictions.{def,mid,fwd}_player_id`는 FK가 없어(`20260821120000_create_predictions.sql:21-25`) DB가 막아주지 않는다.
4. **season_squads엔 이적·퇴단 표시 수단이 없다.** 컬럼 정의(`20260821110000_create_season_squads.sql`)에 상태/퇴단일 컬럼 없음. `players.squad_status`('first_team'|'loan'|'u21')는 별개 테이블이고 두 테이블은 서로 참조하지 않는 설계(같은 파일 주석). 동기화 함수(`supabase/functions/sync-season-squad/index.ts` 10~12절)는 upsert만 하고 명단에서 빠진 선수를 지우거나 표시하지 않는다.
5. **근거 미확인**: `vault/99_old/AGENT_MAINTENANCE_GUIDE.md:66`이 가리키는 `AdminTransfersPanel.tsx`는 리포에 없다(가이드 drift). 배당·한글 이름도 앱 관리자 화면 없이 대시보드에서 직접 수정 중(리포에 season_squads 쓰기 코드 없음).

## 확정 사항 (2026-09-02, 사용자 답변)

- **범위 B 채택**: 이적 플래그 도입 + 캐시 무효화. "행 삭제"는 이적 처리 수단으로 쓰지 않는다 — 행은 남겨 과거 기록·채점을 보존하고, 픽 후보 목록에서만 숨긴다.
- **이적 조작 위치 A 채택**: Supabase 대시보드에서 직접 값 수정(기존 배당·이름 관리 방식과 동일) + 관리자 화면의 기존 '동기화' 버튼이 후보 목록 캐시도 함께 비운다. 앱 관리자 UI 신설 없음(designer 산출물 불필요). 동기화 함수의 자동 판정(C안)은 채택하지 않음.

## 목표

1. 관리자가 season_squads를 고친 뒤 '동기화' 버튼을 누르면 픽 후보 목록이 즉시 반영된다.
2. 이적한 선수는 픽 후보 목록에서 빠지되, 그 선수를 픽했던 과거 제출·결과·채점은 그대로 유지된다.

## 이슈 분할 (Fable 제안, 순서 = 1 → 2)

1. **픽 후보 목록 캐시 무효화** — `pick-candidates` tag 부여 + 관리자 동기화 액션에서 함께 `revalidateTag`. 스키마 변경 없음. 독립 배포 가능.
2. **season_squads 이적(떠난 선수) 표시 + 후보 목록 제외** — 컬럼 추가 마이그레이션, `getPickCandidates` 필터, `types/database.ts`·mock(`MOCK_SQUAD`)·문서 갱신. 스키마 변경이므로 plan 승인 시 사람 확인 필수.

## developer가 spec/plan에서 반드시 다룰 것

- **컬럼 이름·타입(퇴단일 `date`/`timestamptz` vs boolean 등)은 plan에 후보와 추천을 명시하고 사람이 확정**한다 — 임의 확정 금지(토큰 이름 확정 전례와 동일).
- 떠난 선수 필터가 **후보 목록(`getPickCandidates`)에만** 걸리고 아래에는 걸리지 않음을 명시·확인: `prediction_results` view(채점), `getRatedSquadPlayers`(경기 평점 TOP3/포지션 1위), `toon_monthly_cost` 산정, 결과/완료 화면의 이름 조회(행이 남으므로 "선수 정보 없음" 대신 이름이 계속 보여야 한다).
- 제출 검증(`frontend/src/lib/actions/predictions.ts`가 `getPickCandidates`를 씀)이 떠난 선수 픽을 거부하게 되는지 확인.
- 동기화 함수 재실행이 새 컬럼 값을 덮어쓰지 않는지(`upsert` rows에 새 컬럼이 없으면 보존되는지) 확인.
- `cache-policy.test.mjs`(squads.ts 검사)와 기존 테스트 정합. 스키마 변경 시 CLAUDE.md의 "Before touching DB" 절차와 `vault/99_old/SUPABASE_DATA_CONNECTIONS.md`·`AGENT_MAINTENANCE_GUIDE.md` 갱신(5번 drift 포함).
- **실연동 검증 제약**: 이 체크아웃에는 `frontend/.env.local`이 없다. 실 모드 확인이 필요한 단계는 plan에 표시하고 사람에게 env를 요청한다. mock 모드 확인만으로 끝내지 않는다.

## 다음 단계

1. developer 에이전트 → `feature-spec.md` + `plan.md` (plan은 사람 승인 후 구현)
2. linear-ops → 이슈 2개 생성 (내용은 오케스트레이터가 구성)
