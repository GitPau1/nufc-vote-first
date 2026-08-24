# 1-B. 문서 이력·군더더기 목록

원본 계획서: `vault/10_gun/디자인시스템-컴포넌트-정리-계획.md` §1-B(48~51번 줄), Wave A(79~82번 줄)
조사 대상: `frontend/src/storybook/**/*.mdx`(49개, node_modules 제외) + `frontend/src/storybook/DESIGN-SYSTEM.md`
조사 방식: 전 파일 정규식 스캔(경위·날짜·"한때/원래/예전/재확인/폐기/복원/옮겼다/바꿨다/제거했다/병합/마이그레이션/Phase/커밋" 등) 후 실제 문맥 정독으로 태깅.
**READ-ONLY 조사만 수행. 실제 삭제·편집 없음.**

태그 정의(계획서 51번 줄 기준):
- **[삭제]** — 규칙 이해에 불필요한 과거 경위.
- **[각주/History 이동]** — 참고 가치는 있으나 규칙 본문에서 빼는 게 나음.
- **[규칙이라 유지]** — 판단 근거가 되는 서술은 반드시 유지.

> 원칙(계획서 21~29번 줄): 각 판정에 file:줄 근거 병기. 근거 못 찾으면 "근거 미확인"으로 남김.

---

## 요약(먼저 보기)

| 파일 | [삭제] | [각주/이동] | [유지] |
|---|---|---|---|
| DESIGN-SYSTEM.md | 39, 41, 43, 49(후반부), 51, 85, 129 | 53, 149(①②서술) | 135, 141, 151, 153, 155 |
| foundations/DesignToken.mdx | — | (선택)30·67후단·71후단 | 페이지 전체(예외 파일·규칙 본체) |
| contents/ResultProgress.mdx | — | 13~15 "## 배경" | — |
| contents/PlayerPhoto.mdx | 58(전반) | 13~17 "변경 기록" | 22, 58(후반 규칙) |
| contents/CommentsSection.mdx | 39 | — | 20~27(4겹 규칙) |
| contents/RankingCard.mdx | 61(후반) | — | 61(색 규칙) |
| contents/WeekRankCard.mdx | — | 95, 96 | — |
| contents/MatchdayHero.mdx | 61(중간절) | — | 14, 61(prefetch 규칙) |
| contents/MatchWeekList.mdx | — | 96("이제") | — |
| foundations/Gradient.mdx | 56 | 39~41 | 79~81(규칙) |
| foundations/Semantic.mdx | 63(중간절) | — | 63(역할 규칙) |
| foundations/Motion.mdx | — | 51 | 65, 82 |
| feedback/ConfirmModal.mdx | 22 | — | 10, 36 |
| feedback/LoginModal.mdx | — | 41, 43, 63, 69 | 각 줄의 규칙부 |
| selection-and-input/ImageInput.mdx | 12, 38(괄호) | — | 38(규칙) |
| Overview.mdx / DesktopNavLinks.mdx / StepTrack.mdx / Radio.mdx / TextInput.mdx / Skeleton.mdx / ListGroup.mdx | — | — | 경위 아님(후술) |

핵심: **삭제/이동 대상은 거의 전부 "본문 안 특정 절(clause)"이다.** 파일이나 문단 통째 삭제는 없다 — 같은 문장 안에 규칙과 경위가 붙어 있어 절 단위로 갈라야 한다. DESIGN-SYSTEM.md는 인덱스 파일이라(자기 규칙 5~10번 줄: "이름·한 줄·경로만") 경위 문단 자체가 규칙 위반이라 가장 정리 여지가 크다.

---

## DESIGN-SYSTEM.md (인덱스 — 자기 규칙상 "이름·한 줄·경로"만 허용, 5~10번 줄)

