# intent — 승부예측 제출 수정·부분 제출

작성: 2026-09-03 · 작성자: Fable(오케스트레이터), 사용자와의 대화 기록
승인권자: 사용자 (프로덕트 디자이너)

## 배경

승부예측이 "주차별"이 맞는지에 대한 사용자의 고민에서 출발했다. 논의 결과, 지금 구조는 이미
DB/채점(경기 단위) 위에 "주차"라는 UI 그룹핑을 얹은 하이브리드라는 게 확인됐고(근거: `predictions`
테이블이 `fixture_id`당 1행, `lib/predictions/week.ts`의 `isMatchLocked`가 경기별 마감 판정),
"주차 vs 경기" 이분법 대신 아래 두 기능을 먼저 추가하기로 방향을 좁혔다.

## 확정된 결정 (2026-09-03, 사용자 확인)

1. **제출 수정 허용** — 승부예측은 킥오프 전까지 자유롭게 재제출(수정) 가능하게 한다.
   - 기존 "제출 후 수정 불가" 원칙(CLAUDE.md, `vault/10_gun/승부예측-랭킹-요구사항-명세서.md` NFR-001,
     `supabase/migrations/20260821120000_create_predictions.sql`)에 대한 **승부예측 한정 예외**다.
   - 문서 반영 완료: `CLAUDE.md`, `vault/99_old/SPEC_INDEX.md`, 요구사항명세서 v0.9(NFR-001).
2. **부분 제출 선택권 허용** — 더블 매치위크(한 주 2경기 이상)에서 사용자가 원하는 경기만 골라 제출할 수 있게 한다.
   - 기존엔 "이미 킥오프 지난 경기만 자동 제외"되는 강제된 부분 제출만 있었고(`lib/predictions/submit.ts:73-76`의
     `incomplete` 에러가 그 주 열린 경기 전부를 요구), 사용자가 능동적으로 선택하는 경로는 없었다.
3. **부분 참여자 집계 방식** — 일부 경기만 제출한 사용자는 **제출한 경기 수만큼만** 주간·시즌 집계에 포함한다
   (정규화 없음, 기존 암묵적 동작을 그대로 확정).
   - 요구사항명세서의 미확정 항목이던 CST-006이 이 결정으로 확정 처리됨(v0.9).

## 아직 안 정한 것 — 화면 설계 이슈 (사용자가 직접 제기, 2026-09-03)

결정 1·2가 실제 화면에서 어떻게 동작할지가 정해지지 않았다. 사용자가 짚은 구체적 케이스:

1. **더블 매치위크 진입 흐름**: 경기가 2개인 주차에서 "예측하기"를 눌러 들어가면—
   - (A) 두 경기를 한 화면/흐름에서 한 번에 예측하게 할 것인가
   - (B) 경기를 하나 골라 그 경기만 예측하는 흐름으로 바꿀 것인가
   - 부분 제출을 선택권으로 열기로 했으므로, 지금처럼 "그 주 열린 경기 전부"를 한 흐름에 강제로 묶는
     현재 UI(`PredictionFlowClient.tsx`, `steps.tsx`)와 정면으로 부딪힌다 — 그대로 두면 "부분 제출 선택"이
     설 자리가 없다.
2. **제출완료 화면의 수정 진입점**: `PredictionDone.tsx`(또는 결과 이전 "제출완료" 상태) 화면에서
   - 수정 버튼을 어디에 어떤 형태로 둘 것인가
   - 더블 매치위크에서 두 경기를 각각 다른 시점에 제출했을 수 있는데(1번 이슈와 연결), 수정 버튼을
     경기별로 따로 둘지, 주차 전체를 다시 여는 형태로 할지
3. **더블 매치위크 수정 범위**: 경기가 2개인 주에서 수정을 시작하면
   - 두 경기를 통째로 다시 제출해야 하는지
   - 경기 하나만 골라 그 경기만 수정할 수 있는지 (부분 수정)

이 세 가지는 "UX 패턴이 2개 이상의 합리적 선택지로 갈리는 경우"(designer-agent-rules.md 에스컬레이션 기준)에
해당해서, 오케스트레이터가 임의로 답을 정하지 않고 그대로 다음 단계(designer 에이전트)로 넘긴다.

## 관련 코드 근거 (designer/developer가 화면 흐름 판단 시 확인할 파일)

- `frontend/src/lib/predictions/week.ts` — 주차 그룹핑, `WeekStatus`, `submittableMatches`, `findWeekPrediction`
- `frontend/src/lib/predictions/submit.ts` — `buildPredictionRows`(현재 "그 주 열린 경기 전부 필수" 검증)
- `frontend/src/lib/actions/predictions.ts` — `submitWeekPrediction`(현재 insert 전용, 이미 제출된 주차는 `already_submitted` 에러)
- `frontend/src/lib/queries/predictions.ts` — `getMyPredictions`, `getMyResults`
- `frontend/src/components/composition/predict/PredictionFlowClient.tsx`, `steps.tsx` — 예측 입력 흐름(주차 단위 세션)
- `frontend/src/components/composition/predict/PredictionDone.tsx` — 제출완료 화면
- `frontend/src/components/composition/predict/MatchWeekList.tsx`, `WeekRankCard.tsx` — 목록/랭킹 화면
- `supabase/migrations/20260821120000_create_predictions.sql`, `20260823130000_predictions_weekly_window.sql`,
  `20260827140000_restore_predictions_partial_submit.sql` — RLS/UNIQUE 제약 (수정 허용 시 UPDATE 정책 신설 필요)
- `vault/10_gun/승부예측-랭킹-요구사항-명세서.md` (v0.9) — NFR-001, CST-006, FR-013

## 작업 환경

이 세션은 다른 세션과의 워크트리 공유 사고(2026-09-03 확인, `nufc-vote-first-86` 세션이 발견)를 계기로
`.claude/worktrees/predictions-edit-partial-submit` 워크트리로 격리해서 작업 중이다. 베이스라인 테스트
214개 통과 확인 완료.

## 다음 단계

1. designer 에이전트 → `design-brief.md` — 위 "화면 설계 이슈" 3가지를 포함해 사용자 흐름/시나리오 정리,
   선택지별 트레이드오프 제시 후 사람 확인
2. developer 에이전트 → `feature-spec.md` + `plan.md` (수정 허용 UPDATE 정책, 부분 제출 검증 완화,
   분석 이벤트 분리 등 포함). plan은 사람 승인 후 구현
3. linear-ops → Linear 프로젝트 "승부예측 제출 수정·부분 제출" 생성 (내용은 오케스트레이터가 구성)
