# 1-C. foundation(color·typography) 준수 위반 목록

> 대상: `frontend/src` 전체. 기준: `frontend/src/components/design-foundation.test.mjs`.
> 원칙(계획서 21~29줄): 모든 판단에 file:줄 근거 병기. 근거 못 찾은 항목은 "근거 미확인"으로 표기. READ-ONLY 조사(토큰 이관은 승인 후 Wave B).

---

## 0. 핵심 결론 (먼저)

계획서 53~57줄과 test 383줄 주석이 전제한 그림은 **이미 낡았다.** 실제 코드를 확인한 결과:

1. **계획서가 "확정 위반"으로 지목한 3개 파일은 이미 전부 이관 완료** — `border-gray-4`/`text-gray-2`/`bg-primary` 등 구세대 토큰이 **0건**이다(§1). test 383줄 주석의 전제("아직 …쓰고 있어서")는 사실과 다르다.
2. **대신 test가 못 잡는 진짜 잔여가 따로 있다: 죽은 클래스 `divide-border`(8건)·`ring-border`(2건).** 폐기된 `border` 색 토큰을 참조해 조용히 무효화된다. test의 renamed 맵(321~352줄)이 `border-border`/`bg-border`/`ring-ring`은 막지만 `divide-border`/`ring-border`는 빠뜨렸다(§2). **이게 이번 1-C에서 새로 발견한 실질 위반이다.**
3. **"predict 검사를 리포 전체로 승격"은 단순 범위 확장이 아니다**(§4). predict 패턴은 `black`/`white`도 금지하는데, predict 밖 11개 파일이 `text-white`/`bg-white`/`from-black`을 **정당하게** 쓰고 있어 지금 그대로 넓히면 깨진다.
4. 정당한 예외 3건(구글 로고 hex, `--c-black` 스크림, Sheet 미사용 export)은 코드 근거로 재확인됨(§3).

---

## 1. 계획서가 지목한 "확정 위반" 3개 파일 — 실측 결과: 위반 없음(이미 이관됨)

계획서 55줄 / test 381~384줄이 아래 3개 파일을 "아직 `border-gray-4`/`text-gray-2`/`bg-primary`를 쓴다"고 지목했다. 실제 코드를 검사한 결과 **셋 다 구세대 토큰 0건**이다.

test 381~384줄 실제 주석 인용:
> **리포 전체가 아니라 predict 파일로 범위를 한정한다.** 다른 화면(app/admin/ratings/page.tsx, components/admin/AdminRatingsForm.tsx, components/layout/NavigationLoading.tsx)이 아직 border-gray-4 / text-gray-2 / bg-primary를 쓰고 있어서, 전체 금지는 지금 깨진다. 그 파일들을 옮기는 작업이 끝나면 이 검사를 리포 전체 글롭 스캔으로 넓힌다.

→ 이 주석의 전제는 **현재 코드 기준으로 거짓**이다. 각 파일 실사용 토큰:

| 파일 | 실제 사용 토큰(색) | 구세대 토큰 |
|---|---|---|
| `app/admin/ratings/page.tsx` | `bg-page`(58), `text-neutral-muted`(59·68), `text-neutral`(65) | **없음** |
| `components/admin/AdminRatingsForm.tsx` | `border-neutral-weak`·`bg-surface`(69·82·87·108), `text-neutral`/`-muted`(62·81·90·93·113), `text-positive`/`text-critical`(125) | **없음** |
| `components/layout/NavigationLoading.tsx` | `bg-disabled`(183·347·416), `border-neutral-weak`(227·240·278·294…), `bg-surface`, `border-brand-solid`(210), `bg-brand-solid`(418), `bg-neutral-strong`(322), `bg-page`(324·156) | **없음** (단, `divide-border` 잔존 → §2) |

검증 방법(재현): `grep -nE '\b(bg-primary|text-gray-[1-3]|border-gray-4|…)\b'` 를 세 파일에 실행 → `NONE FOUND`. predict 패턴(black/white 포함) 적용 → 세 파일 모두 `CLEAN`.

**판단:** 계획서 55줄의 "확정 위반" 항목은 **이미 해소됨**. 이 세 파일에 대한 Wave B 이관 작업은 (아래 §2의 `divide-border`를 제외하면) 불필요하다. test 383줄 주석은 stale — 갱신 대상.

