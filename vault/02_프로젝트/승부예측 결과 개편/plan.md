# plan — 승부예측 결과 개편 (v2, main 기준 재작성)

작성: 2026-09-01 · 작성자: developer 에이전트
입력: `feature-spec.md`(v2, 같은 폴더)
**이 문서는 사람(재)승인 전까지 구현에 들어가지 않는다.** v1 plan으로 진행하던 구현은 drift 발견 시점(1단계 완료 직후)에 중단됐다 — v1의 1단계 결과물은 아래에서 "완료"로 이어받는다.

---

## 0. 승인 전 확정 필요 항목

v1에서 이미 사람이 확정한 3건(토큰 이름·구분선 색·카피 경계)과, 이번에 새로 사람이 확정한 1건(시즌 탭 제거)은 **재승인 불필요** — feature-spec.md 12-2에 근거를 남겨뒀다. 이번에 새로 확인이 필요한 건 아래 1건뿐이다.

| 항목 | 선택지 | 확정 방식 |
|---|---|---|
| 외곽 셸(Card) 유지 여부 (feature-spec 5번) | (a) 기존 `Card`(860px, 제출 화면과 통일) 유지, 새 5블록을 그 내부에 배치 — **개발자 추천**(짝 화면 정합 우선, 리스크 회피 판단) (b) `Card` 제거, 시안처럼 페이지 배경 위에 블록 나열 — 시안과 시각적으로 더 가까움 | 사람이 택일 |

**이 표가 확정되기 전에는 3단계(PredictionResult 재구성)를 시작할 수 없다.** 1·2·4단계는 셸 결정과 무관하게 먼저 진행 가능하다(아래 각 단계 "의존" 참고).

**✅ 확정 (2026-09-01, 사용자 답변) — plan v2 재승인 완료, 구현 재개 가능:**
- 외곽 셸: **(b) `Card` 제거 — 시안대로** 페이지 배경 위에 5블록 직접 나열. 제출↔결과 셸 통일(TEA-5)이 깨지는 점을 인지하고 확정함.

---

## 1. 이슈 매핑 (v1과 동일)

- **이슈 1 — 결과 화면 재구성**: 아래 1~5단계 전부(TOP3 UI 껍데기 포함)
- **이슈 2 — 포지션별 평점 TOP3 데이터**: 이 plan의 실행 범위 밖. 별도 feature-spec 필요.

---

## 2. 이슈 1 실행 단계

같은 파일을 건드리는 단계는 **순차**, 독립 파일은 **병렬 가능**.

### 1단계 — semantic 토큰 추가 — **완료 (커밋 `3533e92`)**
- 파일: `frontend/src/app/globals.css`, `frontend/tailwind.config.ts`
- 내용: `--sem-fg-on-solid-brand: var(--p-blue-400)`(globals.css) + `text-on-solid-brand`(tailwind.config.ts `textColor`) 추가.
- 검증: `node --test src/components/design-foundation.test.mjs` 14/14 통과, `npm test` 166/166 통과(회귀 없음) — 완료됨.

### 1-보충 단계 — `border-on-solid-weak` Tailwind 클래스 노출 (신규 발견, 값 변경 아님)
- 파일: `frontend/tailwind.config.ts`
- 내용: feature-spec 7번에서 발견 — `--sem-bg-on-solid-weak`(9-2 확정값 (b), 이미 `globals.css` L104에 존재)가 `backgroundColor`에만 노출돼 있고 `borderColor`에는 없다. `borderColor`에 `"on-solid-weak": "var(--sem-bg-on-solid-weak)"` 한 줄만 추가한다 — 새 CSS 변수도, 새 값도 아니므로 9-2 재승인 대상이 아니다.
- 의존: 1단계 완료 후(이미 완료) 바로 진행 가능, 3·4단계와 **병렬 가능**
- 검증: `node --test src/components/design-foundation.test.mjs`(임의값 아닌 named 클래스이므로 영향 없음, 빠른 재확인용)

### 2단계 — WeekRankCard.tsx 다크 테마 재작업 + capped 통일
- 파일: `frontend/src/components/composition/predict/WeekRankCard.tsx`(현재 142줄)
- 내용(feature-spec 7번 상세, 현재 파일:줄 기준):
  - L44 컨테이너: `rounded-lg bg-page p-4`(흰 카드 안 회색 패널) 제거 → 피날레 다크 카드에 투명하게 얹히는 형태. L42-43 주석을 새 맥락(다크 피날레 내부)으로 다시 쓴다.
  - L45 제목 `text-neutral` → `text-on-solid`
  - L89-96 `HeaderRow`: `bg-page` 제거, `text-neutral-muted` → `text-on-solid-muted`
  - L100-141 `RankRow`: 아바타 폴백 `bg-disabled`→`bg-on-solid-strong`, 이름 `text-neutral`→`text-on-solid`, 예측/선수픽 `text-neutral-muted`→`text-on-solid-muted`, 내 행 강조 `bg-brand-weak`→`bg-on-solid-strong`, 순위·종합 숫자 `text-brand`→`text-on-solid-brand`
  - 행 구분선: `border-neutral-weak` → `border-on-solid-weak`(1-보충 단계 완료 후 사용 가능)
  - `capped` prop(L22, L27, L35) 분기 제거 — `DESKTOP_CAP=10`(L9) + "더보기 ▾"(시안 카피) 버튼 하나로 통일. 모바일 전용 `max-h-[46vh]` 페이드(L55-57)·"전체보기 · N명" 버튼(L78) 삭제.
