# 1-D. 모달/바텀시트 — 단일 shell 원칙 전수 점검

> 조사 범위: 리포 전체 `frontend/src/**`. READ-ONLY 감사. 모든 판단에 `file:줄` 근거 병기.
> 핵심 원칙(계획서 62줄): shell(위치·폭·반응형·오버레이·드래그핸들·포커스트랩·ESC)은 하나로 통일, content(본문)만 사용처별.

---

## 요약 (결론 먼저)

- **현행 shell = `components/ui/bottom-sheet.tsx`는 정식 단일 shell로 확정 가능하다.** 모바일=하단시트 / 데스크탑=중앙모달 반응형 전환을 코드에서 실제로 수행한다(`bottom-sheet.tsx:57`).
- 모달/시트 성격 표면은 총 **6개**. 이 중 shell 준수 3개(LoginModal·ConfirmModal·RequireAuthModal), **shell 우회 2개**(PlayerPickModal·UserPollCreateForm의 PlayerPickerSheet), 원칙 대상 밖 1개(UserMenu=팝오버).
- **PlayerPickModal의 격리 명분("ui/sheet는 항상 하단 고정이라 반응형 불가", `PlayerPickModal.tsx:41-43`)은 낡았다.** `bottom-sheet.tsx:57`이 바로 그 반응형 전환을 이미 한다 → **[shell로 통합 가능]**.
- 통합 시 재현 필요 항목 4가지 모두 이관 가능하나, **shell의 bottom variant에는 `max-h`/`overflow`가 없어**(`sheet.tsx:47-48`) 스크롤은 `className`으로 명시 주입해야 한다. 진입 모션·닫기 X버튼 노출에는 동작 차이가 발생한다(아래 §4).
- **부수 발견(문서 drift):** `feedback/BottomSheet.mdx`가 "실사용은 `bottom`뿐"이라고 적었으나 shell은 데스크탑에서 `center` variant를 실사용한다(`bottom-sheet.tsx:57`). 문서가 실제 코드와 어긋난다(§5).

---

## 1. 현행 shell 후보 정독 — `ui/bottom-sheet.tsx`

**반응형 전환을 실제로 하는가? → 한다.**

- `useIsDesktopViewport()` 훅이 `matchMedia('(min-width: 768px)')`로 데스크탑 여부를 판정(`bottom-sheet.tsx:16, 24-36`). SSR은 폭을 모르므로 모바일(바텀시트)을 기본값으로 두고 마운트 후 보정(`bottom-sheet.tsx:21-22, 25`).
- `const side = isDesktop ? 'center' : 'bottom'` — **폭에 따라 하단시트↔중앙모달을 실제로 오간다**(`bottom-sheet.tsx:57`).
- `side`를 `SheetContent`에 넘기고(`bottom-sheet.tsx:62`), 위치/폭은 `sheet.tsx`의 variant가 그대로 물려준다:
  - `bottom` variant: `bottom-0 w-full max-w-shell -translate-x-1/2 rounded-t-lg` + slide-in-from-bottom(`sheet.tsx:47-48`).
  - `center` variant: `top-1/2 w-[calc(100%-32px)] max-w-[448px] -translate-x/y-1/2 rounded-lg` + fade/zoom(`sheet.tsx:56-57`).
- 드래그 핸들은 모바일에서만(`showDragHandle={!isDesktop}`, `bottom-sheet.tsx:63` → `sheet.tsx:84-86`).
- 오버레이(`bg-overlay`, `sheet.tsx:22-24`), 우측상단 X 닫기(`sheet.tsx:88-91`)는 shell 골격으로 항상 딸려온다.
- **포커스 트랩·ESC 닫기**는 `sheet.tsx:4`가 `@radix-ui/react-dialog`(`SheetPrimitive`) 위에 세워져 있어 Radix Dialog가 기본 제공한다.

**판정: shell 골격(위치·폭·반응형·오버레이·드래그핸들·포커스트랩·ESC)을 모두 갖추었고, content는 `children`으로 완전히 위임(`bottom-sheet.tsx:11, 42-44, 66`)한다. → 정식 단일 shell로 확정 타당.** (설계 의도도 주석 `bottom-sheet.tsx:38-54`에 명문화됨.)

---

## 2. 모달/시트/다이얼로그 표면 전수 표

