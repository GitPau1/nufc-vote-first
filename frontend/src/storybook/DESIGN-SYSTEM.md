# NUFC Vote 디자인시스템 인덱스

이 파일은 **라우팅 인덱스**다. 어떤 규칙이 어느 파일에 있는지만 알려준다.

## 이 파일을 쓰는 규칙

- **여기에 사용 규칙을 쓰지 않는다.** 규칙의 원본은 각 MDX 파일이다. 복사본은 원본보다 먼저 낡는다.
- 이 표에는 **이름 · 한 줄 설명 · 원본 경로**만 둔다.
- MDX 파일을 추가·삭제·이동하면 **같은 커밋에서 이 표를 갱신한다.**
- 표에 있는 경로가 실재하지 않으면 그 자체가 결함이다 — 없는 문서를 있다고 안내하지 않는다.

## 읽는 순서

1. 이 인덱스에서 해당 항목의 원본 경로를 찾는다.
2. 그 MDX를 열어 실제 규칙을 읽는다.
3. 표에 항목이 없으면 **"아직 문서화되지 않았다"**고 판단한다. 기억이나 추측으로 규칙을 만들지 않는다.

토큰의 실제 값은 MDX가 아니라 코드에 있다 — `frontend/tailwind.config.ts`, `frontend/src/app/globals.css`.

---

## Foundations

| 항목 | 다루는 내용 | 원본 |
|---|---|---|
| Palette | 원시 색 7계열 × 11단계 전체 색상표(화면에 직접 안 씀) | `foundations/Palette.mdx` |
| Semantic | bg/text/border 역할 색 토큰 전체 목록(사용법은 Color 참고) | `foundations/Semantic.mdx` |
| Color | 브랜드·중립·표면·상태 색상과 선택 기준 | `foundations/Color.mdx` |
| Typography | 역할 기반 타입 스케일 18종과 고르는 순서 | `foundations/Typography.mdx` |
| Layout | 화면 기준폭, 컨테이너 폭 3종, 페이지 마진, 간격 스케일, 모바일 그리드 | `foundations/Layout.mdx` |
| Radius | 5단계 radius와 컴포넌트별 적용 기준, 중첩 규칙 | `foundations/Radius.mdx` |
| Elevation | 배경(on-white / on-gray)별 shadow 그룹 | `foundations/Elevation.mdx` |
| State | 상호작용/옵션 상태 구분, opacity 스케일 4값, 상태 조합 규칙 | `foundations/State.mdx` |
| Motion | duration 토큰 4종, enter>exit 규칙, easing 현황 | `foundations/Motion.mdx` |
| Icons | `lucide-react` 아이콘 크기 3단계, 색 상속 규칙, 아이콘 전용 버튼 접근성 | `foundations/Icons.mdx` |
| Gradient | 실사용 3곳(헤더 페이드/아바타 대체/텍스트 가독성 오버레이)과 그 근거 + 준비된 유틸리티 1개(`spotlight-glow-brand`) | `foundations/Gradient.mdx` |
| Design Token | 토큰 3세대(레거시 flat/shadcn HSL/Palette→Semantic) 공존 현황과 이름 겹침 함정 | `foundations/DesignToken.mdx` |

---

## Components

**폴더 구조(`primitives` / `composition/<도메인>`)를 따른다** — 스토리북 사이드바도 같은 구조다.

대부분은 `import`해서 쓰는 컴포넌트다. 이름 뒤 **`(pattern)`** 은 독립 컴포넌트가 아니라 **재사용 패턴 또는 CSS 유틸**(꺼내 쓸 파일이 없고, `코드` 열이 CSS 위치·"사용처 N곳"·화면 파일을 가리킴)이라는 뜻이다. 페이지 1곳만 조립하는 화면 단위 클라이언트는 컴포넌트가 아니라 아래 "인덱스에 넣지 않은 코드 > 화면 단위 클라이언트"에 있다.

### Primitives

도메인·화면과 무관한 재사용 최소단위.

