# feature-spec — 승부예측 결과 개편

작성: 2026-09-01 · 작성자: developer 에이전트
입력: `intent.md`(단일 소스) · `design-brief.md`(UX 흐름·상태 매트릭스·카피·인터랙션) · `시안-v9.html`(승인 목업) · 현행 코드 실측
승인권자: 사람 — 특히 8번(새 semantic 토큰 이름), 9번(경계 항목) 확인 필요

이 문서는 `plan.md`의 입력이다. 여기 없는 기능은 임의로 추가하지 않는다.

---

## 1. 범위

- 대상 파일: `frontend/src/components/composition/predict/PredictionResult.tsx`, `frontend/src/components/composition/predict/WeekRankCard.tsx`, `frontend/src/storybook/contents/WeekRankCard.stories.tsx`, `frontend/src/app/globals.css`, `frontend/tailwind.config.ts`
- **범위 밖**(별도 이슈 2): 포지션별 평점 TOP3의 실데이터 연결. 이번 이슈에서는 아코디언 **UI 껍데기만** 만들고 데이터가 없으므로 항상 숨김 처리한다(intent.md L59, design-brief 7-1).
- `frontend/src/lib/predictions/result.ts`는 **로직 변경 없음** — 이미 필요한 함수(`aggregateWeekResult`, `matchResultState`, `matchHit`, `ourScoreOrder`, `ratingTier`)가 전부 존재하고 계약이 새 화면 요구사항과 맞는다(3번 참고). import만 늘어난다.

---

## 2. 화면 구성 변경 — 블록 순서

현재(`PredictionResult.tsx` L65-121): `Hero`(등수 히어로, L147-188) → 모바일 전용 "내 예측/전체 결과" 세그먼트 토글(L78-86, 124-145) → 경기별 `MatchResultBlock`(경기 비교 + 픽, L217-295) → 공유 버튼(경기 목록 바로 아래, L107-111) → `WeekRankCard`(토글로 숨겨짐, L114-118).

신규(시안-v9.html 순서, design-brief 2번 표 그대로):

| 순서 | 블록 | 현재 구현 | 신규 구현 |
|---|---|---|---|
| ① 판정 헤드라인 | 없음(신규) — 현재 `Hero`는 등수/점수만 보여줌 | 신규 컴포넌트. `matchHit`(result.ts L33-45, 이미 존재)로 경기별 적중 등급을 계산해 카피 분기(6번 참고) | 
| ② 경기별 비교 카드 | `MatchResultBlock`의 상단부(L244-271) | 헤더에 "경기 예측" + 점수 badge(현재 `PointsBadge`, L348-362)를 얹고, 크레스트 행 + 2행 비교 테이블 레이아웃은 시안 `.cmp` 구조로 재배치. **내 예측 행에는 점수 텍스트를 넣지 않는다**(intent.md L30) — 현재도 이미 안 넣고 있어(L254-261) 유지만 하면 됨 |
| ③ 내 선수 픽 | `MatchResultBlock`의 하단부(L273-292) + `PickResultRow`(L364-384)/`PickResultCard`(L386-412) | 헤더에 "내 선수 픽" + 합산 점수 badge 신설(현재 없음 — `scored.pickPoints`로 계산). 데스크탑 카드/모바일 행 레이아웃 자체는 기존 유지, **TOP3 아코디언만 추가**(4번 참고) |
| ④ 피날레(다크 카드 통합) | `Hero`(L147-188, 등수만) + `WeekRankCard`(별도 카드, 토글 뒤에 숨음) | 신규 컴포넌트가 `Hero`의 카운트업(L199-215 `useCountUp` 그대로 재사용)·등수·스트립을 유지하고, 그 **안에** `WeekRankCard`를 다크 테마로 임베드(5번 참고) |
| ⑤ 공유 버튼 | 경기 카드 아래(L107-111) | 페이지 맨 하단, 피날레 다음으로 이동 |
| (제거) | 모바일 세그먼트 토글(L78-86, 124-145) | 완전 삭제 — 모바일/데스크탑 동일 단일 스크롤 |

---

