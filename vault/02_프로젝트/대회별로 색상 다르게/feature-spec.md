# feature-spec — 대회별로 색상 다르게

작성: 2026-09-05 · 작성자: developer 에이전트
입력: `intent.md`(결정 이력, "최종 색상 확정" 섹션이 색상 값의 단일 소스) · `design-brief.md`(단일 스펙 소스) · `노란-팔레트-제안.md`(팔레트 값) · 코드 실측(아래 각 절에 `file:줄` 근거)
승인권자: 사용자 (프로덕트 디자이너) — 이 문서는 구현 착수 전 `plan.md`와 함께 승인 대상이다. **이 문서만으로는 코드를 고치지 않는다.**

---

## 0. 범위

승부예측 화면 4곳에 `fixtures.competition_name` 기준 3버킷(프리미어리그=violet · 기타 컵 대회=green · 친선경기=yellow) 색을 입힌다: `MatchdayHero`(다크 카드 전체 배경), `MatchWeekList`의 `MatchInfoCard`(라이트 카드 배경), `PredictionFlowClient`의 `MatchMeta`(배지), `PredictionDone`의 경기별 카드(배지, 신규 추가). 투표(poll)는 스코프 밖(`intent.md` L28, 대회 구분 데이터 자체가 없음).

색 값·공식은 전부 `design-brief.md` 2번·`노란-팔레트-제안.md` 4번에서 확정됐다 — 이 문서는 그 값을 코드의 어느 지점에 어떤 형태로 넣을지만 다룬다. 색 자체를 재계산하지 않는다.

---

## 1. 대회명 → 버킷 매핑 함수 (제안 — 파일명·함수명은 plan 승인 때 사람 확정)

### 1-1. 매핑 규칙 (`intent.md` "확정된 것" 표 그대로, 재계산 아님)

| `competition_name` 원문 | 버킷 | 색 |
|---|---|---|
| `'Premier League'` | 프리미어리그 | violet |
| `'Club Friendlies'` | 친선경기 | yellow |
| `'EFL Cup'`, `'FA Cup'`, `'Europa League'`, `'Europa Conference League'`, `'Champions League'`, 목록에 없는 새 값 전부 | 기타 컵 대회 | green (fallback) |

### 1-2. 제안 위치 — `frontend/src/lib/predictions/competitionColor.ts` (신규 파일, 제안)

`lib/predictions/` 아래는 이미 순수 함수만 모아둔 자리다(`week.ts`, `candidates.ts`, `result.ts`, `submit.ts` — DB 접근 없음, `frontend/src/lib/predictions/week.ts:1-4` 주석 "fixtures 행 → 승부예측 목록 화면용 주차 그룹 변환(순수 함수, DB 접근 없음)"). 같은 성격의 새 순수 함수라 이 폴더에 새 파일로 추가하는 것을 제안한다. 기존 `week.ts`에 얹지 않는 이유: `week.ts`는 이미 여러 타입·함수가 있는 파일이고(320줄+), 색 매핑은 그와 독립된 관심사라 별도 파일이 재사용(4개 컴포넌트가 각자 import)에 더 맞는다 — 이 판단은 제안이며 강제하지 않는다.

```ts
// frontend/src/lib/predictions/competitionColor.ts (제안, 신규 파일)

export type CompetitionColorBucket = 'violet' | 'green' | 'yellow'

const VIOLET_COMPETITIONS = new Set(['Premier League'])
const YELLOW_COMPETITIONS = new Set(['Club Friendlies'])

/**
 * fixtures.competition_name 원문 문자열 → 색 버킷.
 * Premier League 외 컵 대회(EFL Cup/FA Cup/Europa League/Europa Conference League/
 * Champions League)와 목록에 없는 새 값은 전부 green(기타 컵 대회) fallback이다.
 */
export function competitionColorBucket(name: string | null | undefined): CompetitionColorBucket {
  if (name && VIOLET_COMPETITIONS.has(name)) return 'violet'
  if (name && YELLOW_COMPETITIONS.has(name)) return 'yellow'
  return 'green'
}
```