- **39번 줄** `[삭제]` — "State와 Motion은 Phase 3에서 새로 만든 foundation이다 … duration 7종→4종, opacity 6종→4종." → 통합 경위. 근거: 인덱스 규칙(7~8번 줄)이 본문 서술 금지. duration/opacity 최종값은 각 MDX·`tailwind.config.ts`에 있다.
- **41번 줄** `[삭제]` — "Icons·Gradient·Design Token은 … 새로 만들었다(2026-08-23). 셋 다 … 수렴시킨 결과라는 점은 State·Motion과 같다." → 생성 경위+날짜. 근거: 규칙 아님, 인덱스 규칙 위반.
- **43번 줄** `[삭제]` — "Palette와 Semantic은 한때 PaletteProposal.mdx/SemanticProposal.mdx로 존재했다가 … 과잉 삭제였다 … 지금 두 페이지는 '제안'이 아니라 … 참조 문서다." → 삭제·복원 경위. 근거: "참조 문서(화면에 직접 안 씀)"라는 성격은 이미 인덱스 26·27번 줄 한 줄 설명에 있음.
- **49번 줄(후반부)** `[삭제]` — "…를 따른다. **Phase 4(2026-08-22)에서 §5-1의 생존 패턴 14개를 전부 작성했다 — 원래 있던 이름과 달라진 것들의 이유는 각 MDX에 적어뒀다.**" → 앞의 "Montage 분류를 따른다"는 **[규칙이라 유지]**(분류축 = 근거). 뒤 문장만 경위라 [삭제]. 근거: "이름 달라진 이유는 각 MDX에" = 원본이 MDX이므로 인덱스에 중복.
- **51번 줄** `[삭제]` — "2026-08-24에 '코드에는 있는데 Storybook에 없는 것'을 전수 점검해 16개를 추가했고 … 총 21개가 늘었다. 그 결과 §'아직 인덱스에 없는 컴포넌트'로 유예해뒀던 항목은 남지 않았다." → 증분 이력. 근거: 규칙 아님. 현재 목록은 아래 표 자체가 진실.
- **53번 줄** `[각주/History 이동]` — "승부예측 컴포넌트의 색·타이포 토큰은 같은 날 구세대 flat 토큰 … semantic으로 옮겼다 — 그래서 문서에 인용된 클래스 이름은 현행 semantic 기준이다. 되돌아가지 않도록 design-foundation.test.mjs가 predict 파일 목록을 검사한다." → "옮겼다"는 경위지만 "인용 클래스명 = 현행 semantic" + "test가 검사"는 참고 가치. 근거: 같은 규칙이 `foundations/DesignToken.mdx` 30·56~61번 줄 + `design-foundation.test.mjs` 190~207·376번 줄에 원본으로 있음 → 인덱스에서는 빼도 됨.
- **85번 줄** `[삭제]` — "`ResultProgress`는 원래 `Progress`(Radix 기반, 실사용 0건)였다 — … 이름을 바꿨다." → 통합 경위. 근거: `contents/ResultProgress.mdx` 15번 줄에 동일 서술이 원본으로 존재(인덱스 중복).
- **129번 줄** `[삭제]` — "`Radio`는 원래 … 3곳에 중복 구현됐다고 기록돼 있었는데, 재확인 결과 실제 … 2곳뿐이었다 … Phase 7에서 ui/radio.tsx로 통합했다." → 재확인·통합 경위. 근거: 규칙 아님. 현재 사실(라디오는 `ui/radio.tsx` 단일)은 122번 줄 표 행이 담당.
- **135번 줄** `[규칙이라 유지]`(단, "(2026-08-22 확인)" 날짜 조각만 [삭제]) — "아래 패턴은 과거 스펙에 정의됐으나 코드에 구현체가 없어 제외했다 … 되살리려면 새로 설계한다 — 과거 스펙을 그대로 복원하지 않는다." → "새로 설계한다"는 **판단 규칙**. 근거: 155번 줄과 짝을 이루는 "이 시스템에 없는 것" 정책.
- **141번 줄** `[규칙이라 유지]`(단, "2026-08-24 전수 점검 결과," 프레이밍만 [삭제]) — "… 아래 세 부류뿐이다. 새로 만든 컴포넌트가 이 부류에 속하지 않으면 인덱스에 행을 추가한다." → 인덱스 유지보수 규칙. 근거: 계획서 41번 줄이 인용하는 "화면 단위 클라이언트" 식별 목록(143~145번 줄)의 앵커.
- **149번 줄** `[각주/History 이동]` — "**3. import하는 곳이 없는 컴포넌트** — 현재 없다. **2026-08-24에 두 차례 정리했다. ① … ② main 병합 … 후 전수 재점검에서 …**" → "현재 없다"는 **[규칙이라 유지]**. 뒤 ①②의 구체 정리 이력은 참고 가치는 있으나 규칙 아님 → 이동. 근거: 규칙은 "import 없는 것은 인덱스 제외", 무엇을 언제 지웠는지는 git 로그의 몫.
- **151번 줄** `[규칙이라 유지]` — "`deleteUserPoll`은 단순한 죽은 코드가 아니었다 — … 화면 없이 외부에서 도달 가능한 삭제 엔드포인트였다(service-role cascade). 서버 액션은 export되어 있는 것만으로 공개 엔드포인트이므로, 화면을 지울 때 액션도 함께 지운다." → **보안 판단 근거.** 근거: 계획서가 명시적으로 유지 지시(51·123번 줄). 마지막 문장은 일반 규칙.
- **153번 줄** `[규칙이라 유지]` — "사용처가 없는데도 일부러 남겨둔 것 셋: `SheetTrigger/Close/Footer` · pick-one-rating.ts · types/database.ts의 `*Row`." → 의도적 미사용 = 건드리지 말 것. 근거: 계획서 124번 줄 "안 만질 것"과 일치.
- **155번 줄** `[규칙이라 유지]` — "사용처 없는 구현체는 과거 `ui/progress.tsx`처럼 디자인시스템에 넣지 않고, 되살릴 때는 새로 설계한다." → 규칙. `ui/progress.tsx`는 규칙을 예시하는 참조라 유지 무해.