## 3. 데이터 계층 조사 — 랭킹 점수 분해 (근거 미확인 항목 1)

**결론: 이미 분해되어 있다. 스키마/뷰 변경 불필요.**

`RankingRow`(`frontend/src/lib/queries/predictions.ts` L100-111)에 이미 `matchPoints?`, `pickPoints?`, `totalPoints` 3개 필드가 있고, `getWeekRanking()`(L170-185)이 `week_leaderboard` DB 뷰(L155-157: `select('user_id, display_name, avatar_url, match_points, pick_points, total_points, rank')`)에서 그대로 채운다. `WeekRankCard.tsx`가 이미 이 3컬럼(예측/선수픽/종합)을 그리고 있다(`RankRow`, L98-139: `entry.matchPoints`, `entry.pickPoints`, `entry.totalPoints`).

→ 새 피날레 랭킹 테이블은 **기존 `WeekRankCard`를 다크 테마로 재작업해 재사용**하면 되고, 쿼리·뷰·타입 어느 것도 바꿀 필요가 없다.

---

## 4. TOP3 아코디언 — UI 껍데기만, 항상 숨김

- 재사용 프리미티브: `frontend/src/components/primitives/accordion.tsx`의 `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`. 애니메이션은 `tailwind.config.ts` L165-177의 `accordion-down`/`accordion-up`(0.2s ease-out) — 신규 값 없음(design-brief 5번).
- 데이터 부재: `Candidate`(`frontend/src/lib/predictions/candidates.ts` L17-)에 `rating` 필드가 없다 — 픽 후보 목록은 이름/사진/배당만 갖고 있고, 평점은 `MyResult.picks[position].rating`(내가 고른 선수 것)에만 존재한다(`PredictionResult.tsx` L319). 포지션 후보 전체의 평점을 조회할 방법이 현재 쿼리 계층에 없다 — intent.md L42, design-brief 7-1이 이미 이 사실을 확인해 별도 이슈로 격리했다.
- 처리: 아코디언 트리거(`포지션 평점 TOP3`) 자체를 **항상 렌더링하지 않는다.** 데이터가 없을 때 배지를 아예 안 그리는 기존 관례(`RatingBadge`, L337-345: `rating === null`이면 `null` 반환)와 같은 패턴이다. 레이아웃·마크업(`AccordionItem`/`Trigger`/`Content` 구조, 클래스)은 시안 그대로 만들어 두고, 렌더 조건(`top3: Top3Entry[] | null`을 항상 `null`로 넘기는 식)만 이슈 2에서 뒤집으면 되게 인터페이스를 잡는다.
- 데스크탑 카드 아래/모바일 행 펼침 두 자리 모두 이 방식.

---

## 5. WeekRankCard 다크 테마 재작업

현재 `WeekRankCard.tsx`(L42-82)는 라이트 카드(`bg-surface`, `border-neutral-weak`, `text-neutral*`)로 **자체 카드 컨테이너**를 그린다. 신규 피날레는 이 테이블을 다크 카드(`bg-neutral-strong` 기반) **안에 얹는다** — 시안 L193-218/300-325의 `.dark-card` 안 `.rk` 테이블 구조.