함수명 `competitionColorBucket`, 파일명 `competitionColor.ts`는 제안이다 — CLAUDE.md 원칙(구조·이름 임의 발명 금지)에 따라 plan 승인 때 사람이 최종 확정한다.

### 1-3. null/undefined 처리 — **근거 미확인, 사람 확정 필요**

위 구현은 `name`이 없으면(null/undefined/빈 문자열) green(기타 컵 대회) fallback으로 떨어진다. 그런데 실제 코드에는 **이미 다른 기본값 관례가 있다**:

- `MatchWeekList.tsx:323-325`가 `match.competition ?? '프리미어리그'`로 미지정 시 텍스트를 "프리미어리그"로 보여준다 — `PredictWeekMatch` 타입 주석(`MatchWeekList.tsx:19`)도 "미지정 시 '프리미어리그'로 표시"라고 명시한다.
- 반면 `PredictionFlowClient`의 `MatchMeta`(`PredictionFlowClient.tsx:577`)와 `MatchdayHero`(`MatchdayHero.tsx:180` — `fixture.competitionName &&` 조건부라 아예 안 그림)는 별도 기본값이 없다.

즉 "대회명이 없을 때 프리미어리그로 간주"가 **MatchWeekList 하나에만 있는 관례**다. 색 매핑 함수가 null을 green으로 fallback하면, 같은 데이터(대회명 없음)를 두고 MatchWeekList는 텍스트로 "프리미어리그"라 말하면서 색은 green(기타 컵 대회)을 칠하는 모순이 생길 수 있다.

**두 선택지, 사람 확정 필요**:
- A안: `competitionColorBucket`이 null/undefined/빈 문자열을 violet(Premier League)으로 처리 — MatchWeekList의 기존 텍스트 관례와 일치.
- B안: 지금 제안대로 green fallback 유지 — intent.md 매핑 표의 "위 목록에 없는 새 값 = green"을 문자 그대로 null도 포함해 해석.

실제 프로덕션 데이터에서 `competition_name`이 비는 경우는 드물다(Fotmob 동기화가 항상 채움, `intent.md` L18) — 그래도 타입상 `string | null`이라(`lib/queries/fixtures.ts:46`) 함수 계약을 명시해야 한다.

---

## 2. `globals.css` 변경

### 2-1. Palette 블록에 `--p-yellow-*` 11개 추가

`frontend/src/app/globals.css:59`(`--p-neutral-*` 줄) 다음 줄에 8번째 팔레트 계열로 추가한다. 값은 `노란-팔레트-제안.md` 4번 표를 **그대로 복사**한다(재계산 금지):

```css
--p-yellow-50: #fffbcc; --p-yellow-100: #fff58e; --p-yellow-200: #fcea00; --p-yellow-300: #e8d700; --p-yellow-400: #cabb00; --p-yellow-500: #b0a300; --p-yellow-600: #998d00; --p-yellow-700: #7d7400; --p-yellow-800: #5c5500; --p-yellow-900: #393400; --p-yellow-950: #1f1c00;
```

### 2-2. 대회색 유틸리티 클래스 신설 (제안 — 클래스명은 plan 승인 때 사람 확정)

`design-brief.md` 7번: "새 `--sem-*` 토큰을 만들지 않는다", "클래스명·구현 위치는 개발자 재량". 하지만 **개발자 재량이 "컴포넌트 인라인"까지 자유롭다는 뜻은 아니다** — `frontend/src/components/design-foundation.test.mjs:277-324`("application source does not use arbitrary typography or hardcoded visual colors")가 `PREDICT_FILES`(`MatchdayHero.tsx`, `MatchWeekList.tsx`, `PredictionFlowClient.tsx`, `PredictionDone.tsx` 포함, `design-foundation.test.mjs:261-275`)에 대해 `bg-[#…]`뿐 아니라 **`bg-[var(...)]` 형태도 명시적으로 금지한다**(`design-foundation.test.mjs:320` 주석: "bg-[var(--c-*)]는 임의 hex가 아니라 CSS 변수 직접 참조라 위 hex 패턴에 안 걸렸다... 변수 참조도 함께 막는다"). 즉 컴포넌트에서 `bg-[var(--p-violet-700)]` 같은 Tailwind 임의값 클래스나 `style={{background: 'var(--p-violet-100)'}}` 인라인 스타일로 팔레트를 직접 참조하면 이 테스트가 걸리거나(전자), 기존 관례(`.spotlight-glow-brand*`/`.award-gold`가 전부 `globals.css` 유틸리티 클래스라는 선례, `globals.css:202-230`)에서 벗어난다.