grep 대상: `Dialog|BottomSheet|Sheet|Modal|@radix-ui/react-dialog` (test/stories 제외).

| # | 표면 | 근거(file:줄) | shell 경유? | 판정 |
|---|------|--------------|-------------|------|
| 1 | **LoginModal** | `LoginModal.tsx:14`(`import { BottomSheet }`), `:79`(`<BottomSheet ...>`) | ✅ 통과 | 레퍼런스 준수 |
| 2 | **ConfirmModal** | `ConfirmModal.tsx:8`, `:35`(`<BottomSheet ...>`) | ✅ 통과 | 준수 |
| 3 | **RequireAuthModal** | `RequireAuthModal.tsx:4, 18-22`(`LoginModal`을 그대로 렌더) | ✅ 간접 통과 | 준수(래퍼) |
| 4 | **PlayerPickModal** | `PlayerPickModal.tsx:3`(`import * as DialogPrimitive from '@radix-ui/react-dialog'`), `:54-105`(Root/Portal/Overlay/Content 직접 조립) | ❌ **우회** | §3 [shell로 통합 가능] |
| 5 | **UserPollCreateForm → PlayerPickerSheet** | `UserPollCreateForm.tsx:12-17`(`ui/sheet`에서 `Sheet`/`SheetContent` 직접 import), `:448-449`(`<Sheet><SheetContent side="bottom">`) | ❌ **우회**(shell 래퍼 미경유) | §3 [조건부 통합 — 근거 일부 미확인] |
| 6 | **UserMenu 드롭다운** | `UserMenu.tsx:51`(`<div className="relative">`), `:67`(`absolute right-0 top-10 ... 드롭다운`) | — 팝오버성(오버레이·포커스트랩 없음, 앵커 상대 위치) | **원칙 대상 밖** |

### 우회로 오인하기 쉬운 pass-through(신규 shell 아님 — 참고)

아래는 위 컴포넌트를 소비만 하는 호출부라 새 shell을 만들지 않는다. 범위 오염 방지용으로 명시:

- `MenuActions.tsx:8,67`, `LoginButton.tsx:5,21`, `OverallRatingPollClient.tsx:15-16,259/269`, `TypeAPollClient.tsx:15-16,193/201`, `TypeBPollClient.tsx:14-15,317/324`, `PredictionFlowClient.tsx:8-9,346/363` — 모두 `LoginModal`/`ConfirmModal`/`PlayerPickModal`을 `import`해 props만 넘긴다.
- `admin/page.tsx`, `my/page.tsx`, `my/feedback/page.tsx`, `onboarding/page.tsx`, `polls/create/page.tsx` — `RequireAuthModal` 게이트만 렌더.
- `PageContainer.tsx:16`, `radio.tsx:7` — 주석에서 모달을 언급할 뿐, 시트/다이얼로그를 조립하지 않음.

**계획서가 놓친 신규 모달 표면: 없음.** 계획서 66-70줄이 지목한 6개 밖에서 별도 shell 조립 사례를 찾지 못했다(`@radix-ui/react-dialog` 직접 import는 `sheet.tsx`·`PlayerPickModal.tsx` 2곳뿐).

---

## 3. 우회 표면별 통합/예외 판정

### 4. PlayerPickModal — **[shell로 통합 가능]**

**격리 명분이 낡았는지 코드로 검증:**

- 명분 원문(`PlayerPickModal.tsx:41-43`): *"ui/sheet.tsx의 바텀시트는 항상 하단 고정이라 이 반응형 전환을 표현할 수 없어서 Radix Dialog를 직접 썼다."*
- **반증:** shell은 데스크탑에서 `side='center'`로 전환하며(`bottom-sheet.tsx:57`), 그 `center` variant는 `sheet.tsx:56-57`에 완전히 구현돼 있다. PlayerPickModal이 직접 짠 "모바일 하단 / sm+ 중앙"(`PlayerPickModal.tsx:64,72`)과 **동일한 반응형 전환을 shell이 이미 제공한다.**
- 추가로 명분 후단(`PlayerPickModal.tsx:43`): *"포커스 트랩·ESC 닫기는 프로토타입엔 없던 개선으로 따라온다"* — 이 역시 shell 경로(`sheet.tsx:4`, Radix Dialog)에서도 동일하게 따라오므로 격리 이유가 되지 못한다.