필요한 변경(파일:줄):
- L42 컨테이너: 자체 `rounded-lg border border-neutral-weak bg-surface p-4`를 걷어내고, 피날레 컴포넌트가 감싸는 다크 카드 안에 투명하게 얹히는 형태로 변경(중복 배경/테두리 방지)
- L43 제목 `text-neutral` → 다크 면 텍스트(`text-on-solid`/`text-on-solid-muted`, 시안은 캡션 "N주차 랭킹"을 헤더보다 위 스트립에 별도로 둠 — 시안 구조를 따른다)
- L85-96 `HeaderRow`: `text-neutral-muted` 계열 → `text-on-solid-muted`
- L98-139 `RankRow`: 아바타 폴백 배경 `bg-disabled` → `bg-on-solid-strong`(시안 `.rk .avatar`), 이름 `text-neutral` → `text-on-solid`, 예측/선수픽 컬럼 `text-neutral-muted` → `text-on-solid-muted`, 내 행 강조 `bg-brand-weak`(L103, 라이트 전용 배경) → `bg-on-solid-strong`(시안 `.rk tr.mine td`), 순위·종합 숫자색은 8번의 신규 토큰 대상
- 행 구분선: 시안은 `border-top: 1px solid rgba(255,255,255,.08)`을 쓰는데, 이 값에 대응하는 다크 면 전용 stroke semantic 토큰이 코드에 없다(`--sem-stroke-*` 계열, L135-140은 전부 라이트 팔레트 참조) — **9-2번 경계 항목**으로 별도 표기.
- **더보기 통일**(intent.md L60, design-brief 7-2): `capped` prop 분기(L30-40, L49-56)를 없애고 **항상 `DESKTOP_CAP = 10`(L9) 캡 + "더보기" 버튼** 방식 하나로 통일한다. 모바일 전용이던 `max-h-[46vh]` 페이드(L52-56)와 "전체보기 · N명" 버튼 문구는, 시안이 모바일/데스크탑 둘 다 "더보기 ▾"(L216, L323)를 쓰므로 문구도 시안에 맞춘다 — **문구 "전체보기 · N명" vs "더보기 ▾" 중 어느 쪽으로 통일할지는 카피 확정 사항이 아니라 이 스펙에서 시안 카피("더보기 ▾")를 채택**한다(design-brief 4번 카피 후보 목록에는 이 버튼 문구가 없었으나, 시안 자체가 승인된 목업이므로 시안 문자열을 그대로 쓴다).
- `capped` prop 자체를 없애면 시그니처가 바뀌므로 `PredictionResult.tsx` 쪽 두 군데 호출(L116-117, 현재 모바일/데스크탑 각각 다른 props로 두 번 렌더)도 하나로 합친다.

---

## 6. 카피 (design-brief 4번 A안 전부 채택, intent.md 추가 확정)

| 상태 | 헤드라인 | 서브라인 템플릿 |
|---|---|---|
| 정확 적중 (`matchHit === 'exact'`) | "스코어 **정확히 적중!**" | `{상대팀}전 {스코어}, 내 예측 그대로였어요` |
| 승패만 적중 (`'outcome'`) | "승부는 적중, 스코어는 아쉬웠어요" | `{상대팀}전 {스코어}, 승리는 맞혔지만 스코어는 달랐어요` (승/무/패에 따라 "승리"를 조건 분기해야 함 — 아래 참고) |
| 빗나감 (`'miss'`) | "이번엔 예측이 빗나갔어요" | `{상대팀}전 {스코어}, 내 예측과는 달랐어요` |
| 더블 매치위크 부분 적중(2경기 중 1경기) | "2경기 중 1경기 적중!" | `{경기1 상대팀}은 적중, {경기2 상대팀}은 빗나갔어요` (경기별 결과를 순서대로 나열) |
| 미참여 | "이 기간에는 예측에 참여하지 않았어요" (현행 `Hero`의 L162 문구 그대로) | 없음(단일 문구) |

**서브라인 "승리는 맞혔지만" 표현의 조건 분기 근거 미확인**: design-brief 예시(L66)는 승리 케이스만 들었다. 무승부를 맞힌 경우("무승부는 맞혔지만") 문구는 design-brief·intent.md 어디에도 없다 — **9-1번 경계 항목**.

**더블 매치위크 2/2 전적중·0/2 전빗나감**: design-brief L80이 "확정 요청 항목이 아니므로 후보를 만들지 않았다"고 명시했고 intent.md에도 없다 — **이번 이슈 구현 범위에서 제외**, 기존처럼 각 경기 카드에서 개별 상태만 보여주되 헤드라인 문구가 없는 조합이 생기지 않도록 처리 방법은 **9-1번 경계 항목**으로 escalation.

---

## 7. 상태 매트릭스 처리 (design-brief 3번 표, 근거 파일 재확인)

근거: `matchResultState`(result.ts L101-105)와 `aggregateWeekResult`(L64-79).