**제안: `globals.css`의 `@layer utilities` 블록(`globals.css:202-230` 바로 뒤)에 새 유틸리티 클래스 9개를 추가하고, 컴포넌트는 클래스명 문자열만 참조한다.** 이건 `PredictionResult.tsx`의 `TIER_BADGE`/`PointsBadge`(`PredictionResult.tsx:416-448`)가 이미 쓰는 패턴 — `Record<버킷, 클래스명 문자열>` 룩업 후 `cn(badgeVariants({variant:'bare'}), 클래스명)` — 과 같은 형태다.

제안 클래스명(전부 제안, 사람 확정 필요):

**다크 글로우 3종** (`MatchdayHero`용, 값은 `design-brief.md` 2-3번 "다크 카드 강한 배경" 공식 그대로, 3색 공통):
```css
.competition-glow-violet {
  background:
    radial-gradient(250px at 0% 0%,   color-mix(in srgb, var(--p-violet-700) 15%, transparent) 0%, transparent 70%),
    radial-gradient(250px at 100% 0%, color-mix(in srgb, var(--p-violet-600) 15%, transparent) 0%, transparent 70%),
    var(--sem-bg-neutral-strong);
}
.competition-glow-green { /* 위와 동일 구조, --p-green-700/600 */ }
.competition-glow-yellow { /* 위와 동일 구조, --p-yellow-700/600 — 오렌지식 보정 없음(design-brief.md 4번) */ }
```

**라이트 wash 3종** (`MatchWeekList`의 `MatchInfoCard`용, 값은 `design-brief.md` 2-3번 "라이트 카드 약한 배경" 공식이되 **베이스를 카드에 맞게 교체** — `.spotlight-glow-brand`의 베이스는 `--sem-bg-surface`이지만 `MatchInfoCard`의 기존 베이스는 `bg-page`다(`MatchWeekList.tsx:317`, `MatchWeekList.tsx:291` 주석 "표면은... 항상 `bg-page` 한 색이다"). `design-brief.md` 2-3번 "베이스만 카드에 맞게"가 이 교체를 가리킨다):
```css
.competition-wash-violet {
  background:
    linear-gradient(to bottom,
      color-mix(in srgb, var(--p-violet-700) 8%, transparent) 0%,
      transparent 25%),
    var(--sem-bg-page);
}
.competition-wash-green { /* --p-green-700 8% */ }
.competition-wash-yellow { /* --p-yellow-700 8% */ }
```

**배지 3종** (`PredictionFlowClient`·`PredictionDone`용, 값은 `design-brief.md` 2-3번 배지 공식 — 100단계 배경 + 800단계 텍스트, 3색 공통):
```css
.competition-badge-violet { background: var(--p-violet-100); color: var(--p-violet-800); }
.competition-badge-green  { background: var(--p-green-100);  color: var(--p-green-800); }
.competition-badge-yellow { background: var(--p-yellow-100); color: var(--p-yellow-800); }
```

컴포넌트 쪽에서는 `competitionColorBucket()`이 반환한 `'violet'|'green'|'yellow'`를 `Record<CompetitionColorBucket, string>` 룩업(3개, 컴포넌트별)으로 클래스명에 매핑한다 — `TOON_TIER`(`shared.tsx:114-118`)·`TIER_BADGE`(`PredictionResult.tsx:416-420`)와 같은 패턴.

---

## 3. 컴포넌트별 변경

### 3-1. `MatchdayHero.tsx` — 카드 배경 전체 (다크)

