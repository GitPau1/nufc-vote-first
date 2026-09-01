# plan — 승부예측 결과 개편

작성: 2026-09-01 · 작성자: developer 에이전트
입력: `feature-spec.md`(같은 폴더)
**이 문서는 사람 승인 전까지 구현에 들어가지 않는다.**

---

## 0. 승인 전 확정 필요 항목 (구현 착수 조건)

아래 3건이 확정되기 전에는 1단계(토큰 추가)와 그 뒤 단계를 시작할 수 없다. `feature-spec.md` 9번 섹션 전문 참고.

| 항목 | 선택지 | 확정 방식 |
|---|---|---|
| 9-3. 새 semantic 토큰 이름 | 후보 A `--sem-fg-brand-on-solid` / 후보 B `--sem-fg-on-solid-brand` | 사람이 A/B 택일 |
| 9-2. 다크 랭킹 테이블 행 구분선 색 | (a) 신규 토큰 (b) 기존 `--sem-bg-on-solid-weak` 겸용 (c) 구분선 생략 | 사람이 택일 |
| 9-1. 카피 경계 케이스 2건 | 무승부 적중 서브라인 문구 / 더블 매치위크 2·0 전적중·전빗나감 헤드라인 이번 이슈 포함 여부 | 사람이 문구·범위 확정 |

**✅ 전부 확정 (2026-09-01, 사용자 답변) — plan 승인 완료, 구현 시작 가능:**
- 9-3: **후보 B** — `--sem-fg-on-solid-brand` → `text-on-solid-brand` (기존 on-solid 계열 접두 패턴)
- 9-2: **(b)** 기존 `--sem-bg-on-solid-weak`(흰색 5%) 겸용 — 시안(8%)보다 살짝 연해지는 것 인지하고 승인됨
- 9-1: **포함 + 제안 문구 채택** — 무승부인데 승패만 적중: 서브라인 "무승부는 맞혔지만 스코어는 달랐어요" / 더블위크 2/2: "두 경기 모두 적중!" / 0/2: "이번 주는 두 경기 모두 빗나갔어요"

---

## 1. 이슈 매핑

- **이슈 1 — 결과 화면 재구성**: 아래 1~5단계 전부(TOP3 UI 껍데기 포함, intent.md "추가 확정")
- **이슈 2 — 포지션별 평점 TOP3 데이터**: 이 plan의 실행 범위 밖. 착수 전 "전체 후보 평점 조회 가능 여부"(테이블/뷰/RLS)부터 확인해야 하므로 별도 feature-spec이 필요하다 — 이슈 1 완료 후 착수를 권장하나(TOP3 트리거 자리가 이슈 1에서 이미 만들어짐), 순서 강제는 없음.

---

## 2. 이슈 1 실행 단계

같은 파일을 건드리는 단계는 **순차**, 독립 파일은 **병렬 가능**으로 표시.

### 1단계 — semantic 토큰 추가 (0번 승인 후 시작)
- 파일: `frontend/src/app/globals.css`, `frontend/tailwind.config.ts`
- 내용: 0번에서 확정된 이름으로 `--sem-fg-*-on-solid` (또는 확정안) 토큰을 `--p-blue-400` 참조로 추가하고, `tailwind.config.ts`의 `colors.text`에 대응 클래스 노출. 9-2 확정안이 (a)면 구분선 토큰도 같이 추가.
- 의존: 0번 완료
- 검증: `npm test`(design-foundation.test.mjs의 "retired legacy color tokens" 항목이 신규 토큰과 충돌하지 않는지만 빠르게 확인)

### 2단계 — WeekRankCard.tsx 다크 테마 재작업 + capped 통일
- 파일: `frontend/src/components/composition/predict/WeekRankCard.tsx`
- 내용(feature-spec 5번 상세):
  - 컨테이너 자체 배경/테두리 제거(피날레 다크 카드에 얹히는 구조로)
  - 텍스트/배경 토큰을 온솔리드 계열로 전환(`text-on-solid`, `text-on-solid-muted`, `bg-on-solid-strong`)
  - 순위·종합 숫자 색에 1단계에서 만든 신규 토큰 적용
  - `capped` prop 제거 — 모바일/데스크탑 공통으로 `DESKTOP_CAP=10` + "더보기 ▾" 버튼(시안 카피) 방식 하나로 통일. 기존 모바일 전용 `max-h-[46vh]` 페이드 분기 삭제
- 의존: 1단계(토큰 이름 확정) 완료 후 순차
- 검증: `npm test`(design-foundation.test.mjs PREDICT_FILES 배열의 임의값 금지 검사가 이 파일에 적용됨 — named 토큰 클래스만 쓰는지 확인)