| 이름 | 한 줄 | 코드 | 원본 |
|---|---|---|---|
| Button | 1차 CTA·보조 액션. `default`/`destructive`/`secondary`/`outline`/`ghost`/`link` 6개 variant | `components/primitives/button.tsx` | `actions/Button.mdx` |
| Badge | 라벨·상태 배지. 4개 variant(이름과 실제 색이 하나 어긋남 — MDX 참고) | `components/primitives/badge.tsx` | `contents/Badge.mdx` |
| Avatar | 사용자·선수 원형 이미지 | `components/primitives/avatar.tsx` | `contents/Avatar.mdx` |
| Card | 정보 덩어리를 배경에서 띄우는 컨테이너. 실사용은 `Card`+`CardContent` 두 겹뿐(Header/Title/Description/Footer 사용처 0곳) | `components/primitives/card.tsx` | `contents/Card.mdx` |
| ResultProgress | 투표 결과 한 줄(사진+이름+득표율 막대+퍼센트) | `components/primitives/result-progress.tsx` | `contents/ResultProgress.mdx` |
| Radio | 투표 옵션 선택. `RadioIndicator`(시각) + `RadioOption`(전체 행 클릭) | `components/primitives/radio.tsx` | `selection-and-input/Radio.mdx` |
| Separator | 단독으로 놓는 구분선(Radix 기반) | `components/primitives/separator.tsx` | `presentation/Separator.mdx` |
| PageContainer | 앱 최상위 셸. 폭을 제한하지 않고 통과시키며, 온보딩만 480px 카드 셸로 분기 | `components/primitives/page-container.tsx` | `presentation/PageContainer.mdx` |
| StickyActionBar | 투표 상세 하단 제출 버튼 바. 모바일은 fixed, 데스크탑은 흐름 안 static | `components/primitives/sticky-action-bar.tsx` | `actions/StickyActionBar.mdx` |
| Skeleton | 로딩 플레이스홀더. 경로별 화면 스켈레톤 4종 + 그 외 경로용 상단 진행 바 | `components/primitives/navigation-loading.tsx`, `.animate-skeleton` | `loading/Skeleton.mdx` |
| ListGroup (pattern) | `divide-y divide-neutral-weak` 패턴. 행 내용은 사용처마다 다름 | 사용처 4곳 | `contents/ListGroup.mdx` |
| TextInput (pattern) | 텍스트 입력. CSS 유틸리티 클래스로 관리 | `.input-field` (globals.css) | `selection-and-input/TextInput.mdx` |

#### Primitives / Modal

모달·바텀시트의 껍데기(shell)는 하나로 통일하고, 내부 내용만 사용처별로 끼운다.

| 이름 | 한 줄 | 코드 | 원본 |
|---|---|---|---|
| BottomSheet | 모달·바텀시트 공용 껍데기. `form`으로 default(중앙)/sheet(바텀)/responsive 전환. 드래그 핸들 + 자유 본문 + 액션 버튼 | `components/primitives/modal/Modal.tsx`, `components/primitives/modal/sheet.tsx` | `feedback/BottomSheet.mdx` |
| ConfirmModal | 투표 제출 직전 선택 확인 — 제출 후 수정 불가라서 되돌릴 수 없는 행동을 한 번 확인받는다 | `components/primitives/modal/contents/Confirm.tsx` | `feedback/ConfirmModal.mdx` |
| LoginModal | 비로그인 사용자의 로그인 유도 모달(`/login` 페이지 없이 이 모달이 유일한 로그인 경로) | `components/primitives/modal/contents/Login.tsx`, `components/composition/auth/RequireAuthModal.tsx` | `feedback/LoginModal.mdx` |
| PlayerPickModal | 승부예측 포지션별 선수 선택(모바일 바텀시트 / 데스크탑 중앙 모달) | `components/primitives/modal/contents/PlayerPick.tsx` | `selection-and-input/PlayerPickModal.mdx` |
| PollPickerModal | 투표 생성 폼의 선수 선택 시트 — 검색·소속 필터·포지션 그룹, single/multiple 모드 | `components/primitives/modal/contents/PollPicker.tsx` | `selection-and-input/PollPickerModal.mdx` |

### Composition / Common

도메인에 묶이지 않는 앱 공통 조합체.