현재(`MatchdayHero.tsx:163-179`):
```tsx
export function MatchdayHero({ fixture, href }: { fixture: MatchdayFixture; href?: string }) {
  const countdown = useCountdown(fixture.kickoffAt)
  const isUpcoming = !fixture.started && !fixture.finished
  const isLive = fixture.started && !fixture.finished
  ...
  return (
    <div className="spotlight-glow-brand-strong relative overflow-hidden rounded-lg px-4 pb-4 pt-5">
```

변경:
- `isUpcoming`/`isLive`는 그대로 둔다 — 카운트다운(`MatchdayHero.tsx:206`), "진행 중" 배지(`MatchdayHero.tsx:215-219`), CTA 버튼(`MatchdayHero.tsx:225-233`)이 여전히 이 값을 쓴다. **색 결정에만 안 쓴다**(design-brief.md 3-1번: "`isUpcoming`/`isLive`를 별도로 분기할 필요 없다"는 색 얘기다).
- 컨테이너 className에서 `spotlight-glow-brand-strong` 고정 문자열을 조건부로 교체:
  ```tsx
  const glowClass = !fixture.finished
    ? COMPETITION_GLOW[competitionColorBucket(fixture.competitionName)]
    : 'bg-neutral-strong'
  ...
  <div className={cn(glowClass, 'relative overflow-hidden rounded-lg px-4 pb-4 pt-5')}>
  ```
  (`cn` 유틸은 이미 `MatchWeekList.tsx:7`에서 쓰는 `@/lib/utils`의 `cn` — `MatchdayHero.tsx`에 아직 import가 없으면 추가한다.)
- `fixture.competitionName` 텍스트(`MatchdayHero.tsx:180-184`)는 그대로 둔다 — 색을 입히지 않는다(design-brief.md 3-1번).
- 종료 상태(`fixture.finished`)의 최우수 선수 카드(`award-gold`, `MatchdayHero.tsx:157` `RatingCard variant="award"`)는 이번 변경과 무관 — 손대지 않는다.

### 3-2. `MatchWeekList.tsx` — `WeekSessionCard` 글로우 삭제 + `MatchInfoCard` 배경 (라이트)

**`WeekSessionCard`** (`MatchWeekList.tsx:202-283`): `highlighted` 변수(`MatchWeekList.tsx:220`)와 그 분기(`MatchWeekList.tsx:225-230`의 `highlighted ? 'spotlight-glow-brand' : 'bg-surface'`, 정확히는 `MatchWeekList.tsx:229`)를 삭제하고 컨테이너를 항상 `bg-surface`로 고정한다:
```tsx
className={cn(
  'animate-enter rounded-lg border border-neutral-weak p-4',
  'bg-surface'
)}
```
`highlighted` 변수 자체도 미사용이 되므로 함께 삭제한다. (`intent.md` "시안 검토 후 추가 확정" — "예측 접수 중" 정보는 옆의 `weekBadge` `Badge`가 이미 담당하므로 정보 손실 없음.)

**`MatchInfoCard`** (`MatchWeekList.tsx:293-325`): `dimmed` prop은 그대로 받되(호출부 `MatchWeekList.tsx:257` `dimmed={isDimmed(week, match)}` 변경 없음), 카드 배경을 조건부로 바꾼다:
```tsx
const bgClass = !dimmed
  ? COMPETITION_WASH[competitionColorBucket(match.competition ?? undefined /* 또는 'Premier League' — 1-3번 확정 대기 */)]
  : 'bg-page'
...
<div className={cn('min-w-0 rounded-lg p-3 pb-5', bgClass)}>
```
(현재 `MatchWeekList.tsx:317`은 `<div className="min-w-0 rounded-lg bg-page p-3 pb-5">` 고정 — `bg-page`를 조건부로 뺀다.)

활성화 조건은 `!isDimmed(week, match)`(design-brief.md 3-2번, `intent.md` "design-brief 승인 결과" 3번 — `!match.locked`가 아니라 `isDimmed`). `isDimmed`는 이미 `MatchWeekList.tsx:139-141`에 정의돼 있고 변경 없음.

