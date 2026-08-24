# 1-A. 컴포넌트 tier 표 + 목표 폴더 구조 제안

> 원본 계획: `vault/10_gun/디자인시스템-컴포넌트-정리-계획.md:37~46`
> 조사 대상: `frontend/src/components/**`의 `*.tsx`/`*.ts` 53개(테스트·스토리 제외). READ-ONLY 조사·제안. 실제 이동은 Wave D(승인 후).
> 모든 판정에 근거를 `파일:줄`로 병기. import 관계는 각 파일의 `import ... from` 줄, 사용처(importer)는 `frontend/src` 전체 grep 결과.

---

## 0. 분류 방법론 — "leaf ≠ Tier 1" (초안 대비 핵심 정정)

계획서 39줄의 Tier 1 정의는 두 조건의 **AND**다: ①"다른 로컬 컴포넌트를 import 안 함"(=import 그래프상 leaf) **그리고** ②"재사용 최소단위".

실제 코드를 훑어보면 **①만 만족하고 ②는 아닌 leaf가 많다.** import 그래프상 leaf(로컬 컴포넌트를 하나도 import 안 하는 파일)는 아래 19개다:

- 진짜 원자: `ui/avatar` `ui/badge` `ui/button` `ui/card` `ui/radio` `ui/result-progress` `ui/separator` `ui/sheet` (8개)
- leaf지만 도메인 feature/화면 성격: `layout/DesktopNavLinks` `layout/BottomNav` `predict/RankingCard` `predict/WeekRankCard` `predict/steps` `images/CroppedImageInput` `analytics/AppAnalytics` `auth/AuthCodeHandler` `players/PlayerRatingChangesAnalytics`
- leaf이면서 범용 레이아웃 셸: `layout/StickyActionBar` `layout/PageContainer` `layout/NavigationLoading`

즉 **"import 안 함"만으로 Tier 1을 판정하면 `RankingCard`(111줄 도메인 카드)나 `AppAnalytics`(렌더 없는 부수효과)까지 원자로 잘못 묶인다.** 이들은 아톰을 import하지 않을 뿐, 마크업을 직접 짜서 만든 도메인 컴포넌트다(예: `predict/RankingCard.tsx:1~111`은 아톰 import 없이 자체 마크업). 그래서 아래 표는 **①(leaf 여부)와 사용처 수를 사실로 기록**하되, **tier는 "범용 최소단위냐 / 재사용 조합체냐 / 화면 조립체냐"라는 성격 축으로 판정**한다. leaf인데 Tier 1이 아닌 경우는 근거에 명시했다.

또 하나 축: **2-a vs 2-b 구분은 사용처 "개수"가 아니라 "성격"으로 한다.** 자기완결적 재사용 UI 단위면 사용처가 현재 1곳이어도 2-a, app 라우트 1곳만 조립하는 페이지 오케스트레이터면 2-b. (사용처 개수는 참고로 표에 병기.)

---

## 1. 컴포넌트 tier 표 (53개 전수)

`import(local)` = 그 파일이 import하는 **로컬 컴포넌트**(atom/컴포넌트). `importers` = `frontend/src`에서 이 컴포넌트를 import하는 파일 수(스토리 제외).

### Tier 1 — 원자/범용 최소단위 (12개)