| | 채점 전 | 집계 중 | 집계 완료 |
|---|---|---|---|
| 참여 | 판정 헤드라인: 미참여와 동일 안내(현재 코드 구조상 `matchResultState`가 채점 여부로만 판단하므로 "제출은 했지만 안 끝남"과 "미참여"를 구분할 값이 없음 — design-brief 46번 줄에서 이미 확인된 간극, 기존 문구 재사용으로 덮기로 확정) · 경기 카드: 기존 `pending` 분기(L229-239) 그대로 유지 | 판정 헤드라인 정상, 피날레는 카운트업까지 노출 + 등수 자리 "등수 집계 중"(`summary.rank === null`, 기존 `Hero` L174 로직 그대로 이전) | 전부 정상 |
| 미참여 | 헤드라인 미참여 안내 + `pending` 경기 카드 | 헤드라인 미참여 안내 + 실제 결과 카드(match.actual, `week.ts` L58-59: "종료된 경기는 주차 상태와 무관하게 스코어를 그대로 보여준다" — 참여 여부와 무관하게 이미 값이 있음) + 랭킹은 공개(기존 정책 유지, 8번 참고) | 위와 동일 |

`aggregateWeekResult`가 `null`을 반환하는 조건(L69: 채점된 경기가 0개)이 그대로 "미참여 히어로/헤드라인" 분기 기준이 된다 — 로직 변경 없음.

---

## 8. 기존 제약과의 충돌 검토

**"결과는 참여 후에만 공개" 제약은 이 화면과 무관하다 — 실측 근거로 확인함.** 이 제약은 `frontend/src/app/polls/[id]/page.tsx` L59-62(`const hasVoted = !!myOptionId; const showResult = isClosed || hasVoted`)가 구현하는 **polls(투표) 도메인 전용** 정책이다. 승부예측(predictions) 도메인은 이 페이지·이 게이트를 전혀 거치지 않는 별도 라우트(`/predictions/[weekKey]`)이고, `PredictionResult.tsx`는 이미 기존 주석(L27-28)에서 "랭킹은 참여 여부와 무관하게 공개된다"는 **의도적으로 다른, 기존부터 있던 정책**을 명시하고 있다. 이번 개편은 이 기존 정책을 유지만 하고 바꾸지 않는다 — 미참여자에게 실제 경기 결과·랭킹을 보여주는 것은 새 화면이 만드는 게 아니라 이미 있던 동작이다. **충돌 없음.**

---

## 9. 사람 확인 필요 (에스컬레이션 — plan.md 승인 시 함께 확인)

### 9-1. 카피 경계 케이스 2건 (범위 확정 필요)
- 승패만 적중 서브라인에서 "무승부를 맞힌 경우" 문구
- 더블 매치위크 2/2 전적중·0/2 전빗나감 헤드라인 문구 (design-brief가 요청 범위 밖이라 후보 없음 — 이번 이슈에서 만들지 여부)

### 9-2. 다크 면 랭킹 테이블 행 구분선 색 (기존 논의에 없던 항목)
시안은 `rgba(255,255,255,.08)`을 쓰는데 대응하는 semantic stroke 토큰이 globals.css에 없다(L135-140 전부 라이트 팔레트). 8번 신규 토큰과 별개 항목이라 **임의로 값을 만들지 않고** 여기서 확인을 구한다:
- (a) 8번과 별도로 다크 면 stroke 토큰을 신설
- (b) 기존 `--sem-bg-on-solid-weak`(rgba(255,255,255,.05), L104)를 구분선 색으로 겸용
- (c) 구분선 없이 행 간격만으로 구분(시각 차이는 있음)

### 9-3. 신규 semantic 토큰 이름 — **후보 2개, 확정 필요**
intent.md L61에서 "신규 semantic 토큰 신설"(팔레트 `--p-blue-400`, 값 자체는 이미 존재, `globals.css` L53)은 이미 확정됐고, **이름만** 미정이다. 기존 명명 체계(`fg-on-solid`/`fg-on-solid-muted`, `globals.css` L122-127, `tailwind.config.ts` L98-100 `text-on-solid`/`text-on-solid-muted`) 기준으로 파생한 후보:

