# plan — 대회별로 색상 다르게

작성: 2026-09-05 · 작성자: developer 에이전트
입력: `feature-spec.md`(이 문서의 유일한 근거) · `design-brief.md` · `노란-팔레트-제안.md`
승인권자: 사용자 (프로덕트 디자이너) — **이 문서는 사람 승인 전까지 구현(코드 수정)을 시작하지 않는다.**

---

## 0. 승인 전 확정 필요 항목 (이 표만 보고 결정하면 됨)

`feature-spec.md` 7번 표와 동일 — 이 표의 결정이 아래 단계별 코드에 그대로 들어간다.

**전부 사람 확정 완료 (2026-09-05). 아래 "확정" 열이 최종값이다 — 이하 단계는 이 값으로 실행한다.**

| # | 항목 | 확정 | 근거(`feature-spec.md`) |
|---|---|---|---|
| 1 | 매핑 함수/파일 이름 | **제안대로** — `competitionColorBucket` / `frontend/src/lib/predictions/competitionColor.ts` | 1-2 |
| 2 | 매핑 함수의 null/undefined/빈 문자열 처리 | **B안: green**(기타 컵 대회 fallback, intent.md 표 문자 그대로) | 1-3 |
| 2b | (2번 파생) MatchWeekList의 텍스트 기본값 `match.competition ?? '프리미어리그'` | **삭제** — null이면 대회명 텍스트 미표시(MatchdayHero·FlowClient와 동일 동작). 텍스트 PL/색 green 불일치 방지 | 3-2 |
| 3 | 유틸리티 클래스명 9개 | **제안대로** — `.competition-glow-{violet,green,yellow}` / `.competition-wash-*` / `.competition-badge-*` | 2-2 |
| 4 | 룩업 테이블(`COMPETITION_GLOW`/`WASH`/`BADGE`) 위치 | **`competitionColor.ts`에 3개 전부 공용으로 모아 export** | 3-5 |
| 5 | `.spotlight-glow-brand`(non-strong) 삭제 여부 | **이번 범위에 포함해 삭제** (⑥ 실행) | 4 |
| 6 | Storybook 문서 갱신 | **이번 범위에 포함** (⑥에서 3파일 갱신, `build-storybook` 검증 포함) | 4 |
| 7 | `PredictionDone`의 `missedMatches`(마감) 카드에도 배지 적용 | **적용함** — `submittedMatches`·`missedMatches` 둘 다 | 3-4 |
| 8 | mock 데이터에 `'Club Friendlies'` 픽스처 추가 | **추가함** (②에 포함) | 6 |
| 9 | 이슈·브랜치 단위 | **Linear 이슈 1개(전체 기능) + 브랜치 1개** — Linear 자동 생성 브랜치명 사용, PR 1개 | — |

---

## 1. 단계 순서 및 의존관계

```
① globals.css (팔레트 + 유틸리티)          — 독립, 다른 모든 단계의 전제
② competitionColor.ts + 단위 테스트         — 독립 (①과 병렬 가능)
③ MatchdayHero.tsx                         — ①②에 의존
④ MatchWeekList.tsx                        — ①②에 의존, ③과 병렬 가능(다른 파일)
⑤ PredictionFlowClient.tsx + PredictionDone.tsx — ①②에 의존, ③④와 병렬 가능(다른 파일)
⑥ (0번 5/6이 "삭제"면) globals.css .spotlight-glow-brand 삭제 + Storybook 갱신 — ④ 완료 후(같은 클래스를 참조하던 곳이 없어야 안전)
⑦ 전체 검증 (test/lint/build)              — ①~⑥ 전부 완료 후, 반드시 마지막
⑧ mock·실연동 화면 확인                     — ⑦ 통과 후
```

①②는 서로 다른 파일이라 병렬 가능. ③④⑤도 서로 다른 컴포넌트 파일이지만 **①②가 먼저 끝나야** import할 게 생긴다 — ①②를 먼저 완료(같은 에이전트가 이어서 하거나, 순차 실행)한 뒤 ③④⑤를 병렬로 띄운다.