| 컴포넌트 | 파일 | import(local) | importers | 판정 근거 |
|---|---|---|---|---|
| Button | `ui/button.tsx` | 없음(leaf) | — | 순수 primitive. `design-foundation.test.mjs:16`이 원자로 검사 |
| Badge | `ui/badge.tsx` | 없음(leaf) | — | 순수 primitive. `design-foundation.test.mjs:17` |
| Avatar | `ui/avatar.tsx` | 없음(leaf) | — | 순수 primitive(Radix 래핑) |
| Card | `ui/card.tsx` | 없음(leaf) | — | 순수 primitive. `design-foundation.test.mjs:15` |
| Radio | `ui/radio.tsx` | 없음(leaf) | — | 순수 primitive. `DESIGN-SYSTEM.md:122` |
| ResultProgress | `ui/result-progress.tsx` | 없음(leaf) | — | 순수 primitive. `DESIGN-SYSTEM.md:72` |
| Separator | `ui/separator.tsx` | 없음(leaf) | — | 순수 primitive(Radix). `DESIGN-SYSTEM.md:115` |
| Sheet | `ui/sheet.tsx` | 없음(leaf) | — | shadcn vendored primitive. `design-foundation.test.mjs:18` |
| BottomSheet | `ui/bottom-sheet.tsx` | `ui/sheet` (`bottom-sheet.tsx:4`) | 2 (`ConfirmModal`,`LoginModal`) | **Tier 1 원자를 하나만 감싼 shell.** 계획서 39줄 "sheet만 감쌈"과 일치. 단일 shell 원칙의 기준(1-D) |
| **StickyActionBar** | `layout/StickyActionBar.tsx` | **없음(leaf, `cn`만)** | 4 (`TypeA/B`,`OverallRating`,`PredictionFlowClient`) | **[초안 정정] 계획서 40줄은 2-a로 뒀으나, `StickyActionBar.tsx:22~34`는 아톰 조합이 아니라 `children`을 감싸는 순수 레이아웃 래퍼다. 조합체가 아니므로 Tier 1(레이아웃 primitive)이 맞다.** 위치만 `layout/` |
| PageContainer | `layout/PageContainer.tsx` | 없음(leaf) | 1 (`app/layout.tsx`) | 앱 최상위 셸(폭 통과+온보딩 분기). 범용 레이아웃 primitive. `DESIGN-SYSTEM.md:116` |
| NavigationLoading(+`useLoadingRouter`) | `layout/NavigationLoading.tsx` | 없음(leaf) | 1(렌더) + hook은 6곳 | 로딩 primitive(`DESIGN-SYSTEM.md:99`) + `useLoadingRouter` 훅 제공(`RequireAuthModal.tsx:3` 등). 렌더 UI는 primitive라 Tier 1. ※1-C에서 레거시 토큰 잔존 파일로 별도 지적 |

### Tier 2-a — 재사용 조합체 / 자기완결 단위 (22개)