- 의존: 1단계 완료(완료됨), 1-보충 단계와 함께 진행 권장(순서 무관)
- 검증: `npm test`(design-foundation.test.mjs의 PREDICT_FILES 임의값 금지 검사가 이 파일에 적용됨)

### 3단계 — PredictionResult.tsx 재구성 — **0번 표 확정 후 시작**
- 파일: `frontend/src/components/composition/predict/PredictionResult.tsx`(현재 607줄)
- 내용(feature-spec 4·5·8·9·10번 전체, 현재 파일:줄 기준):
  - L74-85 탭 세그먼트, L130-152 `SegmentButton` 정의: 삭제
  - L52 `useState<'mine'|'rank'|'season'>('rank')`: 삭제(탭 없음)
  - L122-124 "순위" 탭 블록, L154-251 `SeasonRankSection`/`SeasonRankHeaderRow`/`SeasonRankRow`/`SEASON_RANK_CAP`: 전부 삭제(feature-spec 10번)
  - L40, L50 `seasonRanking` prop: 제거
  - 0번에서 (a) 확정 시: L71-73 `Card` 셸 유지, 아래 5블록을 그 자식으로 배치. (b) 확정 시: `Card`를 걷어내고 페이지 배경(`bg-page`) 위에 5블록을 직접 나열 — 어느 쪽이든 블록 내부 구현은 동일하다.
  - **① 판정 헤드라인 신규 작성**: `matchHit` import 추가(현재 미import). `spotlight-glow-brand-strong` 유틸리티(새 CSS 아님, `MatchdayHero.tsx` L179와 같은 클래스) 적용. 카피는 feature-spec 8번 표 그대로(9-1 확정 문구 반영, 무승부 적중 분기 포함).
  - **② 경기별 비교**: L343-425 `MatchResultBlock`의 스코어보드부(L379-400, `ScoreCompareRow`)는 재사용. 블록 헤더(제목 "경기 예측" + `PointsBadge`)를 새로 추가하고, `ScoreCompareRow`(L508-545) 호출에서 `badge` prop 전달을 제거(점수는 헤더 한 곳에만).
  - **③ 내 선수 픽**: 헤더(제목 "내 선수 픽" + `scored.pickPoints` 배지) 신설.
    - **[plan 오류 정정 — 2026-09-02 실기기 검수 반영]** 최초 이 줄은 "`PickResultRow`/`PickResultCard`는 레이아웃 유지, TOP3 아코디언만 추가"였다. 이건 틀렸다 — v1 spec 시절 "라벨 → 가운데 정렬 세로 스택(사진·이름·평점·구분선·점수)" 레이아웃을 그대로 재사용하면 된다고 잘못 적었는데, 시안-v9.html의 `.pick-card`는 이 구조가 아니다(좌상단 포지션 캡션 → 사진 64px **우측 정렬** → 사진 아래 좌측 평점 배지 → **상단 구분선 있는 푸터**에 이름(좌)+점수(우)). 목표 상태는 시안이지 기존 코드가 아니므로, 데스크탑 `PickResultCard`는 시안 구조로 다시 짜야 한다.
    - 모바일 `PickResultRow`도 시안 `.mpick-row`([사진 48px] → [포지션 캡션+이름 좌측 스택] → [평점 pill] → [점수] 한 줄) 기준으로 맞춘다 — 포지션 라벨을 행 위에 별도 줄로 두지 않는다.
    - TOP3 아코디언은 원래 계획대로: `Accordion` 프리미티브, 데이터는 항상 `null`이라 트리거 자체를 렌더하지 않음, `top3: Top3Entry[] | null` 인터페이스로 이슈 2 인계(feature-spec 6번).
  - **④ 피날레 신규 작성**: `Hero`(L259-323)의 등수·`useCountUp`(L325-341, 그대로 재사용) 로직을 가져오되 다크로 재작업(`spotlight-glow-brand-strong` + `text-on-solid*`). 그 안에 2단계에서 다크 재작업한 `WeekRankCard`(`capped` prop 없이 1회 호출)를 임베드.
  - **⑤ 공유 버튼**: `ShareButton` 호출을 피날레 다음, 페이지 최하단으로 이동.
  - **L30-31 상단 주석**: 3-tab/시즌 언급을 걷어내고 새 5블록 순서 설명으로 다시 쓴다(개발자 체크리스트 "문서 drift 방지").
  - `trackEvent('prediction_result_viewed', ...)`(L59-68) 블록은 **위치·리터럴 그대로 유지**(analytics-contract.test.mjs 근거, feature-spec 13번).