---

## ① globals.css — 팔레트 + 유틸리티 클래스

**대상 파일**: `frontend/src/app/globals.css`

**작업**:
1. `--p-neutral-*` 줄(`globals.css:59`) 바로 다음 줄에 `--p-yellow-*` 11개를 추가한다. 값은 `노란-팔레트-제안.md` 4번을 그대로 복사(재계산 금지):
   ```css
   --p-yellow-50: #fffbcc; --p-yellow-100: #fff58e; --p-yellow-200: #fcea00; --p-yellow-300: #e8d700; --p-yellow-400: #cabb00; --p-yellow-500: #b0a300; --p-yellow-600: #998d00; --p-yellow-700: #7d7400; --p-yellow-800: #5c5500; --p-yellow-900: #393400; --p-yellow-950: #1f1c00;
   ```
2. `@layer utilities` 블록 안, `.award-gold` 정의(`globals.css:228-230`) 바로 뒤에 새 유틸리티 9개를 추가한다(클래스명은 0번 표 3번 확정값 — 기본값 `competition-glow/wash/badge-{violet,green,yellow}`로 아래 작성):
   ```css
   /* 대회색 다크 글로우 3종 — MatchdayHero 전용. spotlight-glow-brand-strong과 같은
      지오메트리(코너 250px radial 2겹, 700/600단계 각 15%)를 색만 바꿔 재사용한다.
      노랑도 예외 없이 같은 공식(design-brief.md 4번, 오렌지식 보정 폐기). */
   .competition-glow-violet {
     background:
       radial-gradient(250px at 0% 0%,   color-mix(in srgb, var(--p-violet-700) 15%, transparent) 0%, transparent 70%),
       radial-gradient(250px at 100% 0%, color-mix(in srgb, var(--p-violet-600) 15%, transparent) 0%, transparent 70%),
       var(--sem-bg-neutral-strong);
   }
   .competition-glow-green {
     background:
       radial-gradient(250px at 0% 0%,   color-mix(in srgb, var(--p-green-700) 15%, transparent) 0%, transparent 70%),
       radial-gradient(250px at 100% 0%, color-mix(in srgb, var(--p-green-600) 15%, transparent) 0%, transparent 70%),
       var(--sem-bg-neutral-strong);
   }
   .competition-glow-yellow {
     background:
       radial-gradient(250px at 0% 0%,   color-mix(in srgb, var(--p-yellow-700) 15%, transparent) 0%, transparent 70%),
       radial-gradient(250px at 100% 0%, color-mix(in srgb, var(--p-yellow-600) 15%, transparent) 0%, transparent 70%),
       var(--sem-bg-neutral-strong);
   }

   /* 대회색 라이트 wash 3종 — MatchWeekList의 MatchInfoCard 전용. spotlight-glow-brand와
      같은 지오메트리(세로 linear, 25%에서 소멸)이되 베이스는 bg-page(카드 기존 베이스). */
   .competition-wash-violet {
     background:
       linear-gradient(to bottom, color-mix(in srgb, var(--p-violet-700) 8%, transparent) 0%, transparent 25%),
       var(--sem-bg-page);
   }
   .competition-wash-green {
     background:
       linear-gradient(to bottom, color-mix(in srgb, var(--p-green-700) 8%, transparent) 0%, transparent 25%),
       var(--sem-bg-page);
   }
   .competition-wash-yellow {
     background:
       linear-gradient(to bottom, color-mix(in srgb, var(--p-yellow-700) 8%, transparent) 0%, transparent 25%),
       var(--sem-bg-page);
   }

   /* 대회색 배지 3종 — PredictionFlowClient·PredictionDone 공용. 100단계 배경 + 800단계
      텍스트(design-brief.md 2-3번, 3색 공통 대비 실측 완료: 7.565/6.723/6.790, 전부 AA 여유 통과). */
   .competition-badge-violet { background: var(--p-violet-100); color: var(--p-violet-800); }
   .competition-badge-green  { background: var(--p-green-100);  color: var(--p-green-800); }
   .competition-badge-yellow { background: var(--p-yellow-100); color: var(--p-yellow-800); }
   ```