| 이름 | 한 줄 | 코드 | 원본 |
|---|---|---|---|
| AppHeader | 서비스 공통 상단 헤더. 데스크탑은 화면 무관 동일 GNB, 모바일은 최상위/서브 화면 갈림 | `components/composition/common/AppHeader.tsx` | `navigations/AppHeader.mdx` |
| BottomNav | 모바일 하단 내비게이션(4개 경로에서만 렌더) | `components/composition/common/BottomNav.tsx` | `navigations/BottomNav.mdx` |
| DesktopNavLinks | 데스크탑(≥640px) 헤더 GNB 3항목. `usePathname()`으로 활성 항목 판정 | `components/composition/common/DesktopNavLinks.tsx` | `navigations/DesktopNavLinks.mdx` |
| UserMenu | 로그인 상태 헤더 우측 아바타 + 드롭다운(마이페이지·피드백·로그아웃, 관리자면 1개 추가) | `components/composition/common/UserMenu.tsx` | `navigations/UserMenu.mdx` |
| LoginButton | 로그아웃 상태 헤더 우측 "로그인" 버튼. Button `outline`+`sm`에 4개 클래스를 덮어쓴 헤더 전용 파생형 | `components/composition/common/LoginButton.tsx` | `actions/LoginButton.mdx` |
| ImageInput | 브라우저에서 크롭·webp 변환해 제출하는 이미지 입력(`CroppedImageInput`) | `components/composition/common/CroppedImageInput.tsx` | `selection-and-input/ImageInput.mdx` |

### Composition / Polls

| 이름 | 한 줄 | 코드 | 원본 |
|---|---|---|---|
| PollCard | 투표 목록 한 줄(썸네일·상태·제목·참여자 수) | `components/composition/polls/PollCard.tsx` | `contents/PollCard.mdx` |
| PollHeroCard | 홈 히어로 자리의 252px 고정높이 투표 배너. MatchdayHero가 없을 때의 폴백 | `components/composition/polls/PollHeroCard.tsx` | `contents/PollHeroCard.mdx` |
| PollHomeSection | 홈의 투표 섹션 하나(제목+링크+목록). 모바일 세로 리스트 / 데스크탑 한 줄 그리드+페이지 넘김 | `components/composition/polls/PollHomeSection.tsx` | `contents/PollHomeSection.mdx` |
| CommentsSection | 투표 결과 화면의 댓글 입력창+목록(투표 항목 칩·좋아요·내 댓글 수정/삭제) | `components/composition/polls/CommentsSection.tsx` | `contents/CommentsSection.mdx` |
| PollCarouselCard (pattern) | 투표 상세 캐러셀. 가운데 카드 확대 + 좌우 스와이프 | `components/composition/polls/TypeBPollClient.tsx` | `contents/PollCarouselCard.mdx` |
| RatingMatrix (pattern) | 전체 평가 투표의 F~S 6단계 점수 선택 그리드 | `components/composition/polls/OverallRatingPollClient.tsx` | `selection-and-input/RatingMatrix.mdx` |
| FormSection (pattern) | 투표 생성 폼의 섹션 셸 + 선수 선택 picker | `components/composition/polls/UserPollCreateForm.tsx` | `selection-and-input/FormSection.mdx` |

### Composition / Predict

| 이름 | 한 줄 | 코드 | 원본 |
|---|---|---|---|
| MatchdayHero | 홈 히어로의 다음/직전 경기 카드(예정·진행중·종료 + 포지션별 평점 카드) | `components/composition/predict/MatchdayHero.tsx` | `contents/MatchdayHero.mdx` |
| MatchWeekList | 승부예측 월별 주차 목록. 주차 1개 = 예측 세션 1개(진행중/결과/예정) | `components/composition/predict/MatchWeekList.tsx` | `contents/MatchWeekList.mdx` |
| RankingCard | 승부예측 시즌 누적 랭킹 카드. `top3`/`mine` 2개 variant | `components/composition/predict/RankingCard.tsx` | `contents/RankingCard.mdx` |
| WeekRankCard | 주차 랭킹 카드. 예측·선수픽·종합 3컬럼, 데스크탑 10명 캡 + 모바일 화면높이 크롭 | `components/composition/predict/WeekRankCard.tsx` | `contents/WeekRankCard.mdx` |
| TeamBadge | 승부예측 팀 엠블럼. `logoUrl` 없음·로드 실패 모두 팀명 첫 글자 원형으로 폴백 | `components/composition/predict/shared.tsx` | `contents/TeamBadge.mdx` |
| PlayerPhoto | 선수 사진 원형. Avatar(Radix) 기반이라 null·로드 실패 모두 실루엣 폴백 | `components/composition/predict/shared.tsx` | `contents/PlayerPhoto.mdx` |
| ShareButton | 예측 결과·완료 화면의 링크 복사 버튼. 이름과 달리 Web Share API가 아니라 현재 주소 클립보드 복사다 | `components/composition/predict/shared.tsx` | `actions/ShareButton.mdx` |
| StepTrack | 승부예측 3스텝(score→pick→confirm) 진행 표시. 가로 트랙·히어로 문구·세로 트랙 3종 | `components/composition/predict/steps.tsx` | `navigations/StepTrack.mdx` |

