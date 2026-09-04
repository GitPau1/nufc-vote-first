# plan — 승부예측 제출 수정·부분 제출

작성: 2026-09-03 · 작성자: developer 에이전트 (2026-09-04 사용자 승인, feature-spec.md §7 확정 반영해 갱신)
2차 갱신: 2026-09-04 — 1~4·6~7단계는 이미 구현·커밋됨(PR #18, `7dbe0e6`/`32ad461`/`3f91c3c`). 더블
매치위크 "둘 다 예측하기"의 실제 동작(입력 흐름)이 시안-v3~v7 검토 끝에 바뀌어(feature-spec.md §9),
**5단계만 다시 열어 추가 구현**한다.
입력: `feature-spec.md` (같은 폴더, §9 신규 섹션 반드시 참고)
상태: **5단계 재작업 필요 — 나머지 승인·구현 완료**

`feature-spec.md §7`의 카피·구조 확인 항목 9개는 이미 반영됐다. DB 마이그레이션은 SQL 파일까지만
작성됐고 `supabase db push`는 여전히 사용자 직접 실행 대기 상태(1단계, 변경 없음). 분석 이벤트 확장은
스킵 확정 유지.

---

## 실행 순서

### 0단계 — 사전 확인 (완료, 2026-09-04)
- `feature-spec.md §7` 항목 9개 전부 확정됨(카피 포함). 아래 단계는 순서대로 바로 진행한다.

### 1단계 — DB: UPDATE RLS 정책 (완료)
- 신규 파일 `supabase/migrations/<timestamp>_predictions_allow_edit.sql` (내용은
  `feature-spec.md §2.1` SQL 그대로, 타임스탬프만 구현 시점 값으로 결정)
- 로컬 검증: `supabase db push`는 **사람이 직접 실행하거나 명시적 승인 후** 실행한다(스키마 변경,
  developer-agent-rules §4). 이 리포는 CLI가 리포 루트에서 `supabase link` 필요 — 개발자 에이전트가
  임의로 원격에 push하지 않는다.
- 테스트: 이 SQL 자체를 검증하는 자동 테스트는 없음(기존 관례상 migration은 unit test 대상 아님). RLS
  동작은 3단계 서버 액션 구현 후 mock 모드 + (가능하면) 로컬 Supabase로 수동 확인.

### 2단계 — `frontend/src/lib/predictions/submit.ts` (완료, 변경 없음 그대로 유지)
- **변경 없음** (feature-spec §2.2 근거). `submit.test.mjs` 그대로 통과하는지만 확인.
- 커밋 시 이 파일이 diff에 없어야 정상 — 있다면 설계에서 벗어난 것이니 재확인.

### 3단계 — `frontend/src/lib/actions/predictions.ts` (완료 — §9 재설계로도 추가 변경 불필요)
- `submitWeekPrediction(weekKey, matchIds, input)`로 시그니처 변경 (feature-spec §2.3.1)
  - `week.matches.filter(match => matchIds.includes(match.id))`로 좁힌 target을
    `buildPredictionRows`에 전달
  - JSDoc 주석(line 35-39 부근) 갱신 — "그 주 전체"가 아니라 "matchIds로 지정한 경기만"으로
- 신규 `updateMatchPrediction(weekKey, fixtureId, input)` 추가 (feature-spec §2.3.2)
  - mock/실연동 분기 둘 다 구현
  - 실연동: `.update(...).eq('user_id', user.id).eq('fixture_id', fixtureId).select('id')`,
    반환 행 0개면 `closed`
  - `trackServerEvent('prediction_updated', user.id, { week_key, fixture_id })` 추가(§5 채택 시)
- 테스트: 신규 `frontend/src/lib/actions/predictions.test.mjs` (feature-spec §8 — 소스 문자열 검사
  패턴, `analytics-contract.test.mjs`/`prediction-flow-action-bar.test.mjs` 참고)
- `analytics-contract.test.mjs`: `submitWeekPrediction` 호출부 변경으로 기존 정규식이 깨지는지 확인
  (grep 결과상 시그니처를 검사하는 assert는 없어 보이나, 구현 직후 `npm test` 전에 한 번 더 확인)

### 4단계 — `frontend/src/app/predictions/[weekKey]/page.tsx` (완료, §9로도 변경 없음)
- feature-spec §3.1의 6개 분기 로직 구현 (`editId` → `matchParam` → `prediction` → pending 0 →
  pending 1 → 선택 화면)
- `searchParams` 타입을 Next.js 버전에 맞게 확인(현재 리포의 다른 페이지가 `searchParams`를 어떻게
  타입 처리하는지 확인 후 동일 관례 사용 — 근거 미확인, 구현 시 리포 내 기존 예시 확인 필요)
- 이 단계는 3단계(서버 액션 시그니처)와 5단계(PredictionFlowClient props) 둘 다에 의존하므로 순서상
  마지막 배선 지점 — 3, 5단계와 함께 한 커밋으로 묶는 편이 안전(부분 적용 시 타입 에러만 남고 동작
  안 함).

### 5단계 — `frontend/src/components/composition/predict/PredictionFlowClient.tsx` (재작업 대상, §9)

**5-A (완료된 부분, 손대지 않음)**: `mode`/`matchIds`/`initialValues` prop, `handleSubmit`의
`mode`별 액션 분기, 확인 단계 문구 분기, edit 모드 성공 후 `router.push` 이동 — 전부 이미 구현·커밋됨.
edit 모드(`pending.length`가 항상 1)는 이번 §9 재설계와 무관하다.

**5-B (신규 — feature-spec §9 그대로 구현)**: `mode === 'submit'`이고 `pending.length > 1`(더블
매치위크 "둘 다 예측하기")일 때의 스코어·픽 입력 방식을 바꾼다.

1. **`isMulti` 분기 중 스코어·픽 "입력" 단계에 쓰이던 코드를 제거한다** — 경기별 `MatchLabel` 스택,
   경기별 `BudgetBar`, `copyPicks`("그대로 적용") 함수·버튼·관련 상태를 전부 들어낸다. 이 두 단계는
   이제 `pending.length`와 무관하게 항상 싱글 매치 레이아웃(경기 하나만 렌더)을 쓴다.
2. **`matchCursor` state 신규 추가**(또는 동등한 커서) — "지금 몇 번째 경기를 보고 있는지". `score`/
   `pick` 단계 렌더는 `pending[matchCursor]` 기준으로 한다.
3. **`completeStep`/`goPrev` 로직 확장**: `pick` 단계의 "다음"을 누르면 — `matchCursor`가
   `pending.length - 1`보다 작으면 `matchCursor + 1`로 올리고 `score` 단계로 되돌림, 이미 마지막
   경기면 `confirm` 단계로 진행. "이전"은 대칭(첫 경기 score에서 "이전" = 기존 이탈 확인 모달,
   그 외는 이전 경기의 pick 단계로).
4. **`ProgressPips` 점 개수를 동적으로 늘린다** — 세션 전체 스텝 수 = `pending.length * 2 + 1`.
   `steps.tsx`의 `ProgressPips`를 `total`/`activeCount` 받도록 확장할지, 호출부에서 점 배열을
   직접 조립할지는 구현 시 택 1(둘 다 결과가 같으면 무방, 시안-v7.html의 렌더 결과 기준).
5. **`confirm` 단계는 기존 `isMulti` 확인 화면 패턴(`MatchLabel` + `SummarySection` ×2, 경기별
   반복)을 그대로 재사용** — 이 부분은 걷어내지 않는다. 도달 경로만 "isMulti 진입 시 곧장 이 화면"에서
   "고정 순서의 마지막 단계"로 바뀔 뿐이다.
6. **제출은 여전히 `submitWeekPrediction(week.weekKey, matchIds, input)` 한 번 호출** — `matchIds`에
   두 경기 id가 이미 다 담기고 `input`도 두 경기 키를 다 채우므로 서버 액션은 무변경(feature-spec
   §9.2). "경기마다 따로 제출"은 이 재설계로 최종 폐기.
7. **크레스트는 원형(`rounded-pill`) 유지** — 바꿀 필요 없음(시안 과정에서만 흔들렸던 부분).

기존 `prediction-flow-action-bar.test.mjs`가 이 파일의 `StickyActionBar` 사용 여부를 정규식으로
검사한다 — 이번 변경이 그 부분을 건드리지 않는지 확인.

### 6단계 — `frontend/src/components/composition/predict/PredictionDone.tsx` (완료)
- `submittedMatches`/`deferredMatches`/`missedMatches` 3분류 (feature-spec §3.2, 갱신본)
- 카드별 "수정" 텍스트 링크는 **넣지 않는다**(§7-5 결정 변경)
- 유예 카드: 헤딩 "아직 예측하지 않았어요" + CTA "지금 예측하기"(→ `?match={id}`)
- 하단 액션: "공유하기" 완전 제거 → 큰 "수정하기" 버튼 하나로 교체
  - 제출 0개면 버튼 숨김, 1개면 `?edit={id}`로 직행, 2개 이상이면 `PredictionMatchSelect`
    (`mode: 'edit'`, 7단계)로 이동
  - 버튼 아래 고정 캡션 "킥오프 전까지 다시 수정할 수 있어요"

### 7단계 — 신규 `PredictionMatchSelect` 컴포넌트 (제출/수정 공용) (완료 — "둘 다 예측하기" 버튼은 그대로, 뒤의 5단계 동작만 바뀜)
- 위치: `frontend/src/components/composition/predict/PredictionMatchSelect.tsx`
- `mode: 'submit' | 'edit'` prop으로 제출 문맥과 수정 문맥을 겸한다(feature-spec §3.5)
  - `submit`: `pending` 경기 목록, 버튼 "○○전만 하기" + 경기가 정확히 2개일 때만 "둘 다 예측하기"
  - `edit`: `submittedMatches` 목록(기존 제출 스코어 같이 표시), 버튼 "○○전 수정하기", "둘 다" 버튼 없음
- **경기 3개 이상(트리플 매치위크) 케이스가 fixtures 데이터에 실제로 존재하는지 구현 중 확인** —
  없으면 "정확히 2개"만 처리, 있으면 다시 보고(feature-spec §3.5 근거 미확인 항목)
- 서버 컴포넌트, `next/link`로 이동 (feature-spec §3.4·§3.5)
- page.tsx 분기(4단계)에서 import해 사용

### 8단계 — 검증 게이트 (1회, 5단계 재작업분만 다시 실행)
- `frontend/`에서 `npm test` 전체 실행 — 실패 있으면 결과 그대로 보고
- `npm run lint`
- `npm run build`
- 세 명령 모두 출력은 `tail`로 요약해서 받고, 실패 시에만 전문 확인(developer-agent-rules §3-9)
- mock 모드 수동 확인 — 이번엔 특히 **더블 매치위크 "둘 다 예측하기"**에 집중: `npm run dev -p 3100`
  으로 띄워 (a) "둘 다 예측하기" 클릭 → 경기 1 스코어(pill 1/5) → 경기 1 픽(pill 2/5) → 경기 2
  스코어(pill 3/5, 여기서 화면에 경기 1 내용이 안 남아있는지) → 경기 2 픽(pill 4/5) → 확인(pill 5/5,
  두 경기 다 보이는지) → "제출하기" 한 번으로 둘 다 실제로 저장되는지(완료 허브에서 확인) (b) "이전"
  버튼으로 되돌아갈 때 이전 경기의 값이 유지되는지 (c) 기존 수정(edit) 경로 회귀 없는지도 같이 확인
- dev 서버는 PID 기록 후 그 PID만 kill (developer-agent-rules §3-8)

### 9단계 — PR 갱신
- 이미 PR #18이 있다(브랜치 `geonhaa/tea-23-...`) — 5단계 재작업 커밋을 같은 브랜치에 추가로 push.
- 새 커밋 메시지·PR 코멘트에 "더블 매치위크 흐름을 a-b-a-b-c 고정 순서 + 통합 확인/제출로 재설계"를
  명시(무엇을 왜 바꿨는지 리뷰어가 diff 없이도 알 수 있게).
- main 직접 push 금지, 기존 PR에 커밋만 추가.

---

## 파일 변경 요약

| 파일 | 변경 |
|---|---|
| `supabase/migrations/<new>_predictions_allow_edit.sql` | 신규 — UPDATE RLS 정책 |
| `frontend/src/lib/predictions/submit.ts` | 변경 없음 |
| `frontend/src/lib/actions/predictions.ts` | `submitWeekPrediction` 시그니처 변경 + `updateMatchPrediction` 신규 |
| `frontend/src/lib/actions/predictions.test.mjs` | 신규 |
| `frontend/src/app/predictions/[weekKey]/page.tsx` | 분기 로직 확장 |
| `frontend/src/components/composition/predict/PredictionFlowClient.tsx` | edit 모드 prop·분기(완료) + **§9: isMulti 입력 단계·copyPicks 제거, matchCursor 신규, ProgressPips 동적 개수, confirm 재사용**(재작업 대상) |
| `frontend/src/components/composition/predict/PredictionFlowClient.tsx` 관련 문구 3곳 | `feature-spec.md §4` (완료) |
| `frontend/src/components/composition/predict/PredictionDone.tsx` | 3분류 확장, 유예 CTA, 하단 수정하기 버튼(공유하기 대체), 카드별 링크 없음 |
| `frontend/src/components/composition/predict/PredictionMatchSelect.tsx` | 신규 — `mode: 'submit' \| 'edit'` 공용 |
| `frontend/src/components/composition/polls/*` 또는 공용 `Confirm.tsx` | `ConfirmContent` 문구 prop 오버라이드 추가 (feature-spec §7-9) |
| 신규 `*.test.mjs` (PredictionDone, PredictionMatchSelect, PredictionFlowClient 소스 문자열 검사) | 신규 |

분석 이벤트 확장은 스킵 확정이라 `frontend/src/lib/analytics/*` 변경 없음.

`frontend/src/lib/predictions/week.ts`, `MatchWeekList.tsx`는 **변경 없음** (feature-spec §2.2,
§3.1 근거 — design-brief도 목록 화면 CTA/배지 변경은 이번 스코프 밖으로 명시).

---

## 롤백 고려

- DB 마이그레이션(UPDATE 정책 추가)은 되돌리기 쉬움 — `drop policy`만으로 원상복구, 기존 행 데이터에
  영향 없음(정책은 접근 제어일 뿐 스키마 자체를 안 바꿈).
- 서버 액션 시그니처 변경(`submitWeekPrediction`에 `matchIds` 추가)은 **호출부가 이 리포 안에
  `PredictionFlowClient.tsx` 한 곳뿐**이라(grep 확인 완료) 마이그레이션 위험 낮음.

## 승인 후 다음 단계
사람이 이 plan.md를 승인하면 1단계부터 순서대로 구현하고, 각 단계 완료 후에도 별도 게이트 없이
9단계에서 한 번에 검증한다(developer-agent-rules §3-6). 구현 중 §7 미확인 항목과 무관한 새로운
판단이 필요해지면 임의로 정하지 않고 다시 보고한다.