**정합 기준**: `feature-spec.md` 2번. 값은 `노란-팔레트-제안.md` 4번(팔레트)·`design-brief.md` 2-3번(공식) 그대로이므로 재계산하지 않는다.

**통과시킬 테스트**: 이 단계 자체는 아직 아무 컴포넌트도 새 클래스를 참조하지 않으므로 기존 `npm test` 전체가 그대로 통과해야 한다(회귀 없음 확인용). `design-foundation.test.mjs`의 "retired legacy color tokens stay deleted"(팔레트 블록 구조를 일부 검사)가 영향받지 않는지 특히 확인 — 이 테스트는 계열 개수를 세지 않으므로(feature-spec.md 5-1) 통과해야 정상이다.

---

## ② `competitionColor.ts` + 단위 테스트

**대상 파일(신규)**: `frontend/src/lib/predictions/competitionColor.ts`, `frontend/src/lib/predictions/competitionColor.test.mjs`

**작업** — `frontend/src/lib/predictions/week.ts:1-4`와 같은 스타일(순수 함수, DB 접근 없음):
```ts
// frontend/src/lib/predictions/competitionColor.ts
/**
 * fixtures.competition_name 원문 문자열 → 대회색 버킷 (순수 함수, DB 접근 없음).
 * Premier League 외 컵 대회(EFL Cup/FA Cup/Europa League/Europa Conference League/
 * Champions League)와 목록에 없는 새 값은 전부 green(기타 컵 대회) fallback이다.
 */
export type CompetitionColorBucket = 'violet' | 'green' | 'yellow'

const VIOLET_COMPETITIONS = new Set(['Premier League'])
const YELLOW_COMPETITIONS = new Set(['Club Friendlies'])

export function competitionColorBucket(name: string | null | undefined): CompetitionColorBucket {
  if (name && VIOLET_COMPETITIONS.has(name)) return 'violet'
  if (name && YELLOW_COMPETITIONS.has(name)) return 'yellow'
  return 'green'
}
```
**확정(0번 표 2번 = B안)**: 위 코드 그대로 — null/undefined/빈 문자열은 `'green'`. 별도 분기 추가하지 않는다.

**확정(0번 표 4번 = 공용)**: 같은 파일에 룩업 3개를 전부 export한다:
```ts
export const COMPETITION_GLOW: Record<CompetitionColorBucket, string> = {
  violet: 'competition-glow-violet', green: 'competition-glow-green', yellow: 'competition-glow-yellow',
}
export const COMPETITION_WASH: Record<CompetitionColorBucket, string> = {
  violet: 'competition-wash-violet', green: 'competition-wash-green', yellow: 'competition-wash-yellow',
}
export const COMPETITION_BADGE: Record<CompetitionColorBucket, string> = {
  violet: 'competition-badge-violet', green: 'competition-badge-green', yellow: 'competition-badge-yellow',
}
```
③④⑤는 이걸 import만 한다(컴포넌트 파일에 룩업을 다시 정의하지 않는다).

**추가 작업(0번 표 8번 = 추가함)** — 대상 파일 `frontend/src/lib/mock/data.ts`, `MOCK_FIXTURES` 배열(현재 `data.ts:477-487`, 9001~9007) 끝에 친선경기 1건 추가:
```ts
  // 대회색 확인용 — 유일한 'Club Friendlies'(yellow). 색이 켜지려면 open 주차(첫 킥오프 7일 이내, 미잠금)에 들어가야 한다.
  mockFixture(9008, { id: 8564, name: 'AC Milan' }, { days: 5, isHome: false, competition: 'Club Friendlies' }),
```
`fixture_id`/상대팀 `id`는 mock 전용 임의값(기존 9001~9007 패턴 따름). `days`는 실행 시 `/predictions` 목록에서 이 경기가 **열린 주차에 wash가 켜진 상태**로 보이는지 확인하고, 다른 주에 묶이거나 잠기면 값을 조정한다(목적은 yellow 육안 확인). 기존 mock 테스트(`npm test`)가 fixture 개수를 단정하는지 실행으로 확인 — 깨지면 그 단정문을 새 개수로 갱신(테스트 삭제 금지, CLAUDE.md 규칙).