| 컴포넌트 | 파일 | import(local) | importers | 판정 근거 |
|---|---|---|---|---|
| PollCard | `polls/PollCard.tsx` | Badge (`PollCard.tsx:10`) | 2 (`PollHomeSection`,`PollListClient`) | 아톰 조합 + 2화면 재사용. 계획서 40줄 일치 |
| PollHeroCard | `polls/PollHeroCard.tsx` | PollCard 헬퍼함수 (`PollHeroCard.tsx:8`) | 1 (`HomeClient`) | 재사용형 히어로 배너 카드. `DESIGN-SYSTEM.md:76` |
| PollHomeSection | `polls/PollHomeSection.tsx` | PollCard (`PollHomeSection.tsx:6`) | 1 (`HomeClient`) | 홈 섹션 조합체. `DESIGN-SYSTEM.md:77` |
| CommentsSection | `polls/CommentsSection.tsx` | Button,Avatar (`CommentsSection.tsx:10~11`) | 1 (`ResultView`) | 자기완결 댓글 기능 조합체. 계획서 40줄 일치(단 현재 사용처 1곳) |
| ConfirmModal | `polls/ConfirmModal.tsx` | BottomSheet,Button,RadioIndicator (`ConfirmModal.tsx:8~10`) | 3 (`TypeA/B`,`OverallRating`) | shell+아톰 조합, 3화면 재사용. 계획서 40줄 일치 |
| LoginModal | `polls/LoginModal.tsx` | BottomSheet,Button (`LoginModal.tsx:14~15`) | 7 | shell+content 레퍼런스(1-D). 계획서 40줄 일치 |
| PollPageHeader | `polls/PollPageHeader.tsx` | AppHeader (`PollPageHeader.tsx:1`) | **7** | **[정정] `DESIGN-SYSTEM.md:145`는 "화면 단위 클라이언트"로 묶었지만, 실제로는 AppHeader `mobileBack`을 감싼 7줄 어댑터가 7곳에서 재사용됨. 성격상 재사용 조합체(2-a)** |
| RequireAuthModal | `auth/RequireAuthModal.tsx` | LoginModal,useLoadingRouter (`RequireAuthModal.tsx:3~4`) | 6 | LoginModal을 감싼 인증 게이트 컨테이너, 6곳 재사용. `DESIGN-SYSTEM.md:93` |
| AppHeader | `layout/AppHeader.tsx` | HeaderAuthStatus,DesktopNavLinks (`AppHeader.tsx:7~8`) | 11 | 최다 재사용 조합체. 계획서 40줄 일치 |
| HeaderAuthStatus | `layout/HeaderAuthStatus.tsx` | LoginButton,UserMenu (`HeaderAuthStatus.tsx:5~6`) | 1 (`AppHeader`) | 로그인/아웃 갈아끼우는 컨테이너 조합체. `DESIGN-SYSTEM.md:147` |
| LoginButton | `layout/LoginButton.tsx` | Button,LoginModal (`LoginButton.tsx:4~5`) | 1 (`HeaderAuthStatus`) | 헤더 전용 파생 조합체. 계획서 40줄 일치(사용처 1곳) |
| UserMenu | `layout/UserMenu.tsx` | Avatar (`UserMenu.tsx:6`) | 1 (`HeaderAuthStatus`) | 아바타+드롭다운 조합체. 계획서 40줄 일치(사용처 1곳) |
| DesktopNavLinks | `layout/DesktopNavLinks.tsx` | 없음(leaf) | 1 (`AppHeader`) | leaf지만 헤더 GNB 하위 표현 컴포넌트. `DESIGN-SYSTEM.md:107` |
| BottomNav | `layout/BottomNav.tsx` | 없음(leaf) | 1 (`app/layout.tsx`) | leaf지만 자기완결 feature 내비. 계획서 40줄 일치(마운트 1곳) |
| MatchdayHero | `predict/MatchdayHero.tsx` | Button,Badge (`MatchdayHero.tsx:5~6`) | 2 (`HomeClient`, dev preview) | 아톰 조합 재사용 카드. 계획서 40줄 일치 |
| MatchWeekList | `predict/MatchWeekList.tsx` | TeamBadge,badgeVariants (`MatchWeekList.tsx:4~6`) | 1 (`PredictListClient`) | 도메인 재사용 리스트. `DESIGN-SYSTEM.md:80` |
| RankingCard | `predict/RankingCard.tsx` | 없음(leaf) | 1 (`PredictListClient`) | leaf지만 top3/mine 2 variant를 가진 재사용 Contents 카드. `DESIGN-SYSTEM.md:79` |
| WeekRankCard | `predict/WeekRankCard.tsx` | 없음(leaf) | 1 (`PredictionResult`) | leaf지만 3컬럼 랭킹 카드(139줄). `DESIGN-SYSTEM.md:81` |
| PlayerPickModal | `predict/PlayerPickModal.tsx` | PlayerPhoto,badgeVariants (`PlayerPickModal.tsx:4~6`) | 1 (`PredictionFlowClient`) | 선수 선택 모달 조합체. ※1-D의 shell 우회 대상 |
| shared(TeamBadge/PlayerPhoto/ShareButton) | `predict/shared.tsx` | Avatar,Button (`shared.tsx:4~5`) | TeamBadge 4·PlayerPhoto 4·ShareButton 2 | predict 도메인 재사용 primitive 묶음. `DESIGN-SYSTEM.md:62,82,83` |
| steps(StepTrack/StepHero/StepTrackVertical) | `predict/steps.tsx` | 없음(leaf) | 1 (`PredictionFlowClient`) | leaf지만 3종 진행 트랙 재사용 nav. `DESIGN-SYSTEM.md:109` |
| CroppedImageInput | `images/CroppedImageInput.tsx` | 없음(leaf) | 1 (`UserPollCreateForm`) | leaf지만 crop+webp 자기완결 입력 컴포넌트. `DESIGN-SYSTEM.md:126` |