**결론: 격리 명분은 shell의 현재 반응형 지원과 정면으로 모순된다(낡음). content(선수 행 목록)만 남기고 shell을 `BottomSheet`로 교체 가능.** 단, §4의 3개 재현 포인트에서 `className` 명시 주입이 필요하다.

### 5. UserPollCreateForm → PlayerPickerSheet — **[조건부 통합 — 근거 일부 미확인]**

- 현행: `ui/sheet`의 `Sheet`/`SheetContent`를 직접 조립(`UserPollCreateForm.tsx:448-449`). `side="bottom"` **하드코딩**, 데스크탑 `center` 전환 없음. 전체높이 검색 피커: `h-[82vh] max-h-[82vh] flex flex-col overflow-hidden p-0`(`:451`), 상단 검색+필터바(`:459-484`), 중앙 스크롤 목록(`:485-524`), 하단 sticky "N명 선택 완료" 버튼(`:525-531`).
- **shell 문법이 맞는가? → 맞다.** overlay·drag-region·Radix Dialog 기반 시트로, 인라인 폼 섹션이 아니다. 따라서 원칙상 통합 대상.
- **통합 시 마찰점:**
  1. 현재 **데스크탑에서도 하단 고정**(`side="bottom"` 고정). shell을 그대로 태우면 데스크탑에서 `center` 중앙모달로 바뀐다 — 전체높이(82vh) 검색 피커에는 중앙모달이 적절한지 **의도 근거 미확인**(이 시트를 데스크탑에서 어떻게 띄울지 결정한 문서/주석을 찾지 못함).
  2. `p-0` + `flex-col` + sticky footer 레이아웃은 shell의 `p-5`(`sheet.tsx:34`) 기본 패딩과 충돌 → `className`으로 오버라이드 필요(shell이 `className`을 받으므로 가능, `bottom-sheet.tsx:64`).
- **판정:** shell로 통합하는 방향이 원칙에 부합하나, "전체높이 검색 피커를 데스크탑에서 중앙모달로 두어도 되는가"는 **사용자 판단 필요(근거 미확인)**. PlayerPickModal(승부예측 선수 선택)과 사실상 같은 "선수 목록 피커" 계열이므로, 통합을 하려면 두 피커를 함께 다루는 편이 일관적이다(이는 제안이며 실행은 Wave C).
- **[예외 유지] 근거는 없음.** 본질적 차이(반응형 불가·비모달 등)로 예외를 정당화할 코드 근거를 찾지 못했다.

### 6. UserMenu — **원칙 대상 밖(팝오버)**

- 오버레이·포커스트랩·Portal이 없고, 아바타 버튼 앵커에 상대 배치되는 드롭다운(`UserMenu.tsx:51 relative`, `:67 absolute right-0 top-10`). 모달/바텀시트 문법이 아니다 → 단일 shell 원칙 대상 아님(계획서 68줄 "팝오버성이면 대상 밖"과 일치).

---

## 4. PlayerPickModal → BottomSheet shell 이관 시 재현 점검 포인트

각 항목의 현재 구현(file:줄)과, shell 경로에서 유지되는지 판정.