---

## foundations/DesignToken.mdx — 예외 파일, 페이지 전체 `[규칙이라 유지]`

이 페이지는 **"토큰 3세대 공존 현황과 이름 겹침 함정"**을 다루는 규칙 본체다(인덱스 DESIGN-SYSTEM.md 37번 줄 한 줄 설명이 그렇게 규정). 서술이 과거형("있었다/튀었다/들어왔다")이라도 그 자체가 **"이름의 익숙함이 아니라 이 표를 본다"**(30·73번 줄)는 판단 규칙의 근거다.
- 또한 **`design-foundation.test.mjs`가 폐기 클래스명 인용을 허용하는 유일한 파일**이다(테스트 364번 줄 예외). 아래 §주의사항 참조.
- 선택적 다듬기(강제 아님, `[각주/History 이동]` 후보): 30번 줄 "승부예측 화면이 옛 하늘색으로 튀었던 것도 같은 이유다", 67번 줄 후단 "…승부예측 화면 전체가 같은 함정에 빠진 상태로 main에서 들어왔다", 71번 줄 후단 "…포커스 링만 구세대 색으로 남아 있었다" — 구체 사례라 함정-규칙을 읽기 쉽게 하나, 규칙 자체는 아님. **단, 이 파일은 예외라 굳이 손대지 않는 편이 안전**(수정 시 폐기 클래스명 예외 취급이 흔들릴 여지).

---

## 컴포넌트 MDX

### contents/ResultProgress.mdx
- **13~15번 줄** `[각주/History 이동]` — "## 배경" 절 전체. "원래 이름은 `Progress`였고 Radix 기반 … 실사용 0건 … `ResultView`의 마크업 그대로 `ResultProgress`로 이름을 바꿔 통합했다. `role="progressbar"`·`aria-valuenow`는 이번에 새로 얻은 것이다." → 통합 경위. 참고 가치(접근성 속성이 왜 생겼는지)는 있으나 규칙 본문은 아님. 근거: 8번 줄(용도)·17~34번 줄(현재 사용법)이 규칙을 담당.

### contents/PlayerPhoto.mdx
- **13~17번 줄** `[각주/History 이동]` — 헤딩부터 "(변경 기록)"으로 명시된 절. "원래는 생 `<img>`였고 … `url`이 null인 경우만 폴백 … 요청 실패는 폴백 없었다 … Avatar로 갈아탔다." → 명시적 변경 기록. 16번 줄의 실패모드 근거(왜 Radix Avatar 폴백이 낫나)는 참고 가치 있어 각주로. 근거: 22번 줄 "두 스토리 결과가 같아야 정상"이 현재 규칙(유지).
- **58번 줄(전반)** `[삭제]` — "예전에는 예측 플로우·결과·완료 세 화면이 실루엣 원을 각자 손으로 조립 … 지금은 전부 PlayerPhoto로 모았다." → 통합 경위. **후반 [규칙이라 유지]**: "이 자리도 이 컴포넌트다(url={null} size={40})" + "Silhouette은 폴백 전용이니 직접 감싸 쓰지 않는다." 근거: 후반은 사용 규칙.