대회명 텍스트(`MatchWeekList.tsx:323-325`)는 색을 입히지 않는다(design-brief.md 3-2번) — 그대로 둔다. `match.competition ?? '프리미어리그'`도 텍스트 표시용으로는 변경 없음 — 색 버킷 판정용 인자만 1-3번 확정에 따라 결정한다.

### 3-3. `PredictionFlowClient.tsx` — `MatchMeta` 배지

현재(`PredictionFlowClient.tsx:573-584`):
```tsx
function MatchMeta({ weekNo, match }: { weekNo: number; match: MatchView }) {
  return (
    <div className="text-center">
      <p className="mb-1 text-label-2 font-medium text-neutral-muted">
        {match.competition} · {weekNo}라운드
      </p>
      ...
```

변경 — 대회명만 배지로 감싸고 라운드 숫자는 평문 유지(design-brief.md 3-3번):
```tsx
function MatchMeta({ weekNo, match }: { weekNo: number; match: MatchView }) {
  const bucket = competitionColorBucket(match.competition)
  return (
    <div className="text-center">
      <p className="mb-1 text-label-2 font-medium text-neutral-muted">
        <span className={cn(badgeVariants({ variant: 'bare' }), COMPETITION_BADGE[bucket])}>
          {match.competition}
        </span>{' '}
        · {weekNo}라운드
      </p>
      ...
```
활성화 조건 없음(design-brief.md 3-3번 — 이 컴포넌트에 들어오는 `pending`은 이미 상위에서 "제출 가능한 경기"만 필터링된 것, `app/predictions/[weekKey]/page.tsx:58`). `PredictionFlowClient.tsx`에 `badgeVariants` import가 아직 없으면 `@/components/primitives/badge`에서 추가한다.

### 3-4. `PredictionDone.tsx` — 경기별 카드 헤더 배지 (신규 추가 — 기존에 없던 표시)

**실측 결과, design-brief.md 5번의 전제와 다른 점 하나가 있다**: `PredictionDone.tsx`는 현재 대회명을 **어디에도 표시하지 않는다**(`grep competition PredictionDone.tsx` 결과 0건). design-brief.md 5번은 "PredictionFlowClient에서 쓴 배지를 PredictionDone에도 그대로 적용"이라 쓰지만, `PredictionFlowClient`는 기존 텍스트를 배지로 *감싸는* 것이고 `PredictionDone`은 배지를 *새로 추가*하는 것이다. 데이터는 이미 있다 — `PredictionDone`의 `week.matches`는 `WeekSession = WeekGroup`의 `matches: MatchView[]`(`week.ts:71,75`)라 `PredictionFlowClient`와 동일한 `MatchView` 타입, 즉 `match.competition`을 그대로 쓸 수 있다(추가 쿼리/prop 불필요).

대상 위치는 design-brief.md가 지목한 대로 제출된 경기 카드(`PredictionDone.tsx:131`, `submittedMatches.map` 안):
```tsx
<div className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
  <p className="mb-3 text-body-2-normal font-semibold">경기 예측</p>
  ...
```
변경 — "경기 예측" 타이틀 줄에 배지를 추가(정확한 배치는 `plan.md` 단계에서 시안 없이 코드로 확정 — design-brief.md에 픽셀 단위 레이아웃 지시가 없어 "타이틀 옆" 정도로만 제안):
```tsx
<div className="rounded-lg border border-neutral-weak bg-surface px-4 py-5">
  <div className="mb-3 flex items-center gap-2">
    <p className="text-body-2-normal font-semibold">경기 예측</p>
    <span className={cn(badgeVariants({ variant: 'bare' }), COMPETITION_BADGE[competitionColorBucket(match.competition)])}>
      {match.competition}
    </span>
  </div>
  ...
```