**단위 테스트** (`node --test` 스타일, 기존 `week.test.mjs` 형식 참고):
```js
import assert from 'node:assert/strict'
import test from 'node:test'
import { competitionColorBucket } from './competitionColor.ts'

test('Premier League → violet', () => {
  assert.equal(competitionColorBucket('Premier League'), 'violet')
})
test('Club Friendlies → yellow', () => {
  assert.equal(competitionColorBucket('Club Friendlies'), 'yellow')
})
test('알려진 컵 대회 5종 → green', () => {
  for (const name of ['EFL Cup', 'FA Cup', 'Europa League', 'Europa Conference League', 'Champions League']) {
    assert.equal(competitionColorBucket(name), 'green')
  }
})
test('목록에 없는 새 값 → green (fallback)', () => {
  assert.equal(competitionColorBucket('Some New Cup'), 'green')
})
test('null/undefined/빈 문자열 → green (확정 B안)', () => {
  assert.equal(competitionColorBucket(null), 'green')
  assert.equal(competitionColorBucket(undefined), 'green')
  assert.equal(competitionColorBucket(''), 'green')
})
```

**정합 기준**: `feature-spec.md` 1번, 5-3번.

**통과시킬 테스트**: 이 새 테스트 파일 자체(`node --test frontend/src/lib/predictions/competitionColor.test.mjs` 또는 `npm test`에 포함되는지 확인). 기존 `week.test.mjs` 등 인접 테스트는 이 단계에서 건드리지 않으므로 영향 없음.

---

## ③ `MatchdayHero.tsx`

**전제**: ①②완료.

**대상 파일**: `frontend/src/components/composition/predict/MatchdayHero.tsx`

**작업**:
1. import 추가: `competitionColorBucket`, `COMPETITION_GLOW`(둘 다 from `@/lib/predictions/competitionColor`), `cn`(from `@/lib/utils`, 아직 없으면).
2. (확정: 룩업은 `competitionColor.ts` 공용 — 이 파일에 다시 정의하지 않는다.)
3. `MatchdayHero` 함수 본문(`MatchdayHero.tsx:163-179` 부근)에서 컨테이너 className을 조건부로 바꾼다:
   ```tsx
   const glowClass = !fixture.finished
     ? COMPETITION_GLOW[competitionColorBucket(fixture.competitionName)]
     : 'bg-neutral-strong'
   ...
   return (
     <div className={cn(glowClass, 'relative overflow-hidden rounded-lg px-4 pb-4 pt-5')}>
   ```
   기존 `spotlight-glow-brand-strong` 리터럴 문자열은 삭제한다. `isUpcoming`/`isLive` 변수·용도(카운트다운·"진행 중" 배지·CTA 버튼)는 그대로 둔다 — 삭제하지 않는다.
4. `fixture.competitionName` 텍스트 표시(`MatchdayHero.tsx:180-184`)는 변경 없음.

**정합 기준**: `feature-spec.md` 3-1번.

**통과시킬 테스트**: `npm test`(design-foundation.test.mjs 포함) — 특히 `PREDICT_FILES` 대상 임의값 금지 테스트(`design-foundation.test.mjs:277-324`)가 이 파일에 새로 걸리지 않는지 확인(클래스명은 리터럴 문자열이라 문제 없어야 함). Storybook에 `MatchdayHero.stories.tsx`가 있다면 그 스토리가 깨지는지 별도 확인(이 목록엔 없었으나 존재 시 발견 즉시 보고).

---

## ④ `MatchWeekList.tsx`