### contents/CommentsSection.mdx
- **39번 줄** `[삭제]` — "`canComment`를 UI에서 막기 전에는 … 아무 일도 일어나지 않은 것처럼 보였다(2026-08-24 수정). 지금은 …" → 버그 수정 경위. 근거: 현재 규칙("댓글은 참여자만" 4겹 방어)은 20~27번 줄에 원본으로 있고, 실패 문구 규칙은 41~53번 줄에 있음.

### contents/RankingCard.mdx
- **61번 줄(후반)** `[삭제]` — "화살표 글자 크기는 … `text-caption-2`(11px)다 — **원래는 그보다 1px 작은 임의값(`text-[10px]`)이었는데, 스케일 밖 값을 남겨둘 이유가 없어 최소 토큰으로 올렸다.**" → 토큰 교정 경위. **전반 [규칙이라 유지]**: "상승=적색(text-critical)/하락=회색 … critical이 '좋은 일'에 쓰이는 유일한 자리 … 크기=text-caption-2." 근거: 전반은 색·크기 규칙.

### contents/WeekRankCard.mdx
- **95번 줄** `[각주/History 이동]` — "## 알려진 제약" 항목. 현재 제약("내 점수/남의 점수가 색으로 안 갈림")은 유지 가치, **그러나 "옛 토큰 시절에는 … 밝은 값이었는데 … 분기 자체를 지웠다"** 경위는 이동. 근거: 현재-상태 서술은 규칙(제약), 마이그레이션 경위는 참고.
- **96번 줄** `[각주/History 이동]` — "같은 마이그레이션에서 '전체보기' 버튼 hover도 줄었다. **예전에는 테두리·글자가 함께 브랜드색 … 지금은 테두리만 진해지고 글자는 그대로다(`hover:border-neutral-strong`).**" → 현재 동작(hover 규칙)은 유지, "마이그레이션에서 줄었다/예전에는" 프레이밍만 이동.

### contents/MatchdayHero.mdx
- **61번 줄(중간절)** `[삭제]` — "CTA는 `/predictions/{weekKey}`로 연결된다. **main 병합으로 이 라우트가 실제로 존재하므로** prefetch를 켜뒀다 …" → "main 병합으로 … 존재하므로"는 경위. **[규칙이라 유지]**: "prefetch 켬(주 CTA), 목록 반복 링크·상시 네비만 prefetch=false." 근거: prefetch 정책은 규칙.
- **14번 줄** `[규칙이라 유지]` — "…홈 화면은 예전 방식(투표 배너)으로 대체된다." → "예전 방식"은 이력이 아니라 **현재 폴백 동작**의 명칭. 24h 규칙 서술의 일부. (원하면 "예전 방식" 표현만 다듬을 수 있으나 경위 아님.)

### contents/MatchWeekList.mdx
- **96번 줄** `[각주/History 이동]`(경미) — "주차 식별자는 **이제** 같다 — `PredictWeek.weekKey`가 MatchdayHero와 동일한 `lib/predictions/week.ts`의 weekKey이므로 …" → 내용은 현재 규칙(weekKey 공통·라우팅 가능)이라 유지, "이제"라는 과거대비 부사만 제거하면 순수 규칙이 됨.

### foundations/Gradient.mdx
- **39~41번 줄** `[각주/History 이동]` — "## 발견된 드리프트 — 수정함" 절. "avatar fallback 자리는 원래 `from-primary/30 to-primary-dark`를 썼다 … `brand-solid` 계열로 교정했다." → 드리프트 수정 경위. 참고 가치(그라디언트가 임의값 검사에 안 걸리는 함정)는 있으나 규칙은 81번 줄이 담당. 근거: 79~81번 줄 "하지 말 것"이 규칙 본문.
- **56번 줄** `[삭제]` — "원래 이 자리에는 데스크탑 전용 장식 배경 `.shell-desktop-bg` … 있었는데, 그 화면 자체를 안 쓰기로 해서 걷어냈다 …" → 제거된 유틸리티 경위. 근거: 현재 규칙 아님(존재하지 않는 클래스 설명).
- **79~81번 줄** `[규칙이라 유지]` — "새 그라디언트 임의 hex 금지 / flat로 되면 그라디언트 얹지 말 것 / 폐기 색 이름(primary 등) 금지." 근거: 판단 규칙.
- ※ 41·81번 줄의 `primary`/`primary-dark`/`from-primary`/`to-primary-dark`는 테스트의 `renamed` 맵 **키가 아니다**(`bg-`/`text-` 접두사 아님, `from-`/`to-`는 맵에 없음) → 테스트 무충돌(§주의사항 실증).