---

## 2. test 검사 범위 밖의 진짜 잔여 위반: 죽은 색 클래스 `divide-border` · `ring-border`

이번 조사에서 새로 확인한 실질 위반. **test가 이 이름들을 목록에 넣지 않아 통과하지만, 실제로는 폐기된 색 토큰을 참조하는 죽은 클래스다.**

### 근거: `border` 색 토큰은 폐기됐다
- `tailwind.config.ts`의 `colors` 블록에는 `black` 하나만 남는다(49~52줄). 역할별 블록 `borderColor`(110~118줄)·`ringColor`(126~129줄)에도 **`border` 키가 없다**(있는 건 `neutral-weak`/`neutral-subtle`/`neutral-strong`/`brand-solid`/`critical-weak`/`focus-ring`).
- `--border`(shadcn HSL 세대)는 test `retiredVars` 목록에 들어 정의가 삭제됐다(design-foundation.test.mjs 278줄). globals.css/config에 `border` DEFAULT 정의도 없음(grep 확인).
- Tailwind에서 `divide-{color}`는 `divideColor`(기본값 = `borderColor` 상속), `ring-{color}`는 `ringColor`를 참조한다. 두 블록 모두 `border` 키가 없으므로 `divide-border`·`ring-border`는 **매칭 실패 → 스타일 미생성(조용히 무효)**.
- 이 실패 양상은 test 스스로가 316~317줄에서 설명한 바로 그 함정이다: *"Tailwind는 알 수 없는 클래스를 조용히 무시하므로, 남아 있으면 에러 없이 스타일만 사라진다."* renamed 맵(321~352줄)이 같은 이유로 `border-border`(345줄 계열)·`bg-border`(330줄)·`ring-ring`(333줄)은 막지만 **`divide-border`·`ring-border`는 키에 없다.**

### `divide-border` 잔존 8건 (구분선이 보이지 않는 채로 방치)
| 파일:줄 | 컨텍스트 |
|---|---|
| `components/layout/NavigationLoading.tsx:233` | `divide-y divide-border sm:hidden` (폴 목록 스켈레톤) |
| `components/layout/NavigationLoading.tsx:371` | `divide-y divide-border` (선수 목록 스켈레톤) |
| `components/polls/PollListClient.tsx:101` | `divide-y divide-border sm:hidden` |
| `components/polls/PollHomeSection.tsx:106` | `divide-y divide-border` |
| `components/players/PlayersPageClient.tsx:67` | `divide-y divide-border` |
| `app/players/changes/page.tsx:57` | `divide-y divide-border` |
| `storybook/contents/ListGroup.stories.tsx:18` | `divide-y divide-border …` |
| `storybook/loading/Skeleton.stories.tsx:78` | `divide-y divide-border` |

`divide-neutral-weak`는 리포에 **0건** — 즉 앱의 모든 행 구분선이 이 죽은 클래스 하나로 통일돼 있다(재현: `grep -rhoE '\bdivide-[a-z0-9-]+\b'` → `divide-border` 8 / `divide-y` 9, 그 외 없음).

### `ring-border` 잔존 2건
| 파일:줄 | 컨텍스트 |
|---|---|
| `components/polls/TypeAPollClient.tsx:160` | `ring-2 ring-border` (아바타 링) |
| `storybook/contents/Card.stories.tsx:64` | `ring-2 ring-border` |

### 매핑 제안 (근거 병기)
- **`divide-border` → `divide-neutral-weak`**: renamed 맵이 `border-border → border-neutral-weak`(345줄 계열)·`bg-border → bg-neutral-weak`(330줄)로 정한 것과 동일 계열. `divideColor`가 `borderColor`를 상속하고 `borderColor`에 `neutral-weak`가 있으므로(config 111줄) **새 토큰 없이 즉시 유효.** 근거: design-foundation.test.mjs 330·345줄 + tailwind.config.ts 111줄.
- **`ring-border` → 근거 미확인 / 결정 필요**: `ringColor` 블록(config 126~129줄)에는 `brand-solid`·`focus-ring`만 있고 `neutral-weak`가 **없다.** 그래서 `ring-neutral-weak`도 지금은 죽은 클래스가 된다. test의 `ring-ring → ring-brand-solid`(333줄) 규칙을 그대로 따르면 `ring-border → ring-brand-solid`가 되지만, 아바타 테두리(TypeAPollClient:160)에 브랜드 강조색이 의도인지 중립 하어라인이 의도인지는 코드만으로 판단 불가. **사용자 판단 필요** — (a) `ringColor`에 `neutral-weak` 토큰 추가 후 `ring-neutral-weak`, 또는 (b) `ring-brand-solid`.