| 점검 항목 | 현재 구현(PlayerPickModal) | shell 경로에서 | 판정 |
|-----------|---------------------------|----------------|------|
| **(1) 선수 목록 스크롤·max-h** | `max-h-[78vh] overflow-y-auto hide-scrollbar`, `sm:max-h-[80vh]`(`PlayerPickModal.tsx:71-72`) | shell의 `bottom`/`center` variant에는 `max-h`·`overflow`가 **없다**(grep 결과 `sheet.tsx`에 해당 클래스 0건; `sheet.tsx:47-48, 56-57`). | ⚠️ **`className`으로 명시 주입 필요.** `BottomSheet`이 `className`을 `SheetContent`에 전달(`bottom-sheet.tsx:64`)하므로 `max-h-[78vh] overflow-y-auto hide-scrollbar`를 넘기면 재현 가능. 누락 시 긴 목록이 화면 밖으로 넘친다. |
| **(2) 진입 애니메이션** | `slide-in-from-bottom-2`(8px, 가벼움) + fade, 모바일/데스크탑 공통(`PlayerPickModal.tsx:74-75`) | shell `bottom`=`slide-in-from-bottom`(풀 슬라이드, `sheet.tsx:48`), `center`=`fade+zoom-95`(`sheet.tsx:57`). | ⚠️ **모션이 달라진다.** shell 표준 모션(하단 풀슬라이드 / 데스크탑 zoom)을 그대로 받으면 현재의 "살짝 8px 위로" 감각은 사라진다. 시각적 동일 재현이 필수라면 사용자 확인 필요(디자인 결정). duration 토큰(enter/exit)은 양쪽 동일(`sheet.tsx:34` vs `PlayerPickModal.tsx:74`). |
| **(3) 선택 UX** | `PlayerPickRow`(`PlayerPickModal.tsx:109-146`): 행 전체 `<button>`, `aria-pressed`, 선택 시 `border-brand-solid bg-brand-weak`, hover `-translate-y-px`, 우측 `badgeVariants()` 배지 | content(children)로 그대로 이동 — shell과 무관. | ✅ **그대로 유지.** 순수 본문이라 shell 교체 영향 없음. |
| **(4) 접근성(포커스트랩·ESC)** | `DialogPrimitive.Root/Portal/Content` 직접 사용(`PlayerPickModal.tsx:54-105`)으로 Radix가 포커스트랩·ESC 제공 | shell도 동일 `@radix-ui/react-dialog`(`sheet.tsx:4`) 기반 → 포커스트랩·ESC 동일 제공. | ✅ **유지.** 단, shell은 우측상단 X 닫기 버튼을 **항상 렌더**(`sheet.tsx:88-91`)하는데 현재 PlayerPickModal엔 X가 없다 → 이관 시 **X 버튼이 새로 노출된다**(동작 추가). `DialogPrimitive.Title`(`PlayerPickModal.tsx:82`)은 shell에도 필요하므로 `SheetTitle`(`sheet.tsx:125`)로 매핑, 접근성 라벨 유지. |

**요약:** (3)(4)는 무손실 이관. (1)은 `className` 주입으로 해결. (2)와 (4)의 X버튼 노출은 **디자인 동작 변경**이라 Wave C 실행 전 사용자 확정 필요.

---

## 5. 부수 발견 — 문서 drift (참고, 1-B와 연계)

- `feedback/BottomSheet.mdx`: *"`ui/sheet.tsx`는 top·bottom·left·right 4방향을 지원… **실사용은 bottom뿐이다.** 나머지 3방향은 준비만 돼 있고 안 쓴다."*
  - **사실과 어긋남:** ①`sheet.tsx`의 variant는 5개(`top·bottom·left·right·center`, `sheet.tsx:37-57`)로 **`center`가 문서에 누락**. ②shell은 데스크탑에서 `center`를 **실사용**한다(`bottom-sheet.tsx:57`). "실사용은 bottom뿐"은 사실이 아니다.
- `DESIGN-SYSTEM.md:91`은 BottomSheet content로 `ConfirmModal`·`LoginModal`만 언급(`sheet.tsx`,`bottom-sheet.tsx` 경로 명시). PlayerPickModal은 별도 행(`:127`)으로 "모바일 바텀시트 / sm+ 중앙 다이얼로그"라 기술 — 즉 **shell 우회 사실이 문서상 드러나지 않는다.**
- Wave C에서 원칙을 `BottomSheet.mdx`에 명문화할 때(계획서 Wave C) 위 drift도 함께 정정 대상. **단일 shell 원칙 문서화 시 `center` variant의 실사용을 반영해야 한다.**

---

## 판정 종합 표

| 표면 | 판정 | 핵심 근거 |
|------|------|-----------|
| LoginModal / ConfirmModal / RequireAuthModal | 준수(변경 없음) | `LoginModal.tsx:79`, `ConfirmModal.tsx:35`, `RequireAuthModal.tsx:18` |
| **PlayerPickModal** | **[shell로 통합 가능]** — 격리 명분 낡음 | 명분 `PlayerPickModal.tsx:41-43` ↔ 반증 `bottom-sheet.tsx:57`+`sheet.tsx:56-57` |
| **PlayerPickerSheet(UserPollCreateForm)** | **[조건부 통합]** — 데스크탑 표시 의도 근거 미확인 | `UserPollCreateForm.tsx:448-451`, 데스크탑 전환 결정 문서 부재 |
| UserMenu | 대상 밖(팝오버) | `UserMenu.tsx:51,67` |

> 실제 리팩터링은 승인 후 Wave C. 본 리포트는 전수 점검·판정만 수행.
