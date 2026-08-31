# 예측 목록 "내 순위" 카드 → "최근 5주 포인트" 카드

작성일: 2026-08-31

## 배경

예측(`/predictions`) 목록 화면 우측 열에는 랭킹 카드 두 장이 있다.

- `RankingCard variant="top3"` — 시즌 누적 TOP 3
- `RankingCard variant="mine"` — 내 시즌 누적 순위 한 줄 (`내 순위 · 아바타 · 이름 · {총점}점`)

근거: `PredictListClient.tsx:158-162`, `RankingCard.tsx:29-51`.

이 중 아래쪽 **"내 순위" 카드**를, 최근 5주간 주차별로 몇 포인트를 벌었는지 한눈에 보여주는 위젯으로 교체한다. GitHub 잔디 같은 소형 히스토리 위젯 형태다.

투표(poll)와 예측(predict)은 별개 도메인이며, 포인트/순위는 예측 도메인에만 존재한다. 이 작업은 **예측 목록 화면 안에서만** 이뤄진다.

## 목표 / 비목표

**목표**
- 예측 목록의 "내 순위" 카드 한 장을 "최근 5주 포인트" 카드로 교체.
- 각 주차 칸에 그 주에 번 포인트 숫자를 직접 표시, 배경 진하기로 강약 표현.
- 위쪽 TOP3 카드는 그대로 둔다.

**비목표**
- 투표 목록 화면은 건드리지 않는다.
- 순위(rank) 숫자, 순위 변동(delta), 아바타/이름은 이 카드에서 다루지 않는다.
- 새 DB view/migration은 만들지 않는다 — 기존 `week_leaderboard` view만 사용.

## 데이터

### 원천

`week_leaderboard` view (`database.ts:351-368`)는 `(week_key, user_id, total_points, ...)`를 **주차당 한 행**씩 담는다. 여기서 내 `user_id`로 필터하고 `week_key` 최신순으로 5주를 뽑으면 "최근 5주 포인트 시계열"이 나온다. `week_key`는 `'2026-35'` 꼴 ISO 주차 문자열이라 문자열 정렬로 시간순이 맞는다 (`database.ts:353-354`).

주의: `week_leaderboard`에 **행이 있다 = 그 주에 참여해 채점됐다**. 행이 없으면 미참여(또는 아직 채점 전) 주차다. 이 구분이 칸의 `-` 표시 근거가 된다.

### 신규 쿼리

`src/lib/queries/predictions.ts`에 추가:

```ts
export type WeeklyPoint = {
  weekKey: string       // '2026-35'
  totalPoints: number
  played: boolean       // week_leaderboard에 내 행이 있으면 true
}

/**
 * 내 최근 N주 주차별 포인트. week_leaderboard를 내 user_id로 필터해 week_key 최신순 N주.
 * 반환은 시간순(오래된 주 → 이번 주)으로 오름차순 정렬해 화면 순서와 맞춘다.
 * 로그인 안 했으면 빈 배열.
 */
export async function getMyRecentWeeklyPoints(limit = 5): Promise<WeeklyPoint[]>
```

- 실연동: `createClient()`(쿠키 기반, 사용자별 데이터라 캐시 안 함)로 `week_leaderboard`에서 `week_key, total_points`를 `.eq('user_id', user.id).order('week_key', { ascending: false }).limit(limit)` 조회 후, 반환 직전 오름차순으로 뒤집는다. 조회된 행은 모두 `played: true`.
  - 로그인 안 했으면 `[]` 반환 (`getMyResults():299-303` 패턴과 동일).
- mock: `IS_MOCK`이면 고정 데이터 반환 (아래 mock 섹션).

주의: 이 쿼리는 "내가 참여한 최근 5주"만 반환한다. 시즌 달력상 존재하지만 내가 참여 안 한 주는 여기 안 들어온다. "미참여 주를 빈 칸으로 채울지"는 화면 표현 규칙(아래)에서 처리한다 — 쿼리는 참여 주만 준다.

### mock

`src/lib/mock/data.ts`에 `MOCK_WEEKLY_POINTS` 추가. 화면 확인용 고정 5주. 값 예시(가변 강약이 보이도록):

```ts
// 최근 5주 포인트 (week_leaderboard를 내 user_id로 필터한 결과와 같은 모양)
export const MOCK_WEEKLY_POINTS = [
  { weekKey: '2026-31', totalPoints: 12, played: true },
  { weekKey: '2026-32', totalPoints: 34, played: true },
  { weekKey: '2026-33', totalPoints: 0,  played: true },
  { weekKey: '2026-34', totalPoints: 21, played: true },
  { weekKey: '2026-35', totalPoints: 8,  played: true },
]
```

## 화면 (컴포넌트)

### 새 컴포넌트 `WeeklyPointsCard`

위치: `src/components/composition/predict/WeeklyPointsCard.tsx`

기존 `RankingCard`의 카드 외곽 스타일(`rounded-lg border border-neutral-weak bg-surface p-4`, 제목 `text-body-2-normal font-semibold text-neutral`)을 따라 시각 일관성을 맞춘다 (`RankingCard.tsx:37-38`).