> **주의:** 이 항목은 계획서 55줄이 지목한 3개 파일보다 범위가 넓다(polls/players/storybook 포함). test가 이 이름들을 놓친 것이므로, Wave B에서 이관과 함께 **renamed 맵에 `divide-border`·`ring-border` 키를 추가**해 재유입을 막는 것이 §2의 후속 조치다.

---

## 3. 정당한 예외 재확인 (코드 근거)

| 예외 | 근거(file:줄) | 예외로 남길 근거 | 판정 |
|---|---|---|---|
| **LoginModal 구글 로고 hex** | `components/polls/LoginModal.tsx:125~128` — `fill="#4285F4"`, `#34A853`, `#FBBC05`, `#EA4335` | 인라인 `<svg>`의 **SVG 속성**이지 Tailwind arbitrary-value 클래스(`text-[#…]`)가 아니다. test의 hex 금지 패턴(design-foundation.test.mjs 246~252줄)은 `bg-[#`/`text-[#`/`border-[#` 형태만 잡으므로 구조적으로 대상 밖. 구글 브랜드 로고는 고정 색이 필수. | **예외 유지 타당** |
| **`--c-black` 스크림** | 정의: `app/globals.css:18` (`--c-black: 17 17 17`). 사용: `components/polls/TypeBPollClient.tsx:210` (`from-black/35`). | test가 명시적으로 보존: design-foundation.test.mjs **286줄**(`--c-black`만 남긴다), tailwind.config.ts **50~51줄**(알파 수정자용 rgb 채널값 필요). `/알파` 수정자를 쓰려면 대응 sem 토큰이 아직 없음. | **예외 유지 타당** |
| **Sheet 미사용 export** `SheetTrigger`/`SheetClose`/`SheetFooter` | 정의: `components/ui/sheet.tsx:12·14·111`, export: `153~157`. | primitive 완결성을 위한 의도적 보존(계획서 124줄 "SheetTrigger/Close/Footer … 의도적 미사용, 건드리지 않음"). color/typography 위반 아님. | **예외 유지 타당** (색 준수와 무관, 참고 확인) |

---

## 4. "predict 검사를 리포 전체 스캔으로 승격"이 맞는지 검증

계획서 57·86줄 / 태스크 4의 명제: *실제 할 일 = 위 3개 파일 이관 + predict 전용 검사(376줄~)를 리포 전체 글롭 스캔으로 승격.* → **부분적으로 stale, 그대로는 부정확.**

predict 패턴(design-foundation.test.mjs 396줄)은 두 묶음을 금지한다:

```
(bg|text|border|ring|divide|from|to|fill|stroke)-
  (primary(-dark|-dim|-on)?|gray-[1-4]|positive-dim|negative(-dim)?|warning-dim  ← ① 진짜 구세대
   |black|white)                                                                 ← ② 기본 팔레트
```