**전제**: ①②완료. ③과 병렬 가능(다른 파일).

**대상 파일**: `frontend/src/components/composition/predict/MatchWeekList.tsx`

**작업**:
1. import 추가: `competitionColorBucket`, `COMPETITION_WASH`(둘 다 from `@/lib/predictions/competitionColor`).
2. `WeekSessionCard`(`MatchWeekList.tsx:202-283`)에서:
   - `highlighted` 변수(`MatchWeekList.tsx:220`) 삭제.
   - className의 `highlighted ? 'spotlight-glow-brand' : 'bg-surface'` 분기(`MatchWeekList.tsx:225-230`)를 `'bg-surface'` 고정으로 교체:
     ```tsx
     className={cn(
       'animate-enter rounded-lg border border-neutral-weak p-4',
       'bg-surface'
     )}
     ```
     (분기가 사라지므로 `cn()`의 두 번째 인자를 문자열로 합쳐도 무방 — 형태는 개발자 재량.)
3. `MatchInfoCard`(`MatchWeekList.tsx:293-325`)에서:
   - (확정: 룩업은 `competitionColor.ts`에서 import — 이 파일에 다시 정의하지 않는다.)
   - 컨테이너 배경을 조건부로 바꾼다:
     ```tsx
     const bgClass = !dimmed
       ? COMPETITION_WASH[competitionColorBucket(match.competition)]
       : 'bg-page'
     ...
     <div className={cn('min-w-0 rounded-lg p-3 pb-5', bgClass)}>
     ```
     기존 `bg-page` 고정 리터럴(`MatchWeekList.tsx:317`)은 삭제하고 조건부로 대체한다. `match.competition`이 null/undefined면 `competitionColorBucket`이 `'green'`을 돌려준다(확정 B안) — 여기서 `??`로 기본값을 끼우지 않는다.
4. **대회명 텍스트(`MatchWeekList.tsx:323-325`) — 기본값 삭제(확정 2b)**: 기존 `{match.competition ?? '프리미어리그'}`에서 `?? '프리미어리그'`를 제거하고, `match.competition`이 없으면 그 `<p>` 자체를 렌더하지 않는다(`{match.competition && <p ...>{match.competition}</p>}` 형태 — MatchdayHero.tsx:180-183의 `competitionName &&` 패턴과 동일). 텍스트 색 클래스는 변경 없음. 이 문자열(`'프리미어리그'`)을 단정하는 테스트가 있는지 `npm test`로 확인 — 있으면 단정문을 새 구조로 갱신(삭제 금지).

**정합 기준**: `feature-spec.md` 3-2번.

**통과시킬 테스트**: `npm test`. 특히 `MatchWeekList.tsx`를 문자열 검사하는 테스트가 있는지 재확인(이번 조사에서 `components/composition/predict/` 아래 별도 `*.test.mjs`엔 없었으나, `design-foundation.test.mjs`의 `PREDICT_FILES` 관련 단정문은 이 파일도 대상이라 다시 통과 확인 필요).

---

## ⑤ `PredictionFlowClient.tsx` + `PredictionDone.tsx`

**전제**: ①②완료. ③④와 병렬 가능(다른 파일). 두 파일이 `COMPETITION_BADGE`를 공유하므로 이 단계는 두 파일을 **같은 에이전트**가 순차로 처리하는 걸 권장(0번 표 4번이 "공용 competitionColor.ts"로 확정되면 이 제약은 사라짐 — 각 파일이 독립적으로 import만 하면 되므로 그때는 완전 병렬 가능).

**대상 파일**: `frontend/src/components/composition/predict/PredictionFlowClient.tsx`, `frontend/src/components/composition/predict/PredictionDone.tsx`