---

## 이 시스템에 없는 것

아래 패턴은 과거 스펙 문서에 정의되어 있었으나 **코드에 구현체가 없어 디자인시스템에서 제외했다.** 되살리려면 새로 설계한다 — 과거 스펙을 그대로 복원하지 않는다.

`post-feed` / `post-card` / `post-fab` / `post-composer-sheet` / `post-reaction-chip` (소식 탭 계열) · `transfer-item` · `farewell-card` · `season-stat-card` · `club-status-card` · `squad-list` · `section-label`

## 인덱스에 넣지 않은 코드

`src/components/**`에서 위 표에 없는 것은 아래 세 부류뿐이다. 새로 만든 컴포넌트가 이 부류에 속하지 않으면 인덱스에 행을 추가한다.

**1. 화면 단위 클라이언트** — 컴포넌트가 아니라 페이지 1곳만 조립하는 화면 조립체다. 이 안의 재사용 패턴은 이미 PollCarouselCard·RatingMatrix·FormSection·CommentsSection으로 추출돼 있다.

`composition/predict/PredictListClient.tsx` · `composition/predict/PredictionFlowClient.tsx` · `composition/predict/PredictionResult.tsx` · `composition/predict/PredictionDone.tsx` · `composition/common/HomeClient.tsx` · `composition/polls/PollListClient.tsx` · `composition/polls/TypeAPollClient.tsx` · `composition/polls/TypeBPollClient.tsx` · `composition/polls/OverallRatingPollClient.tsx` · `composition/polls/ResultView.tsx` · `composition/polls/OverallRatingResultView.tsx` · `composition/polls/UserPollCreateForm.tsx` · `composition/my/MyPageClient.tsx` · `composition/my/MyFeedbackForm.tsx` · `composition/players/PlayersPageClient.tsx` · `composition/admin/AdminRatingsForm.tsx`(관리자 평점 입력 — `admin/ratings` 1곳 조립) · `composition/polls/PollPageHeader.tsx`(AppHeader `mobileBack` 7줄 래퍼)

**2. 자체 UI가 없는 컴포넌트** — 로직만 수행하고 아무것도 그리지 않거나(`composition/common/AppAnalytics.tsx` · `composition/auth/AuthCodeHandler.tsx` · `composition/players/PlayerRatingChangesAnalytics.tsx`), 다른 컴포넌트를 갈아 끼우기만 한다(`composition/common/HeaderAuthStatus.tsx` — 판별 중엔 회색 원 플레이스홀더 하나를 그린다. 갈림 규칙은 `navigations/UserMenu.mdx`에 있다)

**3. import하는 곳이 없는 컴포넌트** — 현재 없다.

`deleteUserPoll`은 단순한 죽은 코드가 아니었다 — 호출 UI가 사라진 뒤에도 `'use server'` 모듈의 export로 남아, **화면 없이 외부에서 도달 가능한 삭제 엔드포인트**였다(service-role cascade). 서버 액션은 export되어 있는 것만으로 공개 엔드포인트이므로, 화면을 지울 때 액션도 함께 지운다.

사용처가 없는데도 **일부러 남겨둔 것 셋**: `primitives/modal/sheet.tsx`의 `SheetTrigger`/`SheetClose`(Radix Root/Portal과 짝을 이루는 얇은 재export — 여는 트리거·닫기 버튼을 시트 안에서 직접 조립할 때 쓴다) · `lib/players/pick-one-rating.ts`의 rating 함수들(Postgres 함수와 같은 알고리즘을 검증하는 참조 구현) · `types/database.ts`의 `*Row` 별칭 블록(스키마 전체를 비추는 것이 파일의 목적).

같은 목록에 있던 `SheetFooter`는 삭제했다. 얇은 재export가 아니라 **자체 레이아웃을 든 구현체**였고(`flex flex-col-reverse sm:flex-row …`), 그 `sm:` 정렬은 shell의 형태 전환 기준(md/768px)과도 어긋나 있었다 — 되살릴 일이 생기면 그때 실제 푸터 요구에 맞춰 새로 설계한다.

사용처 없는 구현체는 디자인시스템에 넣지 않고, 되살릴 때는 새로 설계한다.