### foundations/Semantic.mdx
- **63번 줄(중간절)** `[삭제]` — "…AA를 통과한다. **이 자리에 원래 `text-disabled`를 전용해 쓰고 있었는데(값은 같다) '비활성'이 아니라 '보조'라 역할 이름이 어긋나 있었다. 값은 그대로 두고 이름만 뗀 것이라 화면은 바뀌지 않는다.**" → 이름 교정 경위. **[규칙이라 유지]**: "text-on-solid-muted = 어두운 면 2차 텍스트 … 흰 배경 위에서는 쓰지 않는다(2.2:1)." 근거: 앞뒤가 사용 규칙.
- ※ `text-disabled`는 `renamed` 맵 키 아님 → 테스트 무충돌.

### foundations/Motion.mdx
- **51번 줄** `[각주/History 이동]` — "이 셋은 이름·주석으로만 추적되고 design-foundation.test.mjs는 이 파일 숫자 인자를 검사하지 않는다 — **R4(하드코딩 파일 목록→글롭 스캔 확장)와 같은 종류의 구조적 확장이라 별건으로 남겨둔다.**" → "test가 JS 타이머는 안 잡는다"는 유용한 caveat(유지 가치), 내부 작업코드 "R4 … 별건" 로드맵 프레이밍은 이동. 근거: 규칙은 caveat, 로드맵은 규칙 아님.
- **65번 줄** `[규칙이라 유지]` — "이 불일치를 알고 쓴다 — 새로 만드는 것은 위 규칙을 따르고, 기존 코드를 맞추는 작업은 별건이다." → easing 불일치 처리 규칙(현재 유효). 근거: 53~63번 줄 "의도한 규칙 vs 실제 코드" 판단 근거.
- **82번 줄** `[규칙이라 유지]` — "`framer-motion`은 제거했다. 애니메이션은 Tailwind + tailwindcss-animate로 처리한다 …" → "제거했다"는 경미한 경위지만 "framer-motion 쓰지 말 것"이라는 **판단 근거**를 담아 유지 권장(원하면 '제거했다'→'쓰지 않는다' 다듬기 가능).

### feedback/ConfirmModal.mdx
- **22번 줄** `[삭제]` — "전체 평가는 2026-08-24까지 이 확인 단계 없이 … 바로 호출했다 — … 확인을 붙였다. 그때 title·summaryCaption·confirmLabel을 optional prop으로 열었고 …" → 기능 추가 경위. 근거: 현재 규칙(OverallRating은 optional prop로 문구 교체, 기본값=선택형)은 20번 줄 표 + 36번 줄에 원본으로 있음.
- **10번 줄 / 36번 줄** `[규칙이라 유지]` — "투표는 제출 후 수정 불가(UNIQUE) → 이 모달이 존재하는 이유 → '제출 후 변경 불가' 문구는 고정, prop으로 못 끔." 근거: 핵심 제약(계획서·CLAUDE.md의 3대 불변식).

### feedback/LoginModal.mdx (경위-이력이 규칙 본문에 섞인 대표 사례)
- **41번 줄** `[각주/History 이동]` — "**예전엔 이 값이 analytics 속성으로만 쓰여서 헤더 로그인 버튼에서 열어도 '투표에 참여하려면…'이 떴다.** login-modal.test.mjs가 이제 (1) 문구가 값별로 다른지, (2) 호출부마다 맥락값을 넘기는지를 소스 문자열로 고정한다." → "예전엔 … 떴다"는 경위 이동. test-pointer(뒤 문장)는 규칙이라 유지.
- **43번 줄** `[각주/History 이동]` — "**타입에만 있고 넘기는 곳이 없던 'comment'·'create_poll'은 없앴다** — … 댓글 작성은 참여자만 가능해 도달 못하고, 투표 생성 페이지는 RequireAuthModal(login)을 쓴다." → "없앴다" 경위지만, 왜 그 값이 없는지 설계 근거는 참고 가치. 절충으로 이동(원하면 규칙으로 재서술 가능).
- **63번 줄** `[각주/History 이동]` — "정리하면 갈리는 축은 셋 … 서로 안 겹친다. **예전엔 설명 문구도 IS_MOCK으로 덮여서 … mock에서는 맥락별 문구가 안 보였는데, 그 분기는 없앴다.**" → "축 셋(triggerAction/IS_MOCK/화면폭)" 앞 문장은 **[규칙이라 유지]**, "예전엔 … 없앴다"만 이동.
- **69번 줄** `[각주/History 이동]` — "BottomSheet 위 … 모바일 바텀시트/데스크톱 중앙 모달. **예전엔 'intent' prop 분기가 있었는데 없앴다** — 화면 폭이 유일한 기준이다. login-modal.test.mjs가 이 규칙을 검사한다." → "화면 폭이 유일한 기준 + test 검사"는 **[규칙이라 유지]**, "예전엔 intent prop … 없앴다"만 이동. (이 shell 규칙은 1-D 태스크와도 직결.)