```
props: { entries: WeeklyPoint[]; slots?: number /* 기본 5 */; className?: string }
```

**레이아웃**
- 제목: `최근 5주`
- 그 아래 가로 한 줄에 정확히 `slots`(=5)개의 칸. 칸은 정사각에 가까운 라운드 박스, 가로로 균등 배치.
- 요약 줄 **없음**.

**칸 표현 규칙**
- 왼쪽 = 가장 오래된 주, 오른쪽 = 이번 주(최신). `entries`는 이미 오름차순.
- `entries`가 `slots`보다 적으면(시즌 초반): 항상 5칸 유지. 부족분은 **왼쪽**에 흐린 빈 칸(placeholder)으로 채워, 실제 데이터가 오른쪽(최신)에 오게 한다.
- 각 칸 내용:
  - `played === true` → 그 주 `totalPoints` 숫자를 칸 안에 표시.
  - `played === false` 또는 빈 placeholder → `-`, 흐린 배경(`bg-disabled`/`text-neutral-muted` 계열).
- 배경 진하기(**색 강약 = 5주 중 내 최고점 대비 비율**):
  - 이 카드에 들어온 `played` 항목들의 `totalPoints` 최댓값을 `maxPts`로 잡는다.
  - `ratio = totalPoints / maxPts` (maxPts가 0이면 전부 최하 단계).
  - 4단계 음영으로 매핑: 예) `ratio` 0 초과~0.25 / ~0.5 / ~0.75 / ~1.0. 브랜드 그린 계열의 4단계 토큰을 쓴다(구체 토큰은 구현 시 Foundations/Color에서 확정).
  - **숫자가 정확한 값을 이미 보여주므로 색은 보조 강약**이다. 상대 스케일이라 저조한 주만 있는 창에서도 최고 주가 진하게 나온다는 한계는 감수한다(절대 기준은 주간 경기 수 가변으로 불가능 — `SCORE_TABLE`상 한 경기 최대 20점, 주간 상한 고정 불가).

**빈 상태**
- `entries`가 비었으면(비로그인 또는 참여 기록 없음) 카드 본문에 `아직 참여 기록이 없어요` 한 줄. 문구·스타일은 `RankingCard.tsx:34,41`의 `mine` 빈 상태를 그대로 재사용.

### 배선

- `src/app/predictions/page.tsx`: `Promise.all`에 `getMyRecentWeeklyPoints()` 추가, 결과를 `PredictListClient`에 새 prop `weeklyPoints`로 전달 (`page.tsx:7-11,17`).
- `src/components/composition/predict/PredictListClient.tsx`:
  - `weeklyPoints: WeeklyPoint[]` prop 추가.
  - `line 161`의 `<RankingCard variant="mine" entries={ranking} />` → `<WeeklyPointsCard entries={weeklyPoints} />`로 교체.
  - `RankingCard import`는 top3에서 계속 쓰므로 유지.

## 정리 (죽은 코드)

교체 후 `RankingCard`의 `variant="mine"` 경로는 앱 어디에서도 안 쓰인다(사용처는 이 한 곳뿐 — `grep` 확인 완료). 다음을 검토한다:

- `RankingCardVariant`에서 `'mine'` 제거, `variant` prop 자체가 `top3` 하나면 prop을 없앨지 여부. **단, Storybook에 `mine` variant 스토리가 있으면 함께 정리해야 하므로** 구현 계획 단계에서 사용처를 재확인하고 결정한다.
- `entriesOf`, `mine` 관련 분기(`RankingCard.tsx:30-34,54-56`)도 함께 제거 대상.
- 근거 미확인: `RankingCard mine`을 참조하는 Storybook 스토리 유무 — 구현 시 확인 후 처리.

## 테스트

이 리포의 테스트는 대부분 소스 문자열을 정규식으로 검사한다(CLAUDE.md). 화면 구조를 옮기면 로직이 옳아도 깨질 수 있으므로:

- `내 순위` / `RankingCard variant="mine"` 문자열을 단정하는 테스트가 있으면(특히 `design-foundation`, `predict` 관련 `*.test.mjs`) **지우지 말고** 새 자리(`WeeklyPointsCard`, `최근 5주`) 기준으로 단정문을 다시 쓴다.
- 새 쿼리 `getMyRecentWeeklyPoints`의 정렬(오름차순 반환)·비로그인 빈 배열·최고점 대비 비율 매핑 로직에 단위 테스트를 붙일지 구현 계획에서 정한다.
- 커밋 전 `npm test` 전체 실행.

## 열린 결정 (구현 계획에서 확정)

1. 4단계 그린 음영에 쓸 정확한 색 토큰 (Foundations/Color).
2. `RankingCard` mine variant 제거 범위 — Storybook 스토리 유무 확인 후.
3. 최고점 대비 비율 구간 경계값(0.25/0.5/0.75) 미세 조정.