### Tier 2-b — 일회성/화면 조립체 (16개)

`DESIGN-SYSTEM.md:145`의 "화면 단위 클라이언트" 목록과 대조 — 아래 표의 근거 열에 대조 결과 병기.

| 컴포넌트 | 파일 | importers | 판정 근거 (DESIGN-SYSTEM.md:145 대조) |
|---|---|---|---|
| HomeClient | `polls/HomeClient.tsx` | 1 (`app/page.tsx`) | 목록 포함 ✅. 라우트 1곳 조립 |
| PollListClient | `polls/PollListClient.tsx` | 1 (`app/polls/page.tsx`) | 목록 포함 ✅ |
| TypeAPollClient | `polls/TypeAPollClient.tsx` | 1 (`app/polls/[id]/page.tsx`) | 목록 포함 ✅. 계획서 41줄 일치 |
| TypeBPollClient | `polls/TypeBPollClient.tsx` | 1 (`app/polls/[id]/page.tsx`) | 목록 포함 ✅. 계획서 41줄 일치 |
| OverallRatingPollClient | `polls/OverallRatingPollClient.tsx` | 1 (`app/polls/[id]/page.tsx`) | 목록 포함 ✅. 계획서 41줄 일치 |
| ResultView | `polls/ResultView.tsx` | 1 (`app/polls/[id]/page.tsx`) | 목록 포함 ✅ |
| OverallRatingResultView | `polls/OverallRatingResultView.tsx` | 1 (`app/polls/[id]/page.tsx`) | 목록 포함 ✅ |
| UserPollCreateForm | `polls/UserPollCreateForm.tsx` | 1 (`app/polls/create/page.tsx`) | 목록 포함 ✅ |
| PredictListClient | `predict/PredictListClient.tsx` | 1 (`app/predictions/page.tsx`) | 목록 포함 ✅ |
| PredictionFlowClient | `predict/PredictionFlowClient.tsx` | 1 (`app/predictions/[weekKey]/page.tsx`) | 목록 포함 ✅. 계획서 41줄 일치 |
| PredictionResult | `predict/PredictionResult.tsx` | 1 (`app/predictions/[weekKey]/page.tsx`) | 목록 포함 ✅ |
| PredictionDone | `predict/PredictionDone.tsx` | 1 (**`PredictionFlowClient`**, 라우트 아님) | 목록 포함 ✅. 단 importer가 라우트가 아니라 flow 내부에 조립되는 화면 상태 뷰 |
| MyPageClient | `my/MyPageClient.tsx` | 1 (`app/my/page.tsx`) | 목록 포함 ✅ |
| MyFeedbackForm | `my/MyFeedbackForm.tsx` | 1 (`app/my/feedback/page.tsx`) | 목록 포함 ✅ |
| PlayersPageClient | `players/PlayersPageClient.tsx` | 1 (`app/players/page.tsx`) | 목록 포함 ✅ |
| AdminRatingsForm | `admin/AdminRatingsForm.tsx` | 1 (`app/admin/ratings/page.tsx`) | **[보강] DESIGN-SYSTEM.md:145 목록엔 없으나** 성격 동일(admin 1페이지 전용 폼). ※1-C 레거시 토큰 대상(`design-foundation.test.mjs:382`) |

### tier 축 밖 — 비-UI / 부수효과 컴포넌트 (3개)

`DESIGN-SYSTEM.md:147` "렌더 결과가 없는 컴포넌트"와 대조.