### selection-and-input/ImageInput.mdx
- **12번 줄** `[삭제]` — "한때 21:9 preset 래퍼(`BannerImageInput`)가 같은 파일에 있었지만 호출부가 없어 2026-08-24에 삭제했고, 파일 이름도 남은 export에 맞춰 바꿨다." → 삭제 경위. 근거: DESIGN-SYSTEM.md 149번 줄 ①에 동일 이력 중복.
- **38번 줄(괄호 부분)** `[삭제]` — "…outputWidth를 올릴 때 preset도 함께 올린다**(2026-08-24: poll-option이 720이라 1000×1300이 720×936으로 줄던 문제를 이렇게 맞췄다).**" → 괄호 안 수정 경위만 삭제. **[규칙이라 유지]**: "크롭 출력을 상한보다 크게 잡으면 조용히 줄어드니 outputWidth 올릴 때 preset도 함께 올린다." 근거: 앞부분은 운영 규칙.

---

## 경위처럼 보이나 "규칙/현재상태"라 유지 대상 (오탐 정리 — 삭제 금지)

- **Overview.mdx:21** — "사이드바 분류는 원티드 Montage 체계를 따른다." → 분류축 규칙. `[규칙이라 유지]`
- **navigations/DesktopNavLinks.mdx:41** — "'메뉴' 탭이 데스크탑 GNB에 없는 것은 의도다 — 피드백·관리자 진입은 UserMenu 드롭다운으로 옮겼다." → 설계 의도 + 현재 배치 규칙. `[규칙이라 유지]`("옮겼다" 표현만 원하면 다듬기 가능).
- **navigations/StepTrack.mdx:44** — "descMulti가 없는 스텝은 원래 desc로 폴백한다." → "원래 desc" = 기본 desc(폴백 규칙), 이력 아님. `[규칙이라 유지]`
- **selection-and-input/Radio.mdx:16** — "role='radiogroup' 컨테이너는 아직 없다 … 필요해지면 그때 추가한다." → 현재-상태 + 향후 규칙. `[규칙이라 유지]`
- **selection-and-input/TextInput.mdx:28** — ".input-field엔 disabled 스타일이 없다 … 생기면 그때 맞춰 넣는다." → 현재-상태 규칙. `[규칙이라 유지]`
- **loading/Skeleton.mdx:56** — bottom-[64px] 등 현재 값 + "navigation-loading.test.mjs가 감시한다." → 규칙/근거. `[규칙이라 유지]`
- **contents/ListGroup.mdx:14** — "각 행 내용은 그때그때 다르게 채운다." → 사용 규칙. `[규칙이라 유지]`
- **contents/MatchWeekList.mdx:19** — "locked … 더 이상 제출할 수 없는 경기." → 상태 정의(이력 아님). `[규칙이라 유지]`

---

## §주의사항 — `retired legacy color class names` 검사와 mdx (계획서 지시 항목, 실제 테스트로 실증)

**결론: mdx 본문에서 폐기 클래스명을 "지우는" 것은 이 검사와 절대 충돌하지 않는다(매칭이 줄 뿐 늘지 않음). 충돌은 오직 "규칙/이력 문장을 남기면서 폐기 클래스명을 인용해야 할 때"만 생기며, 그런 인용은 예외 파일 `foundations/DesignToken.mdx`에만 허용된다.**

근거(모두 실제 코드/실행 확인):