**미제출(마감) 카드는 스코프 밖 — 근거 미확인, 사람 확인 필요.** design-brief.md 5번이 인용한 줄 번호(`L131`)는 정확히 `submittedMatches` 카드 하나만 가리킨다. `missedMatches`(마감돼서 제출 못한 경기, `PredictionDone.tsx:104-118`, 헤더 `PredictionDone.tsx:111`)에도 같은 배지를 붙일지는 design-brief에 명시가 없다 — "제출 시점까지 진행 중이던 예측 세션"이라는 5번의 연속성 근거가 "제출을 못 한" 경기에도 적용되는지 불분명하다. **본 스펙은 `missedMatches` 카드를 범위에 포함하지 않는다** — 포함 여부는 사람 확정 필요.

### 3-5. 공통 — 룩업 테이블 위치

`COMPETITION_GLOW`(`MatchdayHero.tsx` 전용) · `COMPETITION_WASH`(`MatchWeekList.tsx` 전용) · `COMPETITION_BADGE`(`PredictionFlowClient.tsx`·`PredictionDone.tsx` 공용)는 각 컴포넌트 파일 상단에 모듈 스코프 `const`로 둘지, `competitionColor.ts`에 함께 둘지도 제안 사항이다. `TOON_TIER`(`shared.tsx:114`)·`TIER_BADGE`(`PredictionResult.tsx:416`) 선례는 전부 **사용하는 컴포넌트 파일 안**에 두는 방식이라 이를 따르는 걸 제안하되, `COMPETITION_BADGE`는 두 파일이 공유하므로 `competitionColor.ts`(1-2번)에 함께 두는 게 중복을 피한다 — 이 부분도 plan 승인 때 확정.

---

## 4. `.spotlight-glow-brand` / `.spotlight-glow-brand-strong` 삭제 여부 — 실측 결과

`grep -rn "className.*spotlight-glow-brand" frontend/src`(문자열 검색, `.tsx` 실사용만) 결과:

**`.spotlight-glow-brand-strong`** (다크 변형) — **삭제 불가, 사용처 3곳 남음**:
- `MatchdayHero.tsx:179` — 이번 변경으로 삭제됨(3-1번)
- `PredictionResult.tsx:200` — **스코프 밖, 그대로 유지**
- `PredictionResult.tsx:243` — **스코프 밖, 그대로 유지**

즉 `MatchdayHero`의 사용을 걷어내도 `PredictionResult.tsx` 2곳이 이 클래스를 계속 쓰므로 `globals.css`의 `.spotlight-glow-brand-strong` 정의(`globals.css:216-221`) 자체는 **지울 수 없다.**

**`.spotlight-glow-brand`** (라이트 변형) — **실사용 1건, 이번 변경으로 0건이 된다**:
- `MatchWeekList.tsx:229` — 유일한 실사용, 3-2번에서 삭제됨

이번 변경 후 애플리케이션 코드(`.tsx`) 안에서 `.spotlight-glow-brand`(non-strong) 실사용은 0건이 된다. **삭제 가능하지만 이번 범위에 포함할지는 사람 확정 필요** — 포함한다면 `globals.css:202-208` 정의도 함께 지운다.

**참고(범위 밖 발견)**: Storybook 쪽에 `.spotlight-glow-brand`를 실제로 렌더링/설명하는 문서가 있다 — `storybook/foundations/Gradient.mdx:25` (데모), `storybook/contents/MatchWeekList.mdx:48-54`(사용처 설명), `storybook/contents/MatchWeekList.stories.tsx:110,273`(주석). 위 유틸리티를 삭제하기로 확정하면 이 Storybook 문서들도 실제와 어긋나게 된다 — **이번 feature-spec/plan의 코드 목록(오케스트레이터 지정)에 Storybook 파일이 없어 본 스펙 범위 밖으로 둔다.** 삭제를 확정할 경우 Storybook 갱신이 별도 후속 작업으로 필요하다는 점만 여기 기록한다.

---

## 5. 테스트 영향

### 5-1. `design-foundation.test.mjs` 통과 방법