| 컴포넌트 | 파일 | importers | 근거 |
|---|---|---|---|
| AppAnalytics | `analytics/AppAnalytics.tsx` | 1 (`app/layout.tsx`) | 렌더 없는 부수효과. `DESIGN-SYSTEM.md:147` ✅ |
| AuthCodeHandler | `auth/AuthCodeHandler.tsx` | 1 (`app/layout.tsx`) | 렌더 없는 부수효과. `DESIGN-SYSTEM.md:147` ✅ |
| PlayerRatingChangesAnalytics | `players/PlayerRatingChangesAnalytics.tsx` | 1 (`app/players/changes/page.tsx`) | 분석용. `DESIGN-SYSTEM.md:147` ✅ |

**합계 검증:** Tier 1 12 + Tier 2-a 22 + Tier 2-b 16 + 비-UI 3 = **53** (조사 대상 전수 일치).

### 초안(계획서 39~41줄) 대비 정정 요약
- **`StickyActionBar`: 계획서 40줄 2-a → Tier 1로 정정.** 아톰 조합이 아닌 순수 `children` 래퍼(`StickyActionBar.tsx:22~34`)라 "조합체" 정의에 안 맞고 "최소단위" 정의에 맞음.
- **`PollPageHeader`: `DESIGN-SYSTEM.md:145`의 화면 클라이언트 분류 → 2-a로 재판정.** 7곳 재사용되는 7줄 어댑터.
- **`AdminRatingsForm`: 어느 목록에도 없던 항목을 2-b로 편입.** admin 1페이지 전용.
- 계획서 40줄이 2-a로 든 항목 중 `RankingCard`·`WeekRankCard`·`BottomNav`·`MatchWeekList`·`PlayerPickModal`·`LoginButton`·`UserMenu`·`CommentsSection`은 **현재 사용처가 1곳**임을 표에 명시(재사용 "설계"는 맞으나 "현재 다중 사용"은 아님 — 사용자 오해 방지).

---

## 2. 목표 폴더 구조 2안

### 공통 사실 — import·경로가 걸린 지점 (근거)
- 모든 컴포넌트 import는 `@/components/...` alias 또는 상대경로. 파일을 옮기면 **그 파일을 import하는 모든 곳의 경로 문자열**을 함께 바꿔야 함.
- app/기타에서 `@/components`를 import하는 파일: **46개** (`frontend/src` grep).
- `*.stories.tsx`: **37개**, 그중 feature 디렉토리(ui 외)를 import: **24개**.
- 소스 경로를 **문자열로 하드코딩**한 테스트: **9개**. 특히 `components/design-foundation.test.mjs`는 `components/....tsx` 경로 문자열이 **41개**(예: `:15~18`, `:97~101`, `:171~177`, `:196~206`, `:216~235`) — 이 테스트는 파일을 경로로 읽어 소스 문자열을 정규식 검사하므로 **경로가 바뀌면 전부 red**. (그 외: `analytics-contract.test.mjs` 9개, `poll-list-client.test.mjs` 3개, `prefetch-policy.test.mjs` 2개, 나머지 각 1개.)

### 안 A — tier 디렉토리 (`ui/primitives/` + `ui/patterns/` + `features/<도메인>/`)
계획서 44줄. Tier 1 → `ui/primitives/`, 도메인 무관 2-a → `ui/patterns/`, 도메인 종속 2-a·2-b → `features/<도메인>/`.