1. 검사 대상에 mdx 포함 — `design-foundation.test.mjs:358` `if (… !/\.(tsx|ts|css|mdx)$/.test(entry)) continue`. **`.mdx`도 스캔한다.**
2. 예외는 두 개뿐 —
   - `:361` 테스트 파일 자신 제외,
   - `:364` `if (entry.endsWith('foundations/DesignToken.mdx')) continue` — 주석(362~363번 줄): "이 페이지의 존재 이유가 '무엇을 왜 걷어냈는지' 설명하는 것이라, 폐기된 이름을 본문에서 인용하는 게 정상이다. **유일한 예외.**"
3. 무엇을 잡나 — `:321~352` `renamed` 맵의 **키**(폐기 이름)를 `\b(...)\b` 전체 단어로 매칭(`:353`). 키 목록: `bg-background · text-foreground · text-muted-foreground · text-card-foreground · text-secondary-foreground · border-border · border-input · bg-border · bg-secondary · bg-muted · ring-ring · bg-accent · bg-popover · bg-destructive · bg-primary · text-primary · text-primary-dark · bg-primary-dim · text-gray-1 · text-gray-2 · text-gray-3 · border-gray-4 · bg-gray-1 · bg-gray-4 · text-negative · bg-negative-dim · bg-positive-dim · bg-warning-dim`.
4. **실측(현재 리포 상태):** 위 키를 mdx 전 파일에 전체단어로 grep한 결과 **매칭이 전부 `foundations/DesignToken.mdx` 한 파일(23·36~46·67·69번 줄 등)에만** 존재. 다른 mdx에는 0건.
   - 실행 확인: `node --test --test-name-pattern="retired legacy color class names" …` → `tests 1 / pass 1 / fail 0` (현재 통과).
5. 인접 오탐 아님을 확인 — `foundations/Gradient.mdx:41,81`의 `primary`/`primary-dark`/`from-primary`/`to-primary-dark`와 `foundations/Semantic.mdx:63`의 `text-disabled`는 **키가 아니라서 매칭 안 됨**(접두사 `bg-`/`text-` 아니거나 `from-`/`to-`는 맵에 없음). 그래서 이 파일들을 Wave A에서 편집해도 검사 무충돌.

**Wave A 실행 지침(이 리포트 기준):**
- 본 리포트에서 `[삭제]`/`[각주 이동]`으로 태깅된 문장 중 **폐기 클래스명 인용을 필요로 하는 것은 없다**(위 5번 — DesignToken.mdx 외 태깅 대상은 폐기 키를 담고 있지 않음). 따라서 DesignToken.mdx 외 mdx는 자유롭게 편집 가능하며 검사가 red 되지 않는다.
- 만약 향후 어떤 규칙/각주가 폐기 클래스명을 반드시 인용해야 한다면 → **`foundations/DesignToken.mdx`에만** 둔다(그 파일만 예외). 다른 mdx에 남기면 즉시 검사 red.
- `foundations/DesignToken.mdx` 자체는 예외 파일이자 규칙 본체라 Wave A에서 **손대지 않는 편이 안전**(편집이 예외 취급을 흔들 여지 + 규칙 손실 위험).

---

## 남긴 판단(사용자 확인 필요)

- **[각주/History 이동] 태깅 항목의 "이동 위치"는 미결.** 계획서 51번 줄은 "[각주·History 섹션으로 이동]"이라 했으나, 어느 파일의 어떤 History 섹션으로 모을지(파일별 하단 `## 변경 기록` vs 공용 CHANGELOG)는 지정되지 않음 → Wave A 실행 전 결정 필요. **근거 미확인**(계획서에 이동 목적지 규정 없음).
- **DESIGN-SYSTEM.md 141·149번 줄의 "날짜/전수점검 프레이밍만 제거 vs 문장 통째 유지"**는 인덱스 규칙(5~10번 줄) 엄격 적용 여부에 달림 → 사용자 결정.
- 표현 다듬기 수준(예: MatchWeekList:96 "이제" 제거, Motion:82 "제거했다"→"쓰지 않는다")은 [삭제]가 아니라 문장 보존형 정리라 별도 승인 불필요할 수 있으나, "규칙 원문 손대지 않는다"(계획서 81번 줄)와 경계가 있어 확인 권장.

DONE: vault/10_gun/audit/1-B-doc-history.md