- 2번에서 정한 대로 팔레트 원시값은 컴포넌트 안에서 `bg-[var(...)]`/인라인 `style`로 직접 참조하지 않고, `globals.css`의 새 유틸리티 클래스명 문자열만 컴포넌트에 남긴다 — `application source does not use arbitrary typography or hardcoded visual colors`(`design-foundation.test.mjs:277-324`, `PREDICT_FILES` 대상)의 `bg-\[#|bg-\[rgba|bg-\[var\(|...` 금지 패턴(`:320`)에 걸리지 않는다.
- `prediction screens do not fall back to legacy color tokens`(`design-foundation.test.mjs:484-507`)는 `black|white|primary|gray-N|...` 구세대 토큰만 금지한다 — 새 `competition-glow-*`/`competition-wash-*`/`competition-badge-*` 클래스명은 이 금지 목록과 무관해 영향 없음.
- `retired legacy color class names are gone repo-wide`(`:385-458`)·`legacy flat color tokens are gone repo-wide`(`:460-482`)도 새 클래스명이 그 금지 목록에 없어 영향 없음.
- **주의**: `globals.css`에 `--p-yellow-*` 추가는 "Palette" 섹션 확장일 뿐이고, 이 테스트 파일 어디에도 팔레트 계열 개수를 하드코딩해 세는 단정문은 없다(직접 읽어 확인함, `design-foundation.test.mjs` 전문 508줄) — 팔레트 추가 자체로 깨지는 기존 테스트는 없다.

### 5-2. 깨질 가능성이 있는 기존 predict 테스트

`ls`로 확인한 결과 `components/composition/predict/` 아래 테스트는 `prediction-flow-action-bar.test.mjs`·`score-input.test.mjs` 2개뿐이고, 둘 다 `competition` 문자열을 검사하지 않는다(grep 0건, 직접 확인함) — **이번 변경으로 깨질 기존 predict 테스트는 없다.**

### 5-3. 새로 추가할 테스트 — 매핑 함수 단위 테스트 (최소)

`frontend/src/lib/predictions/competitionColor.test.mjs`(제안, 1-2번 파일명 확정에 종속) — `node --test` 스타일로 기존 `week.test.mjs`와 같은 폴더 관례를 따른다:
- `'Premier League'` → `'violet'`
- `'Club Friendlies'` → `'yellow'`
- `'EFL Cup'`, `'FA Cup'`, `'Europa League'`, `'Europa Conference League'`, `'Champions League'` 각각 → `'green'`
- 목록에 없는 임의 문자열(예: `'Some New Cup'`) → `'green'` (fallback 케이스)
- null/undefined/빈 문자열 → 1-3번 확정 값(A안이면 `'violet'`, B안이면 `'green'`)

이 테스트는 `npm test`(src 전체 `*.test.mjs`)에 자동 포함되므로 별도 `package.json` script 추가는 불필요(CLAUDE.md "Commands" — 개별 script는 13개 중 7개만 커버, 나머지는 `npm test`로만 돈다는 것과 같은 방식).

---

## 6. mock 모드 확인 방법

`MOCK_FIXTURES`(`frontend/src/lib/mock/data.ts:477-487`)에는 `'Premier League'`와 `'EFL Cup'`만 있고 `'Club Friendlies'`(yellow)가 없다 — 실측 확인함:
```
mockFixture(9001, ..., { competition: 'Premier League', ... })  // ×5
mockFixture(9006, ..., { competition: 'EFL Cup', ... })         // ×1
```
즉 mock 모드에서 화면을 열어봐도 violet·green 두 색만 눈으로 확인되고 **yellow(친선경기)는 mock 데이터를 추가하지 않는 한 확인 불가**하다.

**사람 확정 필요**: mock에 `'Club Friendlies'` 픽스처 1건을 추가할지, 이번 범위에 포함할지. 포함한다면 `mockFixture(...)` 한 줄 추가로 충분하다(기존 패턴과 동일한 형태, `data.ts:478-486` 참고).

CLAUDE.md 원칙 그대로: **mock 모드에서만 확인하고 끝내지 않는다** — 실제 Supabase 연동(스테이징 또는 프리뷰 배포)에서 `competition_name` 실값(Fotmob 동기화 결과)으로도 3색이 의도대로 나오는지 별도로 확인해야 한다. mock 모드는 `NEXT_PUBLIC_SUPABASE_URL`이 없거나 `http`로 시작하지 않을 때 활성화된다(`frontend/src/lib/config.ts` 기준, CLAUDE.md "Architecture").