- **① 진짜 구세대 부분(primary/gray/*-dim/negative)**: 리포 전체 grep 결과 **0건**(재현 확인). → 이 부분만 리포 전체로 넓히면 **지금 바로 통과.**
- **② black/white 부분**: predict 밖 **11개 파일이 정당하게 사용 중**이라, ②까지 포함해 그대로 넓히면 **즉시 red.** 사용 파일:
  `components/layout/AppHeader.tsx`, `components/my/MyPageClient.tsx`, `components/players/PlayersPageClient.tsx`, `components/polls/OverallRatingPollClient.tsx`, `components/polls/OverallRatingResultView.tsx`, `components/polls/PollHeroCard.tsx`, `components/polls/TypeAPollClient.tsx`, `components/polls/TypeBPollClient.tsx`, `components/ui/result-progress.tsx`, `storybook/actions/StickyActionBar.stories.tsx`, `storybook/selection-and-input/RatingMatrix.stories.tsx`.
  (예: `text-white`, `bg-white/20`, `bg-white/95`, `from-black/35` 등 — 배너/이미지 위 텍스트에 광범위 사용.)

**따라서 "승격"은 두 갈래로 갈린다:**
- **경로 X (스코프만 넓힘, 저비용):** predict 패턴에서 ②(black/white)를 빼고 ①만 리포 전체로 확장 → 지금 통과. 진짜 구세대 색의 재유입만 영구 차단.
- **경로 Y (계획서 원안, 고비용):** ②까지 유지하려면 **먼저** 위 11개 파일의 white/black을 sem 토큰으로 이관해야 한다(test 391~394줄이 매핑 예고: `text-white→text-on-solid`, `bg-white/5·/10→bg-on-solid-weak·-strong`, `bg-white/95→bg-surface-translucent`, `bg-black/45→bg-overlay`). 이건 3개 파일이 아니라 **11개 파일 규모의 별도 이관**이다 — 계획서 84~86줄이 상정한 "3개 파일" 범위를 크게 벗어난다.

> **핵심:** 계획서 57줄이 그린 "3개 파일 이관 → 승격"은 **① 기준으로는 이미 3개 파일이 끝났고**(§1), **② 기준으로는 3개가 아니라 11개 파일 이관이 선행돼야** 성립한다. 어느 쪽으로 갈지는 사용자 결정.

---

## 5. 준수 상태 총평 & 실제 할 일(수정판)

**총평: color/typography 토큰 준수는 매우 양호.** 계획서가 걱정한 3개 파일은 이미 정리됐고, 진짜 구세대 색 토큰(primary/gray/*-dim/negative)은 리포 전체 0건. typography 임의값도 test가 촘촘히 커버 중.

**실제 남은 할 일(근거 기반 수정판):**
1. **[신규·확정] 죽은 클래스 청소** — `divide-border` 8건 → `divide-neutral-weak`, `ring-border` 2건 → (사용자 결정) `ring-brand-solid` 또는 신규 `ring-neutral-weak`. test renamed 맵(321~352줄)에 두 키 추가로 재유입 차단. *(§2)*
2. **[갱신] test 383줄 주석 수정** — 3개 파일이 이미 이관됐으므로 stale 주석 제거/갱신. *(§1)*
3. **[결정 필요] predict 검사 승격 경로 선택** — 경로 X(① 만 넓힘, 즉시 가능) vs 경로 Y(② 위해 11개 파일 white/black 선이관). *(§4)*
4. **[유지] 예외 3건**은 그대로. Wave C에서 `--c-black`/구글 hex 예외 사유를 문서에 명문화하는 건 별개 작업. *(§3)*

---

### 부록: 재현 명령 (frontend/src 기준)
```bash
# §1 — 3개 파일 구세대 토큰 검사 → NONE
grep -nE '\b(bg-primary|text-gray-[1-3]|border-gray-4|bg-gray-[14]|text-primary|bg-primary-dim|text-negative|bg-negative-dim|bg-positive-dim|bg-warning-dim)\b' \
  app/admin/ratings/page.tsx components/admin/AdminRatingsForm.tsx components/layout/NavigationLoading.tsx
# §2 — 죽은 클래스
grep -rnE '\b(divide|ring)-border\b' --include='*.tsx' --include='*.ts' --include='*.css' .
grep -rhoE '\bdivide-[a-z0-9-]+\b' --include='*.tsx' --include='*.ts' --include='*.css' . | sort | uniq -c
# §4-① — 진짜 구세대 리포 전체 → NONE
grep -rnE '\b(bg|text|border|ring|divide|from|to|fill|stroke)-(primary(-dark|-dim|-on)?|gray-[1-4]|positive-dim|negative(-dim)?|warning-dim)\b' --include='*.tsx' --include='*.ts' .
# §4-② — predict 밖 white/black 사용 파일
grep -rlE '\b(bg|text|border|ring|divide|from|to|fill|stroke)-(black|white)\b' --include='*.tsx' --include='*.ts' . | grep -vE 'predict/|app/predictions/'
```