- 의존: 2단계 완료 + 0번 표 확정 후 순차
- 검증: `npm test`, 화면 실제 렌더 확인(dev 서버, mock 모드 + 가능하면 실제 Supabase 모드 둘 다)

### 3-부속 단계 — `app/predictions/[weekKey]/page.tsx` / `lib/queries/predictions.ts` 시즌 랭킹 정리
- 파일: `frontend/src/app/predictions/[weekKey]/page.tsx`, `frontend/src/lib/queries/predictions.ts`
- 내용(feature-spec 10번 표 그대로):
  - `page.tsx` L8-14: `getSeasonRanking`/`SEASON_RANKING_ALL_LIMIT` import 제거
  - `page.tsx` L35-39: `Promise.all([getMyResults(), getWeekRanking(week.weekKey)])`로 축소
  - `page.tsx` L50: `seasonRanking={seasonRanking}` prop 전달 제거
  - `predictions.ts` L224-228: `SEASON_RANKING_ALL_LIMIT` export + 관련 주석 삭제(사용처 0곳 확인 후). `getSeasonRanking(limit=3)` 함수 본체(L230-249)는 **유지**(목록 화면이 계속 씀)
  - `page.tsx` L33-34 "시즌 누적 순위(순위 탭)도 같은 원칙이라 여기서 같이 조회한다" 주석: 시즌 언급 문장만 삭제, 나머지 유지
- 의존: 3단계와 **함께 진행**(같은 프롭 계약을 다루므로 3단계 커밋에 묶는 걸 권장, 순서 강제는 없음)
- 검증: `npm test`(무관한 파일이라 회귀만 확인), 타입체크는 `npm run build`가 잡아준다(3번째 인자 제거 시 `PredictionResult` props 불일치는 TypeScript가 즉시 잡음)

### 4단계 — WeekRankCard.stories.tsx 갱신
- 파일: `frontend/src/storybook/contents/WeekRankCard.stories.tsx`
- 내용: `capped` prop 제거에 맞춰 `argTypes.capped`(L72-77) 삭제, `Mobile`/`MobileExpanded` 스토리(L91-108, non-capped 전제)를 새 단일 분기 기준으로 재작성, 다크 배경 데코레이터 추가. L189 주석(시즌 랭킹 언급)은 여전히 유효한 사실이라 **그대로 둔다**(feature-spec 10번 표 마지막 행).
- 의존: 2단계 완료 후 — **3단계와 병렬 가능**(서로 다른 파일)
- 검증: `npm run storybook` 수동 확인(회귀 방지 차원, CLAUDE.md 필수 검증 대상 아님)

### 5단계 — 완료 게이트 검증
- 대상: 1~4단계 전체(1단계는 이미 완료)
- 명령(전부 `frontend/`에서 실행):
  ```
  npm test          # 현재 166개 — design-foundation.test.mjs, analytics-contract.test.mjs, result.test.mjs 포함
  npm run lint
  npm run build
  ```
- 실패 시 결과를 그대로 보고하고 숨기지 않는다.
- `npm run build-storybook`은 CLAUDE.md 필수 검증 명령에 없으나, 4단계에서 스토리 파일을 크게 고쳤으므로 완료 게이트에서 한 번 같이 돌려 빌드 깨짐만 확인 권장(선택).

---

## 3. 이슈 2 — 포지션별 평점 TOP3 데이터 (범위 안내만, v1과 동일)

착수 시 별도 `feature-spec.md` 필요, 최소 확인 사항:
- 포지션 후보 전체(`PickCandidates`, `frontend/src/lib/queries/squads.ts`)의 경기별 평점 조회 가능 여부(테이블/뷰/RLS) — 스키마 영향 있으면 Blocking 에스컬레이션 대상
- 이슈 1의 3단계에서 만든 `top3: Top3Entry[] | null` 인터페이스 계약을 지키면 데이터만 꽂는 방향으로 착수 가능

---

## 4. 검증 시점 원칙 (developer-agent-rules.md 2번 그대로 적용)

- 1·1-보충·2·3·3-부속·4단계 진행 중에는 `npm test`(빠른 문자열 검사)만 수시로 돌린다.
- `npm run build`/`npm run lint`/storybook 빌드처럼 무거운 검증은 **5단계 완료 게이트에서 한 번**만 돌린다.