---

## 7. 근거 미확인 항목 — 전부 사람 확정 완료 (2026-09-05)

**아래 "확정" 열이 최종값이다.** 위 1~6절의 본문 중 "확정 대기/제안/범위 밖"으로 적힌 부분은 이 표가 덮어쓴다 — 실행 단위는 `plan.md`(0번 표·각 단계에 확정값 반영 완료)를 따른다.

| # | 항목 | 확정 | 관련 절 |
|---|---|---|---|
| 1 | 매핑 함수/파일명 | **제안대로** `competitionColorBucket` / `frontend/src/lib/predictions/competitionColor.ts` | 1-2 |
| 2 | null/undefined/빈 문자열 처리 | **B안: green** | 1-3 |
| 2b | (파생) `MatchWeekList.tsx:323-325`의 텍스트 기본값 `?? '프리미어리그'` | **삭제** — null이면 대회명 `<p>` 미렌더(MatchdayHero의 `competitionName &&` 패턴). 3-2절 "텍스트 표시용으로는 변경 없음"은 이 확정으로 **무효** | 3-2 |
| 3 | 유틸리티 클래스명 9개 | **제안대로** `.competition-{glow,wash,badge}-{violet,green,yellow}` | 2-2 |
| 4 | 룩업 테이블 위치 | **`competitionColor.ts`에 3개 전부 공용 export** (3-5절의 "컴포넌트별" 제안은 무효) | 3-5 |
| 5 | `.spotlight-glow-brand`(non-strong) 삭제 | **이번 범위에 포함해 삭제** | 4 |
| 6 | Storybook 3파일 갱신 | **이번 범위에 포함** (4절 "범위 밖" 표기 무효 — `plan.md` ⑥) | 4 |
| 7 | `PredictionDone` `missedMatches` 카드 배지 | **적용함** (3-4절 "범위 밖" 표기 무효) | 3-4 |
| 8 | mock에 `'Club Friendlies'` 픽스처 | **추가함** (`plan.md` ②) | 6 |
| 9 | 이슈·브랜치 | **Linear 이슈 1개 + 브랜치 1개**, origin/main 기준 worktree에서 작업 | — |

---

## 참고 자료

- `vault/02_프로젝트/대회별로 색상 다르게/intent.md`
- `vault/02_프로젝트/대회별로 색상 다르게/design-brief.md`
- `vault/02_프로젝트/대회별로 색상 다르게/노란-팔레트-제안.md`
- `frontend/src/components/composition/predict/MatchdayHero.tsx` (L163-236)
- `frontend/src/components/composition/predict/MatchWeekList.tsx` (L1-330)
- `frontend/src/components/composition/predict/PredictionFlowClient.tsx` (L565-589)
- `frontend/src/components/composition/predict/PredictionDone.tsx` (L1-150)
- `frontend/src/components/composition/predict/PredictionResult.tsx` (L200,243 spotlight-glow-brand-strong 사용, L405-448 TIER_BADGE/PointsBadge 패턴)
- `frontend/src/components/composition/predict/shared.tsx` (L109-118 TOON_TIER 패턴)
- `frontend/src/components/primitives/badge.tsx` (badgeVariants, bare variant)
- `frontend/src/app/globals.css` (L53-59 Palette, L202-230 다크/색 면 직접 참조 예외)
- `frontend/tailwind.config.ts` (L49-134)
- `frontend/src/components/design-foundation.test.mjs` (전문 508줄 확인)
- `frontend/src/lib/predictions/week.ts` (L41-75 MatchView/WeekGroup/WeekSession, L125-128 isMatchLocked, L151-165 toMatchView, L260-262 submittableMatches, L315-325)
- `frontend/src/lib/queries/fixtures.ts` (L46, L100-109)
- `frontend/src/lib/mock/data.ts` (L477-487 MOCK_FIXTURES)
