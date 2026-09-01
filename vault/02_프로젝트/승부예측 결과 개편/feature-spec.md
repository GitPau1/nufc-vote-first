# feature-spec — 승부예측 결과 개편 (v2, main 기준 재작성)

작성: 2026-09-01 · 작성자: developer 에이전트
입력: `intent.md`(단일 소스, "추가 확정 2" 포함) · `design-brief.md`(UX 흐름·상태 매트릭스·카피·인터랙션) · `시안-v9.html`(승인 목업) · **현재 `main`(HEAD `3533e92`) 코드 재실측**
승인권자: 사람 — 특히 5번(외곽 셸 유지 여부), 0번 표는 이미 전부 확정됨(이전 v1에서 승인 완료, 이번 재작성에서 값 안 바뀜)

이 문서는 `plan.md`의 입력이다. 여기 없는 기능은 임의로 추가하지 않는다.

---

## 0. v1 대비 무엇이 바뀌었나 (재작성 사유)

구현 착수 후 `feature-spec.md` v1/`plan.md` v1의 근거였던 코드 스냅샷이 stale하다는 게 드러났다. `main`을 최신으로 갱신(`git pull --ff-only`)해보니 v1 작성 시점 이후 **TEA-5~TEA-11(PR #7 `refactor/result-page-renewal`)이 이미 병합**돼 `PredictionResult.tsx`/`WeekRankCard.tsx`가 대대적으로 리팩터링돼 있었다. 사람 결정(`intent.md` "추가 확정 2"):

1. **시즌 누적 순위(TEA-11이 만든 "순위" 탭)는 결과 화면에서 제외한다.** 시즌 순위는 이미 예측 목록 화면(`PredictListClient.tsx`의 `RankingCard`)에 노출되므로 주차 결과 화면은 그 주차에만 집중한다. 10번에서 영향 범위를 실측한다.
2. **이 문서와 `plan.md`를 현재 `main` 기준으로 재작성**하고, 재작성한 `plan.md`는 사람 재승인을 다시 받는다(drift를 개발자가 임의 흡수하는 안은 기각됨).
3. 이미 커밋된 1단계(신규 토큰 `--sem-fg-on-solid-brand`, 커밋 `3533e92`)는 유효 — 재작성 plan에 "완료"로 반영한다.

**서두 정정(문서 drift 방지)**: 과거(`af5f9b3` TEA-6) "첫 진입 기본 탭은 '전체 결과'(점수 먼저)"가 사용자 확정 사항이었다. 이번 "판정 퍼스트 단일 스크롤" 결정(`intent.md` 목표)은 **그 확정을 대체**한다 — 탭 자체가 없어지므로 "기본 탭" 개념이 사라진다.

---

## 1. 범위

- 대상 파일:
  - `frontend/src/components/composition/predict/PredictionResult.tsx` (대규모 재구성)
  - `frontend/src/components/composition/predict/WeekRankCard.tsx` (다크 재작업 + capped 통일)
  - `frontend/src/storybook/contents/WeekRankCard.stories.tsx` (capped 제거에 맞춰 갱신)
  - `frontend/src/app/predictions/[weekKey]/page.tsx` (시즌 랭킹 조회·prop 제거, 10번 참고)
  - `frontend/src/lib/queries/predictions.ts` (죽은 export 정리, 10번 참고 — **쿼리 로직 자체는 안 바뀐다**)
  - `frontend/src/app/globals.css` / `frontend/tailwind.config.ts` (1단계 토큰, **이미 완료**)
- **범위 밖**(별도 이슈 2): 포지션별 평점 TOP3의 실데이터 연결. UI 껍데기만 만들고 데이터가 없으므로 항상 숨김 처리한다(`intent.md`, design-brief 7-1).
- **범위 밖**: `frontend/src/lib/predictions/result.ts` — TEA-5~11 기간에도 이 파일은 변경되지 않았다(`git log af5f9b3^..HEAD -- src/lib/predictions/result.ts` 결과 없음). `aggregateWeekResult`/`matchResultState`/`matchHit`/`ourScoreOrder`/`ratingTier` 전부 그대로 쓸 수 있다. 다만 `matchHit`은 **현재 `PredictionResult.tsx`가 import하지 않는다** — 판정 헤드라인 신설에 새로 추가해야 한다(4-② 참고).
- **범위 밖**: `season_leaderboard` DB 뷰, `getSeasonRanking()` 함수 자체 — 예측 목록 화면(`predictions/page.tsx` → `PredictListClient.tsx` → `RankingCard`)이 계속 쓴다. 결과 화면 쪽 **호출부만** 제거한다(10번).
- **범위 밖**: `frontend/src/lib/predictions/candidates.ts`, `frontend/src/lib/queries/squads.ts`, `frontend/src/components/primitives/accordion.tsx` — TEA-5~11 기간에 변경 없음(같은 방법으로 확인), v1 spec의 분석이 그대로 유효하다.

---

## 2. 현재 구조 재실측 (`PredictionResult.tsx`, 총 607줄)

v1 spec이 근거로 삼은 "모바일 전용 토글 + 다크 히어로" 구조는 이제 없다. 현재 구조:

| 구간 | 내용 |
|---|---|
| L34-51 | props에 `seasonRanking: RankingRow[]` 추가됨(TEA-11) |
| L52 | `useState<'mine' \| 'rank' \| 'season'>('rank')` — **3-tab**, 기본값이 `rank`("전체 결과") |
| L59-68 | `trackEvent('prediction_result_viewed', ...)` — `week_key`, `participated`, `rank`, `total_points`, `total_entries` 필드. `analytics-contract.test.mjs`가 `week_key: week.weekKey` / `participated,` / `total_entries: ranking.length` 리터럴을 검사한다(13번) |
| L71-73 | 셸: `mx-auto max-w-[860px] px-4 pb-16 pt-4 sm:px-6 sm:pt-8` 안에 `<Card className="p-5 sm:p-7">` 하나(제출 화면 `PredictionFlowClient`와 통일 규격, TEA-5) — **5번에서 유지 여부 결정 필요** |
| L74-85 | 탭 세그먼트(`SegmentButton` 3개: 내 예측/전체 결과/순위) — **전체 삭제 대상** |
| L87-113 | "내 예측" 탭 내용: 경기별 `MatchResultBlock`(L344-425) 반복 + 참여 시 하단 `ShareButton` |
| L115-120 | "전체 결과" 탭 내용: `Hero`(L259-323, 현재 **라이트** `bg-page`) + `WeekRankCard` 1회 호출(`capped` prop 없음 — TEA-6에서 이미 모바일/데스크탑 분기를 없애고 하나로 합쳤다) |
| L122-124 | "순위" 탭: `SeasonRankSection`(L165-251) — **10번에 따라 전체 삭제 대상** |
| L130-152 | `SegmentButton` 정의 — **삭제 대상**(탭이 없어지면 미사용) |
| L154-251 | `SEASON_RANK_CAP`, `SeasonRankSection`, `SeasonRankHeaderRow`, `SeasonRankRow` — **전체 삭제 대상**(10번) |
| L259-323 | `Hero` — 현재 라이트 배경(`bg-page`), 등수(`text-title-2`, `summary.rank===null?'집계 중':...`)·총점(`useCountUp` 재사용)·경기예측/선수픽 보조 통계. **④ 피날레의 기반으로 재사용, 다크로 재작업** |
| L325-341 | `useCountUp` — 그대로 재사용 |
| L343-425 | `MatchResultBlock` — 이미 시안과 유사한 스코어보드(`ScoreCompareRow` 기반, L508-545)로 재작업돼 있다(TEA-8). **부분 재사용**(4-② 참고) |
| L427-606 | `resolvePick`, `RatingBadge`, `PointsBadge`, `ScoreCompareRow`, `PickResultRow`, `PickResultCard`, `MatchupTeam` — 대부분 그대로 재사용 가능(4-③ 참고) |

---

## 3. 데이터 계층 — v1 결론 유지, 재확인

`RankingRow`(`frontend/src/lib/queries/predictions.ts` L100-111, 이번에도 변경 없음)에 `matchPoints?`, `pickPoints?`, `totalPoints` 그대로 있고 `getWeekRanking()`도 동일하다. `MyResult`(L266-274)에 `pickPoints: number`가 이미 있어 "내 선수 픽" 헤더 합산 배지(`+19점`)는 `scored.pickPoints`를 그대로 쓰면 된다 — 별도 합산 계산 불필요.

→ v1의 "쿼리·뷰·타입 어느 것도 바꿀 필요가 없다" 결론은 유지된다(시즌 랭킹 관련 변경은 10번 참고, 그것도 쿼리 로직이 아니라 호출부·죽은 export 정리일 뿐이다).

---

## 4. 신규 블록 순서 매핑 (재실측 기준)

| 순서 | 블록 | 현재 구현(재실측) | 신규 구현 |
|---|---|---|---|
| ① 판정 헤드라인 | 없음(신규). `Hero`는 등수만 다뤘지 적중 여부를 안 다룬다 | 신규 컴포넌트. `matchHit`(`result.ts` L33-45, **아직 import 안 됨** — 새로 추가)로 경기별 적중 등급 계산, 카피는 8번 표. 배경은 `spotlight-glow-brand-strong`(**기존 유틸리티**, `globals.css` L216-221 — `MatchdayHero.tsx` L179에 이미 쓰이는 클래스를 그대로 재사용, 새 CSS 없음) |
| ② 경기별 비교 카드 | `MatchResultBlock`(L344-425)의 스코어보드 부분(L379-400) — 이미 `ScoreCompareRow`(L508-545)로 "내 예측"/"실제 결과" 2행 비교를 구현해 놨다. 다만 **`PointsBadge`가 헤더가 아니라 "내 예측" 행 라벨 아래에 붙어 있다**(L390, `ScoreCompareRow`의 `badge` prop) | `ScoreCompareRow`/크레스트 행(`MatchupTeam`, L597-606)은 **그대로 재사용**. 바꾸는 부분: 블록 최상단에 헤더(제목 "경기 예측" + `PointsBadge`)를 새로 추가하고, `ScoreCompareRow`의 `badge` prop 호출은 제거한다(intent.md L29: "점수는 같은 badge 형태로 헤더 한 곳에만") |
| ③ 내 선수 픽 | `MatchResultBlock`(L402-422)의 픽 목록부 — `PickResultRow`(L547-567)/`PickResultCard`(L569-595) **그대로 재사용 가능**. 헤더(제목+합산 배지)는 없음 | 블록 헤더에 "내 선수 픽" + `scored.pickPoints` 배지 신설(3번 참고, 계산 불필요). `PickResultRow`/`PickResultCard` 레이아웃은 유지하고 **TOP3 아코디언만 추가**(6번) |
| ④ 피날레 | `Hero`(L259-323, 라이트)와 `WeekRankCard`가 서로 다른 탭에 분리돼 있다 | 신규 컴포넌트가 `Hero`의 등수·총점·`useCountUp`(L325-341, 그대로 재사용) 로직을 가져오되 **다크로 재작업**(`spotlight-glow-brand-strong` + `text-on-solid*` 계열, `Hero`의 `bg-page`/`text-neutral*` 대체) — `MatchdayHero`가 이미 같은 패턴을 쓴다(4-① 참고와 같은 근거). 그 안에 다크 재작업된 `WeekRankCard`(7번)를 임베드 |
| ⑤ 공유 버튼 | `ShareButton` 호출이 "내 예측" 탭 안, 경기 카드 아래(L108-111) | 탭 구조 제거 후 페이지(피날레) 다음, 최하단으로 이동 |
| (제거) | 탭 세그먼트(L74-85, `SegmentButton` L130-152) | 완전 삭제 — 모바일/데스크탑 동일 단일 스크롤 |
| (제거, 10번) | "순위" 탭(L122-124, `SeasonRankSection` 등 L154-251) | 완전 삭제 — 사람 결정(`intent.md` "추가 확정 2") |

---

## 5. 외곽 셸(Card) 유지 여부 — **사람 확인 필요 (신규 발견, v1엔 없던 항목)**

`PredictionResult.tsx`는 L71-73에서 `max-w-[860px]` 안에 흰 테두리 `Card`(`shadow-g200`, `components/primitives/card.tsx` L5-17) 하나로 전체를 감싼다. 이건 TEA-5("예측 결과 셸을 제출 화면 레이아웃과 통일")에서 **의도적으로** 제출 화면(`PredictionFlowClient.tsx`)과 규격을 맞추려고 도입됐다 — developer-agent-rules "짝 화면 정합" 체크리스트 대상이다.

반면 `시안-v9.html`의 `.page`(L26)는 옅은 회색 배경(`--bg-page`)에 `padding + gap`만 있는 컨테이너이고, `.dark-card`/`.card` 블록들이 그 안에 **테두리 없이 나란히** 놓인다 — 즉 시안은 "카드 안에 카드"가 아니라 "페이지 배경 위에 카드들"이다.

두 선택지:

| 선택지 | 내용 | 트레이드오프 |
|---|---|---|
| (a) 기존 `Card` 셸 유지 | 새 5블록을 `Card` 내부 자식으로 배치. 판정 헤드라인/피날레(다크)는 흰 카드 안에 얹힌 대비 블록이 된다 | 제출↔결과 셸 정합(TEA-5) 유지. 시안과 픽셀 단위로 똑같지는 않음(흰 프레임 한 겹이 더 있음) |
| (b) `Card` 제거, 시안처럼 페이지 배경 위에 블록 나열 | 시안과 시각적으로 가장 가깝다 | TEA-5가 만든 제출↔결과 셸 통일이 깨진다 — 두 화면이 다시 달라짐 |

**개발자 추천은 (a)**다 — 근거: 사용자 목표(v9 승인)가 명시한 건 "블록 순서·판정 퍼스트·다크 카드 색"이지 "흰 외곽 프레임 유무"가 아니고, TEA-5는 최근에 별도로 확정된 짝 화면 정합 결정이라 이번 이슈에서 건드리면 스코프 밖 파급(제출 화면과의 불일치)이 생긴다. **다만 이건 리스크 회피 쪽으로 기운 개발자 판단이지 사용자가 직접 지시한 사항이 아니므로, 임의로 확정하지 않고 여기서 확인을 구한다.**

`plan.md`는 (a)를 기본값으로 작성하되, 이 항목은 plan 승인 시 함께 확정한다.

---

## 6. TOP3 아코디언 — UI 껍데기만, 항상 숨김 (v1과 동일, 재확인)

- 재사용 프리미티브: `frontend/src/components/primitives/accordion.tsx`의 `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`(TEA-5~11 기간 변경 없음 확인). 애니메이션은 `tailwind.config.ts` L166-178의 `accordion-down`/`accordion-up`(0.2s ease-out) — 신규 값 없음.
- 데이터 부재: `Candidate`(`frontend/src/lib/predictions/candidates.ts`, 변경 없음)에 `rating` 필드가 없다 — 포지션 후보 전체 평점을 조회할 방법이 쿼리 계층에 없다(이슈 2 대상, `intent.md` 확정).
- 처리: 아코디언 트리거(`포지션 평점 TOP3`) 자체를 **항상 렌더링하지 않는다.** `top3: Top3Entry[] | null`을 항상 `null`로 넘기는 인터페이스만 잡아두고, `null`이면 트리거를 그리지 않는다(기존 `RatingBadge`의 "값 없으면 아예 안 그린다" 관례와 동일, L466-475).
- 데스크탑 카드 아래(`PickResultCard`, L569-595 확장)/모바일 행 펼침(`PickResultRow`, L547-567 확장) 두 자리 모두 이 방식.

---

## 7. WeekRankCard 다크 재작업 (재실측, 현재 142줄 기준)

v1이 근거로 삼은 "자체 흰 카드(`border-neutral-weak bg-surface`)"는 이미 없다 — TEA-6에서 `bg-page`(회색 패널, "흰 Card 안에 들어가는 패널" 주석 L42-43)로 한 번 바뀌었고, `capped` 분기(L22, L35, L51-58)도 **이미 모바일 캡+페이드/데스크탑 캡+버튼 두 갈래로 남아있다**(v1이 지시한 "제거 대상"과 지금 실제 코드가 같은 상태 — 이 부분은 v1 분석이 여전히 유효).

필요한 변경(현재 파일:줄 기준):

- L44 컨테이너: `rounded-lg bg-page p-4`(흰 카드 안 회색 패널 전제) → 피날레 다크 카드 안에 **투명하게** 얹히는 형태로 변경(자체 배경 제거). L42-43 주석("흰 Card 안 회색 패널")도 다크 피날레 안이라는 새 맥락으로 다시 쓴다(문서 drift 방지).
- L45 제목 `text-neutral` → `text-on-solid`
- L89-96 `HeaderRow`: `bg-page`(sticky 배경) 제거, `text-neutral-muted` → `text-on-solid-muted`
- L100-141 `RankRow`: 아바타 폴백 `bg-disabled` → `bg-on-solid-strong`, 이름 `text-neutral` → `text-on-solid`, 예측/선수픽 컬럼 `text-neutral-muted` → `text-on-solid-muted`, 내 행 강조 `bg-brand-weak`(L105) → `bg-on-solid-strong`, 순위(L108-112 `text-brand` 분기)·종합(L136 `text-brand`) 숫자색 → `text-on-solid-brand`(1단계에서 완료된 신규 토큰)
- 행 구분선: 현재 `border-b border-neutral-weak`(L104, `last:border-b-0` 패턴). 확정값(v1 plan 0번, 이미 승인됨) **(b) 기존 `--sem-bg-on-solid-weak` 겸용**을 쓰려면 **`tailwind.config.ts`의 `borderColor`(L112-120)에 `on-solid-weak` 키가 아직 없다** — `bg-on-solid-weak`는 `backgroundColor`(L84)에만 노출돼 있다. 즉 `border-on-solid-weak` 클래스는 지금 존재하지 않는다 — **plan에 "1단계 후속(작은 노출 추가)"로 명시**(새 CSS 변수도 새 값도 아니라 재승인 불필요, 다만 신규 발견이라 여기 기록한다).
- **더보기 통일**(`intent.md` "추가 확정" — 모바일도 버튼 방식): `capped` prop(L22, L27, L35) 분기를 없애고 `DESKTOP_CAP=10`(L9) + "더보기 ▾"(시안 카피, L216/323) 버튼 하나로 통일. 모바일 전용 `max-h-[46vh]` 페이드(L55-57)와 "전체보기 · N명" 버튼 문구(L78) 삭제.
- `capped` prop 제거로 시그니처가 바뀌므로 `PredictionResult.tsx` 쪽 호출부(현재 L118, 탭 구조 제거 후엔 피날레 컴포넌트 안 1회 호출)도 하나로 합친다.

---

## 8. 카피 (v1과 동일, plan.md 0번에서 이미 사람 확정 — 재확인만)

| 상태 | 헤드라인 | 서브라인 템플릿 |
|---|---|---|
| 정확 적중 (`matchHit === 'exact'`) | "스코어 **정확히 적중!**" | `{상대팀}전 {스코어}, 내 예측 그대로였어요` |
| 승패만 적중, 승리 (`'outcome'`) | "승부는 적중, 스코어는 아쉬웠어요" | `{상대팀}전 {스코어}, 승리는 맞혔지만 스코어는 달랐어요` |
| 승패만 적중, 무승부 (`'outcome'`) | 위와 동일 헤드라인 | `{상대팀}전 {스코어}, 무승부는 맞혔지만 스코어는 달랐어요` (승/무 조건 분기 — `predicted`가 무승부인지로 판단) |
| 빗나감 (`'miss'`) | "이번엔 예측이 빗나갔어요" | `{상대팀}전 {스코어}, 내 예측과는 달랐어요` |
| 더블 매치위크 부분 적중(1/2) | "2경기 중 1경기 적중!" | `{경기1 상대팀}은 적중, {경기2 상대팀}은 빗나갔어요` |
| 더블 매치위크 전적중(2/2) | "두 경기 모두 적중!" | (표기 방식은 plan에서 단일 경기 서브라인 패턴과 통일해 정한다) |
| 더블 매치위크 전빗나감(0/2) | "이번 주는 두 경기 모두 빗나갔어요" | 위와 동일 |
| 미참여 | "이 기간에는 예측에 참여하지 않았어요" (현행 `Hero` L272-274 문구 그대로) | 없음 |

이 표는 `plan.md` v1의 "✅ 전부 확정" 블록에서 이미 사람이 승인한 값을 옮긴 것이다 — 재승인 불필요, 값 변경 없음.

---

## 9. 상태 매트릭스 처리 (v1과 동일, 근거 파일 안 바뀜)

근거: `matchResultState`(`result.ts` L101-105)와 `aggregateWeekResult`(L64-79) — 이번 조사에서도 변경 없음 확인.

| | 채점 전 | 집계 중 | 집계 완료 |
|---|---|---|---|
| 참여 | 판정 헤드라인: 미참여와 동일 안내(`matchResultState`가 채점 여부로만 판단해 "제출했지만 안 끝남"과 "미참여"를 구분 못함 — 기존 확정대로 문구 재사용으로 덮음) · 경기 카드: `pending` 분기 그대로 유지 | 판정 헤드라인 정상, 피날레는 카운트업까지 노출 + 등수 자리 "등수 집계 중"(`summary.rank === null`, `Hero` L292 로직 그대로 이전) | 전부 정상 |
| 미참여 | 헤드라인 미참여 안내 + `pending` 경기 카드 | 헤드라인 미참여 안내 + 실제 결과 카드(참여 무관 공개) + 랭킹 공개(기존 정책 유지) | 위와 동일 |

`aggregateWeekResult`가 `null`을 반환하는 조건이 그대로 "미참여" 분기 기준이다 — 로직 변경 없음.

---

## 10. 시즌 누적 순위("순위" 탭) 제거 — 영향 범위 실측 (사람 결정 반영, v1엔 없던 섹션)

`intent.md` "추가 확정 2"에 따라 결과 화면에서 시즌 누적 순위를 제거한다. 데이터 계층(`season_leaderboard` 뷰, `getSeasonRanking()` 함수)은 목록 화면이 계속 쓰므로 **삭제 금지** — 결과 화면 쪽 소비만 걷어낸다. `grep -rn "seasonRanking\|SEASON_RANKING\|getSeasonRanking\|SeasonRankSection"` 실측 결과:

| 파일:줄 | 현재 | 처리 |
|---|---|---|
| `PredictionResult.tsx` L40, L50 | props에 `seasonRanking: RankingRow[]` | prop 제거 |
| `PredictionResult.tsx` L52 | `useState<'mine' \| 'rank' \| 'season'>` | `'season'` 유니온 멤버 제거(탭 자체가 없어지므로 `useState` 자체도 사라짐, 4번 참고) |
| `PredictionResult.tsx` L122-124 | `<div className={tab === 'season' ...}><SeasonRankSection entries={seasonRanking} /></div>` | 블록 삭제 |
| `PredictionResult.tsx` L154-251 | `SEASON_RANK_CAP`, `SeasonRankSection`, `SeasonRankHeaderRow`, `SeasonRankRow` 정의 | 전부 삭제 |
| `app/predictions/[weekKey]/page.tsx` L8-14 | `import { ..., getSeasonRanking, ..., SEASON_RANKING_ALL_LIMIT } from '@/lib/queries/predictions'` | `getSeasonRanking`/`SEASON_RANKING_ALL_LIMIT` import 제거 |
| `app/predictions/[weekKey]/page.tsx` L35-39 | `Promise.all([getMyResults(), getWeekRanking(...), getSeasonRanking(SEASON_RANKING_ALL_LIMIT)])` | 3번째 호출 제거, `Promise.all([getMyResults(), getWeekRanking(week.weekKey)])`로 축소 |
| `app/predictions/[weekKey]/page.tsx` L50 | `<PredictionResult ... seasonRanking={seasonRanking} />` | prop 전달 제거 |
| `lib/queries/predictions.ts` L224-228 | `SEASON_RANKING_ALL_LIMIT` export + 주석("결과 화면 '순위' 탭은 시즌 전체를 보여줘야 한다") | 위 제거로 **사용처 0곳** — export와 주석 함께 삭제(문서 drift 방지). `getSeasonRanking(limit = 3)` 함수 본체(L230-249)는 목록 화면이 그대로 쓰므로 **유지** |
| `app/predictions/[weekKey]/page.tsx` L33-34 | "랭킹은 참여 여부와 무관하게 공개된다 ... 시즌 누적 순위(순위 탭)도 같은 원칙이라 여기서 같이 조회한다" 주석 | `Promise.all` 축소(위 행)에 맞춰 시즌 언급 문장(L34)만 삭제, 나머지는 유지 |
| `PredictionResult.tsx` L30-31 | 상단 주석 "시즌 누적 순위(순위 탭)도 같은 원칙이다" | 새 블록 구조 설명으로 전체 재작성(4번 표 기준, 아래 3번째 항목과 함께) |
| `WeekRankCard.stories.tsx` L189 | 주석이 `getSeasonRanking()`을 참조(시즌 행에는 matchPoints/pickPoints가 없다는 근거 설명) | **삭제 대상 아님** — 이 주석은 여전히 유효한 사실(시즌 랭킹 행 구조는 안 바뀜)이라 그대로 둔다 |

`getSeasonRanking()` 함수 자체·`season_leaderboard` view·`predictions/page.tsx`(목록 화면)·`PredictListClient.tsx`·`RankingCard.tsx`는 **전부 변경하지 않는다**(실측 근거: `RankingCard`는 `PredictListClient.tsx` L160-161에서 이미 `variant="top3"`/`variant="mine"`으로 시즌 랭킹을 보여주고 있다).

---

## 11. 기존 제약과의 충돌 검토 (v1과 동일, 재확인)

"결과는 참여 후에만 공개" 제약은 `frontend/src/app/polls/[id]/page.tsx`(polls 도메인 전용)이고, 승부예측(predictions) 도메인은 이 게이트를 거치지 않는 별도 라우트다 — `PredictionResult.tsx` L30-31 주석이 "랭킹은 참여 여부와 무관하게 공개된다"를 이미 명시한다(10번에서 이 주석은 재작성 대상이지만 정책 자체는 유지). **충돌 없음**, 재확인 완료.

---

## 12. 사람 확인 필요 (에스컬레이션)

### 12-1. 외곽 셸(Card) 유지 여부 — **신규, 확인 필요**
5번 표 (a)/(b) 중 택일. 개발자 추천은 (a)(기존 `Card` 유지, 짝 화면 정합 우선) — 리스크 회피 판단이라고 표시함.

### 12-2. (참고, 재승인 불필요) 나머지 항목은 v1에서 이미 확정됨
- 토큰 이름(9-3 후보 B) — 완료·커밋됨(`3533e92`)
- 구분선 색(9-2 (b)) — 확정값 그대로, 다만 7번에서 발견한 "Tailwind `border-on-solid-weak` 클래스 노출 필요"는 값 변경이 아니므로 plan에 작업 항목으로만 추가
- 카피 경계 케이스(9-1) — 확정값 그대로(8번)
- 시즌 탭 제거 — `intent.md` "추가 확정 2"로 이미 확정(10번)

---

## 13. 영향받는 테스트 (재실측, 현재 `main`은 166개)

`npm test` 현재 통과 개수는 166개(1단계 토큰 커밋 반영, 회귀 없음 확인함). `grep -rln "PredictionResult\|WeekRankCard" src --include="*.test.mjs"`로 재확인한 결과, 실제로 **파일 소스 문자열을 정규식으로 검사**하는 테스트는 v1과 동일하게 2개뿐이다(`"composition/predict/"` 경로 문자열만 우연히 매칭되는 `score-input.test.mjs`/`prediction-flow-action-bar.test.mjs`/`result-view-figma-contract.test.mjs`/`navigation-loading.test.mjs`는 내용을 열어보면 `PredictionResult`/`WeekRankCard` 리터럴을 실제로 검사하지 않는다 — 주석 언급 1건(`result-view-figma-contract.test.mjs` L42)뿐):

1. **`frontend/src/components/design-foundation.test.mjs`**(전체 14개 테스트 중 관련 2개)
   - `PREDICT_FILES` 배열(L254-267, v1과 목록 동일 13개 — TEA-5~11도 파일을 추가하지 않았다): "application source does not use arbitrary typography or hardcoded visual colors"(L277)와 "prediction screens do not fall back to legacy color tokens"(L484) 두 테스트가 이 배열을 순회한다. 새 토큰(`text-on-solid-brand`)은 named 클래스이므로 두 테스트 모두 통과 조건 그대로 유지 — 임의값(`text-[...]`, `bg-[var(...)]` 등)만 쓰지 않으면 된다.
   - "retired legacy color tokens stay deleted"(L326): 신규 토큰이므로 무관, 재확인만.
2. **`frontend/src/lib/analytics/analytics-contract.test.mjs`** — "prediction result view closes the return-visit funnel..."(L107-113): `trackEvent('prediction_result_viewed'`, `week_key: week.weekKey`, `participated,`, `total_entries: ranking.length` 4개 리터럴을 검사한다. **판정 헤드라인 신설로 이 `useEffect` 블록(L59-68) 자체는 옮기지 않는다** — 위치만 유지하고 그대로 둔다.

`frontend/src/lib/predictions/result.test.mjs`(7개)는 `result.ts` 자체 테스트라 무관 — 회귀 확인용으로만 `npm test` 안에서 같이 돈다.

**Storybook**(CLAUDE.md 필수 검증 대상 아님, 문서 drift 방지 체크리스트 대상): `WeekRankCard.stories.tsx`는 `capped` prop 전제 스토리(`argTypes.capped` L72-77, `Mobile`/`MobileExpanded`가 non-capped 분기 L91-108)를 갖고 있다 — `capped` prop 제거 시 다크 배경 데코레이터 추가와 함께 전면 재작성 필요(plan 4단계).

---

## 14. 스코프 밖으로 명시 확인

- `frontend/src/lib/predictions/result.ts`: 로직 변경 없음(재확인)
- `frontend/src/lib/predictions/candidates.ts`, `frontend/src/lib/queries/squads.ts`, `frontend/src/components/primitives/accordion.tsx`: 변경 없음(재확인)
- `season_leaderboard` 뷰, `getSeasonRanking()` 함수, `predictions/page.tsx`/`PredictListClient.tsx`/`RankingCard.tsx`(목록 화면): 변경 없음(10번)
- 쿼리/액션/RLS/마이그레이션: 변경 없음
- 이슈 2(TOP3 데이터 연결): 이번 이슈는 UI 껍데기만
- 새 외부 라이브러리: 없음(Radix accordion은 기존 의존성)