### 3단계 — PredictionResult.tsx 재구성
- 파일: `frontend/src/components/composition/predict/PredictionResult.tsx`
- 내용(feature-spec 2·4·6·7번 전체):
  - 모바일 세그먼트 토글 삭제(현 L78-86, 124-145)
  - 판정 헤드라인 컴포넌트 신규 작성 — `matchHit` import해 경기별 적중 등급 계산, 6번 카피 표 그대로 분기(9-1 확정 문구 반영)
  - 경기별 비교 카드 레이아웃을 시안 `.cmp` 구조로 재배치, 헤더 배지 통일
  - 내 선수 픽 헤더에 합산 점수 배지 추가, 데스크탑/모바일 각각에 TOP3 아코디언 껍데기 삽입(`Accordion` 프리미티브 사용, 데이터는 항상 없음 취급 → 항상 숨김)
  - 피날레 컴포넌트 신규 작성 — 기존 `Hero`의 `useCountUp`·등수·스트립 로직을 옮기고, 2단계에서 재작업한 `WeekRankCard`를 내부에 임베드
  - 공유 버튼을 페이지 최하단으로 이동
  - 상단 주석(L23-29, 현재 "히어로 → 내 예측 → 랭킹" 구조 설명)을 새 블록 순서 기준으로 다시 쓴다(개발자 체크리스트 "문서 drift 방지")
- 의존: 2단계 완료 후 순차(WeekRankCard의 새 API를 그대로 가져다 씀)
- 검증: `npm test`, 화면 실제 렌더 확인(dev 서버, mock 모드 + 가능하면 실제 Supabase 모드 둘 다 — CLAUDE.md "mock 모드에서만 확인하고 끝내지 말 것")

### 4단계 — WeekRankCard.stories.tsx 갱신
- 파일: `frontend/src/storybook/contents/WeekRankCard.stories.tsx`
- 내용: `capped` prop 제거에 맞춰 `argTypes.capped`(L72-77) 삭제, `Mobile`/`MobileExpanded` 스토리(L91-108, non-capped 전제)를 새 단일 분기 기준으로 재작성, 다크 배경 데코레이터 추가(현재는 라이트 배경 전제)
- 의존: 2단계 완료 후 — **3단계와 병렬 가능**(서로 다른 파일, 3단계는 PredictionResult.tsx만 건드림)
- 검증: `npm run storybook` 수동 확인(빌드 검증에는 포함 안 됨, 회귀 방지 차원)

### 5단계 — 완료 게이트 검증
- 대상: 1~4단계 전체
- 명령(전부 `frontend/`에서 실행):
  ```
  npm test          # 94개 전체 — design-foundation.test.mjs, analytics-contract.test.mjs, result.test.mjs 포함
  npm run lint
  npm run build
  ```
- 실패 시 결과를 그대로 보고하고 숨기지 않는다(developer-agent-rules.md 2번).
- `npm run build-storybook`은 CLAUDE.md 필수 검증 명령에 없으나, 4단계에서 스토리 파일을 크게 고쳤으므로 완료 게이트에서 한 번 같이 돌려 빌드 깨짐만 확인 권장(선택).

---

## 3. 이슈 2 — 포지션별 평점 TOP3 데이터 (범위 안내만, 이 plan 실행 대상 아님)

착수 시 별도 `feature-spec.md`가 필요하며, 최소한 아래를 먼저 확인해야 한다:
- 포지션 후보 전체(`PickCandidates`, `frontend/src/lib/queries/squads.ts`)의 경기별 평점을 조회할 테이블/뷰가 있는지, 없으면 새 뷰/쿼리가 필요한지 — **스키마 영향 있으면 Blocking 에스컬레이션 대상**(CLAUDE.md, developer-agent-rules.md 4번)
- 이슈 1의 3단계에서 만든 아코디언 껍데기 인터페이스(예: `top3: Top3Entry[] | null`)에 맞춰 데이터만 꽂는 방향으로 설계하면 이슈 1을 다시 건드릴 필요가 없다 — 이슈 1 3단계 구현 시 이 인터페이스 계약을 지키는 것이 이슈 2 순조로운 착수의 전제

---

## 4. 검증 시점 원칙 (developer-agent-rules.md 2번 그대로 적용)

- 1~4단계 진행 중에는 `npm test`(빠른 문자열 검사)만 수시로 돌린다.
- `npm run build`/`npm run lint`/storybook 빌드처럼 무거운 검증은 **5단계 완료 게이트에서 한 번**만 돌린다.