- **분류 실무 난점:** 도메인 무관 2-a와 도메인 종속 2-a의 경계가 애매하다. 예로 `AppHeader`·`BottomNav`·`LoginModal`·`ConfirmModal`은 앱 범용이지만 `PollCard`·`MatchdayHero`·`predict/shared`는 도메인 종속 → 22개 2-a를 사람이 하나씩 갈라야 함(자동 판정 불가).
- **import 파급:** 사실상 **53개 거의 전부가 이동**하므로, 위 "공통 사실"의 46개 app import + 24개 스토리 + 컴포넌트 간 상호 import 전부의 경로 치환 필요. alias라 이동 파일 1개당 "그 파일을 가리키는 모든 줄"을 수정.
- **테스트 재작성량:** **큼.** `design-foundation.test.mjs`의 41개 경로 문자열(특히 `:97~101`,`:171~177`,`:196~206`,`:216~235` 배열)을 새 경로로 전부 갱신. CLAUDE.md 경고("테스트를 지우지 말고 옮겨간 자리로 단정문을 다시 쓴다")·계획서 98줄과 동일 부담. 나머지 8개 테스트 파일의 경로 문자열도 함께.
- **리스크:** 높음. 계획서 95줄이 이 웨이브(Wave D)를 "리스크 최고, 마지막"으로 둔 이유와 일치.
- **이득:** tier가 폴더로 물리적으로 드러남. 신규 컴포넌트를 놓을 자리가 tier 축으로 자명해짐.

### 안 B — 현 구조 유지 + 라벨링 (`DESIGN-SYSTEM.md`에 `tier` 열 추가)
계획서 45줄. 파일 무이동, import 무변경. `DESIGN-SYSTEM.md`의 각 컴포넌트 행에 `tier` 열만 추가.

- **import 파급:** **0.** 파일이 안 움직이므로 46개 app import·24개 스토리·컴포넌트 상호 import 전부 무변경.
- **테스트 재작성량:** **0.** 9개 테스트의 경로 문자열 모두 유효 유지. `design-foundation.test.mjs` red 없음.
- **리스크:** 0 (계획서 45줄 "리스크 0, import 무변경").
- **이득:** tier 정보를 문서 축으로 얻음. 단 폴더는 여전히 Montage 기능 분류(`DESIGN-SYSTEM.md:49`) — 물리적 tier 폴더는 없음.
- **정합성:** 계획서 96줄 "안 B(라벨링만)면 Wave A에 흡수되어 이 웨이브 불필요"와 `DESIGN-SYSTEM.md:5~10`(인덱스는 이름·한 줄·경로만) 규칙에 맞게 열 1개 추가로 수렴.

---

## 3. 결론 — 권장 안 (최종 결정은 사용자 몫)

**권장: 안 B (라벨링).** 근거:
1. 계획서 12줄이 이 작업을 "밑바닥 재구축이 아니라 정리·감사·수렴"으로 규정. tier의 목적(어떤 게 원자/조합/화면인지 식별)은 문서 열 하나로 달성되며, 파일 이동은 그 목적을 넘어서는 비용이다.
2. 안 A의 유일한 추가 이득(tier의 물리적 표현)에 비해 비용이 과함 — 53개 이동 + `design-foundation.test.mjs` 41개 경로 문자열 재작성(`:97~235`) + 24개 스토리 + 46개 app import. 계획서 95줄이 폴더 재구성을 "리스크 최고, 최후미"로 둔 판단과 일치.
3. 현 Montage 기능 분류(`DESIGN-SYSTEM.md:49`)가 이미 발견성을 제공하므로, tier 축은 "폴더"보다 "라벨"로 얹는 게 두 축(기능×tier)을 모두 살린다.

**단, 사용자가 tier의 물리적 표현을 원하면** 전면 안 A 대신 **부분 하이브리드**를 권함: `ui/`(Tier 1) 유지 + 도메인 무관 2-a 소수(`AppHeader`·`BottomNav`·`LoginModal`·`ConfirmModal`·`CommentsSection` 등)만 `ui/patterns/`로 승격, 도메인 2-a·2-b는 현 feature 폴더 유지. 이동 파일 수와 테스트 경로 재작성 범위를 크게 줄인다. (이 경우도 실제 이동은 승인 후 Wave D.)

DONE: vault/10_gun/audit/1-A-tier-and-folders.md