- **후보 A: `--sem-fg-brand-on-solid`** → `text-brand-on-solid`. 기존 `--sem-fg-brand`(라이트용, L128)에 `-on-solid` 접미사를 붙여 "다크 면 변형"임을 드러내는 방식. `--sem-bg-brand-solid-pressed`처럼 base 토큰 뒤에 상태/맥락을 덧붙이는 기존 패턴(L74-75)과 같은 순서.
- **후보 B: `--sem-fg-on-solid-brand`** → `text-on-solid-brand`. `--sem-fg-on-solid-muted`(L127)와 정확히 같은 자리에 수식어(`muted` 자리에 `brand`)를 넣는 방식 — "on-solid 계열의 한 변형"이라는 관계가 `fg-on-solid`/`fg-on-solid-muted`/`fg-on-solid-brand` 세 형제로 더 명확히 드러남.

둘 다 값은 `var(--p-blue-400)`로 동일. `tailwind.config.ts`의 `colors.text`(L98-101 부근)에 `text-brand-on-solid` 또는 `text-on-solid-brand`로 추가 노출한다. **사람이 둘 중 하나를 확정**해야 plan.md의 해당 단계를 실행할 수 있다.

---

## 10. 영향받는 테스트 (실측)

grep 결과 `PredictionResult`/`WeekRankCard`를 참조하는 테스트는 2개뿐:

1. **`frontend/src/components/design-foundation.test.mjs`**
   - L252-262 `PREDICT_FILES` 배열: `PredictionResult.tsx`, `WeekRankCard.tsx` 이미 포함 — **새 파일을 추가하지 않는 한(9번 참고, 이번 계획은 기존 두 파일만 수정) 목록 자체는 손댈 필요 없음**. 단, `globals.css`/`tailwind.config.ts`에 새 토큰을 추가하면 이 파일의 "retired legacy color tokens stay deleted" 테스트(L307-329 부근)에는 영향 없음(신규 토큰이지 구세대 토큰 부활이 아님) — 확인 완료.
   - L268-290 "arbitrary value 금지" 검사: 새 토큰을 **Tailwind 클래스**(`text-brand-on-solid` 등 named class)로 노출해 쓰면 이 정규식(`text-\[...\]` 등 대괄호 임의값만 차단)에 걸리지 않는다. 만약 구현 중 `text-[var(--p-blue-400)]` 같은 임의값 클래스를 쓰면 이 테스트가 깨진다 — **반드시 named 토큰 경유**로 구현.
2. **`frontend/src/lib/analytics/analytics-contract.test.mjs`** L109-111: `trackEvent('prediction_result_viewed'` 리터럴만 검사. 이 이벤트 호출부(`PredictionResult.tsx` L54-63)는 이번 변경에서 그대로 유지 — **영향 없음**, 재확인용으로만 돌린다.

**Storybook**(테스트는 아니지만 CLAUDE.md 검증 대상은 아님 — 개발자 체크리스트 "문서 drift 방지" 대상): `frontend/src/storybook/contents/WeekRankCard.stories.tsx`가 `capped` prop 존재를 전제로 8개 스토리(Mobile/MobileExpanded가 non-capped 분기, `argTypes.capped` 설명 L72-77)를 갖고 있다. 5번의 `capped` prop 제거 시 이 스토리 파일 전체를 다크 테마 + 단일 분기 기준으로 다시 써야 한다 — plan.md에 별도 단계로 명시.

`frontend/src/lib/predictions/result.test.mjs`는 `result.ts` 자체를 테스트하는데, 이번 계획은 `result.ts` 로직을 바꾸지 않으므로 **영향 없음**(회귀 확인용으로 `npm test` 안에서 같이 돈다).

---

## 11. 스코프 밖으로 명시 확인

- `frontend/src/lib/predictions/result.ts`: 로직 변경 없음
- 쿼리/액션/RLS/마이그레이션: 변경 없음(3번 결론)
- 이슈 2(TOP3 데이터 연결): 이번 이슈는 UI 껍데기만, 데이터 연결·조회 로직은 이슈 2
- 새 외부 라이브러리: 없음(Radix accordion은 기존 의존성)