**PredictionFlowClient.tsx 작업**:
1. import 추가: `competitionColorBucket`, `badgeVariants`(from `@/components/primitives/badge`, 아직 없으면), `cn`(있는지 확인).
2. `MatchMeta`(`PredictionFlowClient.tsx:573-584`) 수정:
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
         <p className="text-label-2 text-neutral-muted">
           {match.kickoff} ({match.isHome ? '홈' : '원정'}) {match.kickoffTime}
         </p>
       </div>
     )
   }
   ```

**PredictionDone.tsx 작업**:
1. import 추가: `competitionColorBucket`, `cn`(이미 `PredictionDone.tsx:16`에 있음), `badgeVariants`(이미 `PredictionDone.tsx:17`에 있음 — 추가 불필요).
2. `submittedMatches.map` 안(`PredictionDone.tsx:120-131` 부근)에서 카드 헤더에 배지 추가:
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
   기존 `<p className="mb-3 text-body-2-normal font-semibold">경기 예측</p>` 한 줄을 위 `<div>` 블록으로 교체한다.
3. **확정(0번 표 7번 = 적용함)**: `missedMatches.map` 안(`PredictionDone.tsx:104-118`)의 헤더(`PredictionDone.tsx:111` `<p className="mb-3 text-body-2-normal font-semibold">경기 예측</p>`)에도 2번과 **동일한** `<div>` 헤더 블록을 적용한다 — 두 카드 타입의 헤더 마크업이 같아야 한다.

**COMPETITION_BADGE 룩업**: 확정(0번 표 4번) — `competitionColor.ts`에서 import. 두 파일 어디에도 다시 정의하지 않는다. 이 제약이 사라졌으므로 PredictionFlowClient.tsx와 PredictionDone.tsx는 **서로 다른 에이전트가 병렬로** 처리해도 된다.

**정합 기준**: `feature-spec.md` 3-3번, 3-4번.

**통과시킬 테스트**: `npm test`. `prediction-flow-action-bar.test.mjs`·`score-input.test.mjs`는 `competition` 문자열을 검사하지 않으므로(feature-spec.md 5-2번 실측) 영향 없이 통과해야 정상 — 실패하면 이 변경이 그 테스트의 다른 전제를 건드린 것이니 즉시 원인 확인.

---

## ⑥ `.spotlight-glow-brand` 삭제 + Storybook 갱신 (확정: 실행, Storybook 포함)

**전제**: ④ 완료 (④가 이 클래스의 유일한 실사용을 없앤다). 실행 직전 `grep -rn "spotlight-glow-brand[^-]" frontend/src`로 실사용 0건을 다시 확인한다 — `-strong`은 PredictionResult.tsx에서 살아있으므로 **절대 건드리지 않는다**.

**대상 파일**: `frontend/src/app/globals.css`(`.spotlight-glow-brand` 정의, `globals.css:202-208`), `frontend/src/storybook/foundations/Gradient.mdx`, `frontend/src/storybook/contents/MatchWeekList.mdx`, `frontend/src/storybook/contents/MatchWeekList.stories.tsx`.

**작업**: `globals.css`에서 `.spotlight-glow-brand` 블록(`-strong` 아닌 쪽만) 삭제. 위 3개 Storybook 파일에서 이 유틸리티를 설명/렌더링하는 부분을 제거한다 — `Gradient.mdx`는 남은 `.spotlight-glow-brand-strong`·`.award-gold`와 **새 `.competition-*` 9종**을 같은 형식으로 문서화하는 쪽으로 갱신(기존 항목 설명 문체 그대로 따름, 새 문구 발명 금지 — 설명은 design-brief.md 2-3번 문장을 그대로 옮긴다). `MatchWeekList.mdx`/`.stories.tsx`는 "open 주차 글로우" 서술/스토리를 제거하고, 대신 대회색 wash가 보이는 스토리(PL/컵/친선 각 1경기)가 없으면 추가한다.

**통과시킬 테스트**: `npm test`, `npm run build-storybook`(frontend/에서). 둘 다 출력 그대로 보고.

---

## ⑦ 전체 검증 (①~⑥ 완료 후 1회, frontend/에서 실행)

```bash
npm test
npm run lint
npm run build
```

- CLAUDE.md·developer-agent-rules.md 원칙 그대로: **실패한 검증 결과를 숨기거나 축소하지 않는다.** 셋 중 하나라도 실패하면 실패 원인과 관련 파일을 그대로 보고하고, 실패 상태에서 완료 보고하지 않는다.
- `npm test`는 94개(+이번에 추가한 `competitionColor.test.mjs` 1개, 총 95개 예상) 전부 실행 — `tail`로 요약 받고 실패 시에만 전문 확인(컨텍스트 비용 규칙).
- `npm run build`는 mock 모드 기준(로컬에 `.env.local` 없으면 `NEXT_PUBLIC_SUPABASE_URL` 미설정 → `IS_MOCK=true`)으로 통과해야 한다.

---

## ⑧ mock·실연동 화면 확인 (⑦ 통과 후)

- **mock 모드**: `npm run dev`(포트는 3000 대신 별도 지정, 예: `-- -p 4300`)로 홈(MatchdayHero)·`/predictions`(MatchWeekList)·`/predictions/[weekKey]`(FlowClient → 제출 → Done) 화면에서 violet(Premier League)·green(EFL Cup)·**yellow(Club Friendlies, ②에서 추가한 9008)** 세 색이 design-brief 3-4 표대로 나오는지 확인. 종료 경기의 MatchdayHero가 무채색(`bg-neutral-strong`)인지, 잠긴 경기의 MatchInfoCard가 `bg-page`인지도 함께 확인. 스크린샷을 사람에게 보여 검수받는다(검수 지적은 라운드가 끝날 때까지 모아 1왕복으로 반영 — orchestrator-rules 10.5).
- **실연동 확인**: CLAUDE.md 원칙("mock 모드에서만 확인하고 끝내지 말 것") — 프리뷰 배포 또는 스테이징 Supabase 연동 환경에서 실제 `fixtures.competition_name` 값으로도 3색이 나오는지 별도 확인. 이 리포에 스테이징 환경 접근 방법이 이 plan 범위에 없으면 "실연동 미확인"으로 최종 보고에 명시하고 사람에게 확인 경로를 묻는다.
- dev 서버는 자기 PID만 kill(`pkill -f` 금지, developer-agent-rules 5-9 규칙).

---

## 2. 브랜치·Linear (확정: 이슈 1개 + 브랜치 1개)

Linear 프로젝트 "대회별로 색상 다르게"(TEA 팀)에 **이슈 1개**(전체 기능)를 만들었다 — **TEA-30** (https://linear.app/teamboo/issue/TEA-30, In Progress). 브랜치: **`geonhaa/tea-30-승부예측-화면-대회별-색상-적용-노란-팔레트-신설`** (Linear 자동 생성명 그대로). PR 본문에 `Fixes TEA-30`. 작업은 **`origin/main`에서 딴 git worktree**에서 한다 — 현재 체크아웃(`geonhaa/tea-24-…`)에 커밋 안 된 마케팅 작업이 있어 브랜치 전환으로 섞이지 않게 하기 위함. `vault/02_프로젝트/대회별로 색상 다르게/` 문서 6개(intent/design-brief/노란-팔레트-제안/feature-spec/plan/시안.html)도 같은 브랜치에 커밋해 PR에 포함한다. `main` 직접 push 금지, PR을 통해서만 반영(CLAUDE.md "Git/GitHub 규칙") — PR 설명에 이슈 ID와 `Fixes TEA-XX` 매직 워드, 그리고 "무엇을 왜"(색상 매핑·팔레트 신설·배지 공식·옛 글로우 삭제) 요약 포함. PR 전 보안/코드 리뷰: `code-review` `medium` 1회 또는 새 sonnet 에이전트에 diff 경로만 넘김(orchestrator-rules 10.2).

---

## 3. 검증 명령 요약 (재확인용)

```bash
cd frontend
npm test
npm run lint
npm run build
```
실패를 숨기지 않는다 — 셋 다 실제 실행 출력을 그대로 최종 보고에 포함한다.
