# feature-spec — 승부예측 제출 수정·부분 제출

작성: 2026-09-03 · 작성자: developer 에이전트
입력: `intent.md`, `design-brief.md`(§9 확정 답변 포함) — 원문 그대로 이어받음
상태: 작성 완료 — `plan.md`와 함께 **사람 승인 대기**(구현 시작 안 함)

---

## 0. 범위 요약

design-brief가 확정한 3개 답변(§9 질문1=제3안, 질문2=B, 질문3=B)을 종합하면 "화면 조작의 기본 단위가
경기(fixture)로 통일"된다. 이 spec은 그 통일을 아래 3개 영역에서 기술적으로 어떻게 구현할지 정한다.

1. **DB**: `predictions` UPDATE RLS 정책 신설 (제출 후 수정 불가 원칙의 승부예측 한정 예외)
2. **서버 액션**: `submitWeekPrediction`(insert 전용, 경기 단위로 좁힘) + `updateMatchPrediction`(신규, update 전용, 경기 1개)
3. **화면**: 진입 시 경기 선택 화면(더블 매치위크·미제출 상태에서만) + 완료 화면을 "허브"로 확장(제출됨/유예됨/마감됨 3분류 + 경기별 수정 링크)

design-brief §7의 전제(수정 가능 구간 = 기존 `weekStatus === 'open'`, `status === 'result'`는 수정 대상
아님)를 그대로 따른다 — 새 상태값을 만들지 않는다.

---

## 1. 확정 요구사항 재확인 (intent.md·design-brief.md 원문)

- 승부예측은 킥오프 전까지 자유 수정 가능 (기존 "제출 후 수정 불가" 원칙의 승부예측 한정 예외)
- 더블 매치위크 "예측하기" 진입 시 경기 선택 화면 → 경기 하나 또는 "둘 다" 선택
- 완료 화면: 경기 카드마다 "수정" 링크
- 수정 범위: 경기 하나만, 그 경기의 스코어·픽만. 다른 경기 행은 안 건드림 → 서버에 경기 단위 수정 경로 신설
- 부분 참여자는 제출한 경기 수만큼만 집계 (CST-006, 코드 변경 불필요 — §2.4에서 확인)

---

## 2. 데이터 계층 변경

### 2.1 DB — `predictions` UPDATE RLS 정책 신설

현재(`supabase/migrations/20260821120000_create_predictions.sql:89`) "UPDATE / DELETE 정책은
의도적으로 없다 = 제출 후 수정·삭제 불가" 주석과 함께 UPDATE 정책이 아예 없다. INSERT 정책(가장 최근
버전: `20260827140000_restore_predictions_partial_submit.sql:24-37`, 이름
`"predictions: insert own while week open"`)과 같은 기준으로 UPDATE 정책을 새로 만든다 — 마감
조건이 INSERT와 다르면 "제출은 되는데 수정은 막히는" 시점 불일치가 생기므로 반드시 같은 기준을 쓴다.

새 migration (`supabase/migrations/<timestamp>_predictions_allow_edit.sql`, 파일명·타임스탬프는
구현 시점에 확정):

```sql
create policy "predictions: update own while week open"
  on public.predictions for update
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.fixture_id = predictions.fixture_id
        and f.cancelled  = false
        and f.started    = false
        and f.kickoff_at > now()
    )
    and public.prediction_week_first_kickoff(predictions.fixture_id) < now() + interval '7 days'
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.fixture_id = predictions.fixture_id
        and f.cancelled  = false
        and f.started    = false
        and f.kickoff_at > now()
    )
  );
```

- `using`: 어느 행을 수정 대상으로 삼을 수 있는지(본인 행 + 아직 마감 안 된 경기). INSERT 정책과 완전히
  같은 조건 두 개(경기별 마감 + 주차 오픈 윈도우)를 그대로 쓴다.
- `with check`: 수정 후 값이 만족해야 하는 조건. `fixture_id`가 이 UPDATE로 바뀔 일은 없지만(서버
  액션이 `.eq('fixture_id', fixtureId)`로 대상을 고정하고 payload에 fixture_id를 안 보낸다), 방어적으로
  "그 경기가 여전히 열려 있어야 한다"만 남긴다 — week-open 7일 조건은 최초 오픈 판정용이라 이미 열린 뒤엔
  항상 참이므로(§2.1-a 참고) 넣어도 안 넣어도 결과가 같지만, using과 대칭을 맞추려면 넣어도 무방하다(개발자
  판단, 구현 시 최종 결정).
- `predictions: read own or locked fixtures`(공개 읽기, `20260826122000_...`)는 변경 없음 — 수정
  가능 여부와 무관하게 "본인 행이거나 마감된 경기"만 노출하는 기존 기준이 그대로 맞는다.
- `updated_at` 컬럼은 추가하지 않는다 — 이번 화면 어디에도 "마지막 수정 시각" 노출 요구가 없다
  (design-brief §8, 근거 미확인 아니라 명시적으로 불필요하다고 확인된 항목).

**(2.1-a) 왜 week-open 7일 조건이 INSERT/UPDATE에서 사실상 같은 결과를 내는지**: `weekStatus`
(`lib/predictions/week.ts:137-149`)는 `now >= first - 7days`가 한 번 참이 되면(시간은 앞으로만
가므로) 그 뒤로 계속 참이다 — 그래서 "이미 열린 주차"에서 이 조건이 다시 거짓이 되는 경우가 없다. 즉
이 조건은 "최초 오픈 시점을 앞당기지 않는다"는 뜻일 뿐, 수정 시점에 추가 제약을 걸지 않는다.

### 2.2 `frontend/src/lib/predictions/submit.ts` — **변경 없음**

`buildPredictionRows(week, input, candidates)`는 `week.matches`에 들어있는 경기만 갖고 검증한다
(line 67: `targets = week.matches.filter(match => !match.locked)`). 즉 **호출부가 어떤 경기 집합을
`week.matches`로 넘기느냐**가 검증 대상을 결정한다 — 함수 자체는 "그 주 전부"라는 가정이 코드에 박혀
있지 않다. 아래 2.3에서 호출부(`lib/actions/predictions.ts`)가 항상 "이번에 제출/수정하려는 경기만"을
좁혀서 넘기도록 바꾸면, 이 함수는 손대지 않고도 부분 제출·경기 단위 수정을 둘 다 만족한다.

(design-brief §8이 "buildPredictionRows 입력 계약 변경"을 이슈로 짚었는데, 실제로 필요한 변경은
이 함수의 시그니처/로직이 아니라 **호출부가 넘기는 `week.matches` 범위**임을 확인했다.)

### 2.3 `frontend/src/lib/actions/predictions.ts` — 시그니처 변경 + 신규 액션

#### 2.3.1 `submitWeekPrediction` — 시그니처에 `matchIds` 추가 (기존 코드 버그 방지)

**문제**: 지금 시그니처 `submitWeekPrediction(weekKey, input)`는 서버에서 다시 읽은 `week`(그 주
전체 경기, 이미 제출된 것 포함)를 그대로 `buildPredictionRows`에 넘긴다(line 49:
`buildPredictionRows(week, input, candidates)`). 지금까지는 "그 주 미잠긴 경기 전부를 한 번에 제출"
말고 다른 경로가 없어서 이게 항상 맞았지만, 이번에 "경기 하나만 골라 지금 제출"이 가능해지면 —
예: 그 주 경기 A(이미 제출·미잠김)·B(미제출·미잠김)가 있는데 이번엔 B만 제출 — `week.matches`에
A도 포함돼 있어서 `buildPredictionRows`가 A의 스코어도 요구해 `incomplete` 에러가 난다. **재현
조건이 이번 기능으로 새로 생기므로 반드시 고쳐야 하는 잠재 버그다.**

**해결**: 클라이언트가 "이번에 제출할 경기 id 목록"을 명시적으로 같이 보낸다(클라이언트는 이미
`pending` 배열로 이 정보를 갖고 있다 — §3에서 `pending`이 항상 "이번 세션이 다루는 정확한 경기
집합"이 되도록 화면 쪽을 설계한다).

```ts
export async function submitWeekPrediction(
  weekKey: string,
  matchIds: string[],
  input: PredictionInput,
): Promise<SubmitPredictionResult>
```

- 서버는 `week.matches.filter(match => matchIds.includes(match.id))`로 좁힌 target 객체를
  `buildPredictionRows`에 넘긴다(`{ status: week.status, matches: targets }`).
- `matchIds`가 실제 `week.matches`에 없는 id를 포함해도 위 filter가 자연히 걸러내 빈 배열이 되고,
  `buildPredictionRows`가 `targets.length === 0`이면 `closed`를 반환한다(line 68) — 별도 방어 코드
  불필요.
- **주의**: `targets` 안에 이미 DB에 행이 있는 경기가 섞여 들어오면(레이스 컨디션 — 다른 탭에서 방금
  제출) 지금처럼 INSERT가 UNIQUE 위반(`23505`)으로 실패하고 `already_submitted`를 반환한다(기존
  동작 유지, line 84).
- mock 모드 분기(line 52-71)도 `built.rows`만 순회하므로 자연히 좁혀진 대상만 쿠키에 쓴다 — 추가
  변경 불필요.
- `trackServerEvent('prediction_submitted', ...)` 호출(line 100-105)의 `is_partial` 계산
  (`built.rows.length < week.matches.length`)은 **그대로 둔다** — "그 주 전체 대비 이번에 낸 게
  일부"라는 원래 의미가 여전히 유효하다(§5에서 원인 구분 필드를 별도로 얹는 것을 제안).

#### 2.3.2 `updateMatchPrediction` — 신규, 경기 1개 UPDATE 전용

```ts
export type UpdateMatchPredictionResult =
  | { success: true }
  | {
      error:
        | 'unauthenticated'
        | 'closed'          // RLS가 막음(킥오프 지남) 또는 대상 행 자체가 없음(0행 갱신) — 둘 다 "지금은 못 고친다"로 통일
        | 'incomplete'
        | 'invalid_score'
        | 'duplicate_picks'
        | 'unknown_player'
        | 'over_budget'
        | 'setup_required'
        | 'failed'
    }

export async function updateMatchPrediction(
  weekKey: string,
  fixtureId: string,
  input: PredictionInput,  // scores/picks 맵에 fixtureId 키 하나만 채워서 넘긴다 — buildPredictionRows 재사용
): Promise<UpdateMatchPredictionResult>
```

- `week = findWeekSession(weeks, weekKey)`로 다시 읽고, `target = week.matches.filter(m => m.id
  === fixtureId)` (0개 또는 1개)를 `buildPredictionRows({ status: week.status, matches: target },
  input, candidates)`에 넘긴다 — **`submit.ts`를 손대지 않고 그대로 재사용**한다(§2.2).
- mock 모드: 기존 `mock-prediction-{fixtureId}` 쿠키를 덮어쓴다(같은 키라 자연히 "수정"이 된다).
- 실제 모드: `supabase.from('predictions').update({...row 필드}).eq('user_id', user.id)
  .eq('fixture_id', fixtureId).select('id')` — `fixture_id`/`user_id`는 payload에 넣지 않는다(대상
  고정용 `.eq`로만 씀). `data`가 빈 배열이면(행 없음 또는 RLS가 막음) `closed`를 반환한다 — Supabase
  RLS 위반은 UPDATE에서 에러를 던지지 않고 조용히 0행을 갱신하므로 에러 코드가 아니라 **반환된 행
  개수**로 판정해야 한다(이 부분이 INSERT 경로와 다른 점).
- 분석 이벤트: `prediction_updated` 신규 이벤트를 서버에서 보낸다(`prediction_submitted`와 대구
  — `week_key`, `fixture_id`). §5에서 상세.
- `revalidatePath('/predictions')`, `revalidatePath(/predictions/${weekKey})` 동일하게 호출.

### 2.4 CST-006 (부분 참여자 집계) — 코드 변경 불필요, 확인 완료

`week_leaderboard`/`season_leaderboard` 뷰(`20260821120000_create_predictions.sql:159-190`)는
`prediction_results`에 **실제로 존재하는 행만** `sum(total_points)`/`count(*)`로 집계한다 — "그 주
전체 경기 수 대비"로 정규화하는 분모가 어디에도 없다. 즉 경기 1개만 제출한 사용자는 그 1개 경기의
점수만 더해지고, 전체 경기 수와 무관하게 순위가 계산된다. intent.md 결정 3("제출한 경기 수만큼만
집계")과 정확히 일치하는 기존 동작이다 — **이번 작업에서 건드릴 코드 없음.**

---

## 3. 화면 흐름 변경

### 3.1 진입 흐름 개편 — `frontend/src/app/predictions/[weekKey]/page.tsx`

현재 로직(line 58): `pending = submittableMatches(week).filter(match => !myPredictions[match.id])`
는 그대로 유지한다. 여기에 아래 분기를 추가한다(의사코드, 실제 구현은 plan.md 승인 후):

```
prediction = findWeekPrediction(week, myPredictions)   // 이미 부분 제출도 반영하는 기존 함수(week.ts:281-300)
editId     = searchParams.edit   // 경기 id 문자열
matchParam = searchParams.match  // 경기 id 문자열 또는 'both'

1) editId 있음
   target = week.matches.find(m => m.id === editId && !m.locked)
   initial = target && prediction?.scores[editId] 존재 → 그 경기의 기존 스코어·픽
   있으면 → PredictionFlowClient를 "edit 모드"로 렌더 (pending=[target], matchIds=[editId], initialValues=initial)
   없으면(마감됐거나 애초에 제출 안 한 경기로 잘못된 링크) → editId 무시하고 아래로 계속 진행

2) matchParam 있음
   targets = matchParam === 'both' ? pending : pending.filter(m => m.id === matchParam)
   targets가 비어있지 않으면 → PredictionFlowClient (submit 모드, pending=targets, matchIds=targets.map(id))
   비어있으면(무효한 파라미터) → matchParam 무시하고 아래로 계속 진행

3) prediction이 있음(이 주에 뭐라도 이미 제출됨)
   → PredictionFlowClient(submitted=prediction) → 내부에서 PredictionDone 렌더 (완료 화면 = 허브, §3.2)

4) pending.length === 0 이고 prediction도 없음
   → 기존 notFound/upcoming 가드에 이미 걸러지는 경우라 실질적으로 도달하지 않음(기존 동작 유지)

5) pending.length === 1
   → PredictionFlowClient (submit 모드, pending, matchIds=[그 경기 id]) — 싱글 매치위크는 지금과 동일

6) 그 외(더블 매치위크, 아무것도 제출 안 함, pending.length > 1)
   → 신규 PredictionMatchSelect 화면
```

기존 대비 실질 변경: (a) `prediction` 유무로 "완료 화면(허브)"을 먼저 판단(예전엔 `pending.length
=== 0`로만 판단), (b) `matchParam`/`editId` query 처리 추가, (c) 6번 분기에서만 새 선택 화면 진입.
1~5번 경로는 싱글 매치위크·기존 완전 제출 케이스에서 **기존 동작과 동일한 결과**를 낸다(회귀 없음).

### 3.2 완료 화면(`PredictionDone.tsx`) — "허브"로 확장

지금은 `submittedMatches`(제출함) / `missedMatches`(제출 안 하고 마감됨) 2분류다(line 61-63). 여기에
**`deferredMatches`**(아직 안 잠겼는데 제출 안 함 = 사용자가 "나중에"를 고른 상태) 분류를 추가한다:

```ts
const submittedMatches = week.matches.filter(match => prediction.scores[match.id])
const deferredMatches  = week.matches.filter(match => !prediction.scores[match.id] && !match.locked)
const missedMatches    = week.matches.filter(match => !prediction.scores[match.id] && match.locked)
```

(기존 `missedMatches`는 "제출 안 함" 전부였는데, `!match.locked` 조건을 더해 "아직 할 수 있는 것"과
"이미 늦은 것"을 가른다.)

- **submittedMatches 카드**: 카드별 "수정" 텍스트 링크는 **넣지 않는다**(2026-09-04 결정 변경 — §7-5).
  스코어·선수 픽만 정적으로 보여준다.
- **deferredMatches 카드**: 신규. 헤딩 "아직 예측하지 않았어요" + CTA "지금 예측하기"(§7-2 확정) →
  `/predictions/{weekKey}?match={match.id}`로 이동(제출 문맥 단일 경기 진입).
- **missedMatches 카드**: 기존 그대로("이 경기는 예측 마감 시간이 지나 참여하지 못했어요").
- **하단 액션 (신규, §7-5)**: 기존 "공유하기" 버튼을 완전히 제거하고, 그 자리에 항상 노출되는 큰
  "수정하기" 버튼 하나를 둔다.
  - `submittedMatches.length === 1` → 클릭 시 `/predictions/{weekKey}?edit={그 경기 id}`로 이동
    (바로 그 경기 수정 플로우).
  - `submittedMatches.length === 0` → 이 버튼 자체를 숨긴다(수정할 게 없음).
  - `submittedMatches.length >= 2` → 클릭 시 `PredictionMatchSelect`(`mode: 'edit'`, §3.5)로 이동
    — 라우팅 파라미터는 developer가 §3.1 확장 시 결정(예: `?editSelect=1`).
  - 버튼 아래 고정 캡션 "킥오프 전까지 다시 수정할 수 있어요"(§4에서 확정한 문구, 위치만 이동).
- `deferred_match_count` 같은 신규 분석 필드는 추가하지 않는다(§7-7, 분석 이벤트 확장 스킵 확정).

### 3.3 수정 플로우 — `PredictionFlowClient.tsx`에 edit 모드 추가

새 prop 추가:

```ts
{
  ...기존 props,
  mode?: 'submit' | 'edit'          // 기본 'submit'
  matchIds: string[]                // 이번 제출/수정이 다루는 정확한 경기 id 목록(신규, 필수)
  initialValues?: {                 // mode === 'edit'일 때만 사용, 그 경기의 기존 제출값
    score: [number, number]
    picks: Record<Position, { playerId: number; multiplier: number }>
  }
}
```

- `mode === 'edit'`일 때 `pending`은 항상 길이 1(수정 범위 = 경기 하나, design-brief §9 질문3=B) —
  따라서 `isMulti`가 자동으로 `false`가 되어 "그대로 적용"·더블 매치위크 전용 UI가 자연히 안 나온다(기존
  `isMulti = pending.length > 1` 로직 재사용, 코드 분기 추가 불필요).
- `scores`/`picks`의 `useState` 초기값을 `initialValues`가 있으면 그 값으로, 없으면 기존처럼
  `[0,0]`/빈 객체로 잡는다.
- `handleSubmit`: `mode === 'edit'`이면 `updateMatchPrediction(week.weekKey, matchIds[0], {...})`를
  호출, 아니면 기존처럼 `submitWeekPrediction(week.weekKey, matchIds, {...})`를 호출(§2.3.1의 새
  시그니처).
- 확인 단계(`step === 'confirm'`) 카피: `mode === 'edit'`이면 제목 "이대로 수정할까요?"(기존 "이대로
  제출할까요?" 대신), status 문구는 "제출한 예측은 수정할 수 없어요"를 아예 빼거나 문맥에 맞게 교체
  (§4 확인 필요).
- 제출 성공 후 처리: 기존처럼 `router.refresh()` — edit 모드에서 성공하면 서버가 그 경기를 업데이트
  했으므로 새로고침 시 `page.tsx`가 `editId` 무시(더 이상 query에 없음 — edit 링크를 누른 시점 URL이
  그대로 남아있을 수 있는데, `router.refresh()`만으로는 URL이 안 바뀐다는 점 주의)... **구현 시 확인
  필요**: 성공 후 `router.push('/predictions/${weekKey}')`로 query를 지우고 이동해야 재방문 시 다시
  같은 edit 화면으로 안 돌아간다. `router.refresh()` 단독으로는 URL의 `?edit=` 파라미터가 남아 다음
  렌더에서도 1번 분기를 다시 타지만, 그 시점엔 스코어·픽이 새 값으로 바뀌어 있어 "다시 그 값으로 수정
  화면"이 뜨는 것 자체는 안전하다(무한 루프 아님) — 다만 UX상 "수정 완료" 느낌을 주려면 완료 허브로
  보내는 게 낫다고 판단해 `router.push`를 제안한다(개발자 판단, §7에서 확인 요청 대상 아님 — 순수
  기술적 선택).

### 3.4 신규 화면 — `PredictionMatchSelect` (컴포넌트명 가안, 확정 아님)

`frontend/src/components/composition/predict/` 아래 신규 파일. 서버 컴포넌트로 충분하다(클릭 =
`next/link`로 `?match=` 붙여 이동, 클라이언트 상태 불필요). Props: `week: WeekSession`, `pending:
MatchView[]`(길이 2 이상).

레이아웃 가안: 경기별 카드(팀 대결 정보, 기존 `MatchInfoCard`/`MatchMeta` 스타일 재사용 검토) +
"경기 1만 하기" / "경기 2만 하기" 두 버튼 + "둘 다 예측하기" 버튼 하나. 정확한 배치·카피는 §7 확인 필요
항목이라 이 spec은 컴포넌트 계약(props·이동 경로)만 확정한다.

---

## 4. 문구 변경

design-brief §5가 "구조 결정과 무관하게 반드시 바뀌어야 한다"고 지정한 3곳은 **개발자 영역**으로
명시돼 있어 여기서 확정한다(설계 판단 아니라 구조 확정의 직접 결과):

| 위치 | 현재 | 변경(안) |
|---|---|---|
| `PredictionFlowClient.tsx:47` `ERROR_MESSAGE.already_submitted` | "이미 제출한 주차예요. 제출한 예측은 수정할 수 없어요." | "이미 제출한 경기예요. 완료 화면에서 수정해주세요." (레이스 컨디션에서만 노출됨 — §2.3.1) |
| `PredictionFlowClient.tsx:293` 확인 단계 status | "제출한 예측은 수정할 수 없어요" | "킥오프 전까지 다시 수정할 수 있어요" |
| `PredictionDone.tsx:175` 하단 고정 문구 | "제출한 예측은 수정할 수 없어요" | "킥오프 전까지 다시 수정할 수 있어요" (또는 완전 삭제 — §7 확인 필요, 톤 판단이라 developer 단독 확정 대상 아님으로 넣었다) |

위 표의 앞 2곳은 이 spec에서 문구를 확정한다(design-brief가 위임한 범위). 3번째 행의 괄호 안(완전
삭제 여부)과 §3.2/§3.4에서 새로 필요해진 카피(수정 링크는 기존 "수정" 그대로 재사용 가능하지만,
"지금 예측하기" CTA·경기 선택 화면 문구·유예 섹션 헤딩)는 **design-brief §5 마지막 문단이 명시한
"새 UX 패턴에 딸린 카피는 별도 확인 필요" 기준에 해당** — §7에 확인 목록으로 남긴다.

---

## 5. 분석 이벤트 (제안, 선택사항)

design-brief §8: "이벤트 스키마에 원인 구분 필드를 추가할지는 개발자 판단 영역(요구 사항 아님)." 아래는
제안이며, 사람이 스킵을 택해도 기능 자체엔 영향 없다.

- `prediction_submitted`(서버, `lib/actions/predictions.ts:100`)·`prediction_flow_viewed`/
  `prediction_done_viewed`(클라이언트)의 `is_partial: boolean`은 지금 "자동 부분 제출(킥오프 지남)"과
  "사용자가 능동적으로 일부만 고름"을 구분하지 못한다. `partial_reason: 'auto_kickoff_passed' |
  'user_selected' | null` 필드를 추가 제안 — 서버에서는 `matchIds.length < week.matches.filter(m =>
  !m.locked).length`이면 `'user_selected'`, 그 외 부분이면(이미 잠긴 경기가 있어서) `'auto_kickoff_passed'`로 판정 가능.
- 신규 이벤트 `prediction_updated`(서버, `updateMatchPrediction`에서) — `week_key`, `fixture_id`.
- 신규 이벤트 후보(클라이언트): `prediction_match_select_viewed`/`prediction_match_selected`(선택
  화면), `prediction_edit_started`(수정 진입) — 퍼널 분석에 필요하면 추가, 필수 아님.
- 포함 여부는 plan.md 실행 순서에서 **P2(선택)**로 표시한다.

---

## 6. 엣지케이스

1. **레이스: 두 탭에서 같은 경기를 동시에 처음 제출** → `submitWeekPrediction`의 INSERT가 UNIQUE
   위반(23505) → `already_submitted`(기존 동작 유지, §2.3.1).
2. **레이스: 수정 중 킥오프가 지나감** → `updateMatchPrediction`의 UPDATE가 RLS에 막혀 0행 → `closed`
   반환, 클라이언트는 기존 `ERROR_MESSAGE.closed`("예측이 마감된 주차예요" — 이 문구도 "마감된
   경기예요"로 다듬을지 §7에서 확인) 표시.
3. **`edit` 쿼리 파라미터로 잠긴/미제출 경기를 가리킴**(오래된 링크, 새로고침 지연 등) → §3.1의
   1번 분기가 조용히 무시하고 정상 분기로 폴백 — 에러 화면 대신 완료 허브나 선택 화면으로 자연스럽게
   떨어진다.
4. **`match` 쿼리 파라미터가 `pending`에 없는 id** → §3.1의 2번 분기가 무시하고 폴백. 같은 원리.
5. **더블 매치위크에서 첫 경기만 제출 후 새로고침 없이 URL 직접 조작으로 두 번째 경기까지 한 번에 다시
   제출 시도**(예: `?match=both`) → `submitWeekPrediction`은 `matchIds`를 `week.matches`와
   맞대조하지만 이미 제출된 경기가 섞여도 INSERT가 그 행에서만 실패(단일 statement 전체 롤백) →
   `already_submitted`. 사용자에게는 "이미 낸 경기가 있다"는 메시지가 뜨고 둘 다 실패로 처리된다 —
   완벽하진 않지만 데이터 정합성은 깨지지 않는다(기존 원자성 유지). 더 매끄러운 처리(이미 제출된 것만
   건너뛰고 나머지만 insert)는 이번 스코프 밖으로 둔다 — `?match=both`는 애초에 "아직 아무것도 제출
   안 한" 상태에서만 화면에 노출되므로(§3.1 6번 분기 조건) 정상 사용 흐름에서는 발생하지 않는다.
6. **결과 확정 주차(`status === 'result'`)** — `[weekKey]/page.tsx`의 기존 분기(line 26)가 이 spec의
   모든 새 로직보다 먼저 갈라내므로 도달 자체가 안 됨. DB RLS도 `started=false` 조건으로 한 번 더 막는다
   (defense in depth).
7. **스쿼드 이탈 선수를 픽한 채로 수정 진입** — `PredictionDone.tsx`의 기존 `resolvePicks`가 이미
   "스쿼드에서 빠진 선수는 이름 모름, 사진 URL만"으로 처리한다(line 28-44). edit 모드 초기값에도 같은
   맵을 쓰므로, 수정 화면의 `PositionRow`에서 그 포지션이 "빈 카드"처럼 보일 수 있다 — 사용자가 다시
   고르면 그만이라 기능적으로 문제는 없지만, "원래 골랐던 선수 이름이 안 보이고 빈칸으로 뜬다"는 점은
   구현 중 실제로 확인해볼 것(근거 미확인 — 코드상 추정, 실기기 확인 필요).

---

## 7. 사람 확인이 필요한 항목 — 확정 완료 (2026-09-04)

design-brief §5·§9가 위임한 범위를 넘어서는 신규 화면/카피를 designer 에이전트가 시안-v1·v2.html로
그려 확인받았고, 아래와 같이 전부 확정됐다. developer는 구현 시 이 문구를 그대로 쓴다.

1. **`PredictionMatchSelect` 화면 카피 (제출 문맥)** — 제목 "어느 경기부터 예측할까요?" · 부제 "한
   경기만 먼저 해도 되고, 둘 다 지금 해도 돼요" · 경기별 버튼 "○○전만 하기"(상대팀 이름 사용) · 하단
   CTA "둘 다 예측하기".
2. **완료 화면 "유예" 섹션 카피** — 헤딩 "아직 예측하지 않았어요" · CTA "지금 예측하기".
3. **수정 플로우 확인 모달·상태 문구** — 모달 제목 "이대로 수정할까요?" · 설명 "킥오프 전까지 다시
   수정할 수 있어요"(§4 표 확정 문구와 동일) · 확인 버튼 "수정하기". §4 표 3번째 행 괄호(완전 삭제
   여부)는 삭제하지 않고 문구 유지로 확정.
4. **경기 선택 화면 카피 (수정 문맥, 신규)** — §3.4에 없던 화면이 하나 더 필요해졌다: 제출한 경기가
   2개 이상일 때 "수정하기"를 누르면 뜨는 선택 화면. 제목 "어느 경기를 수정할까요?" · 부제 "수정할
   경기를 하나 골라주세요" · 버튼 "○○전 수정하기". §3.4의 `PredictionMatchSelect`와 같은 컴포넌트를
   문맥(`mode: 'submit' | 'edit'`)만 다르게 재사용한다 — 아래 §3.5 참고.
5. **완료 화면 하단 액션 — "공유하기"를 "수정하기"로 교체 (신규 결정)**: 기존 계획(§3.2)은 경기
   카드마다 작은 "수정" 텍스트 링크였는데, 사용자 피드백으로 바뀌었다. 화면 하단(기존 공유하기
   자리)에 **항상 하나의 큰 "수정하기" 버튼**만 두고, 카드별 소형 링크는 삭제한다. 동작: 제출된 경기가
   1개면 그 경기 수정 플로우로 바로 진입, 2개 이상이면 위 4번 선택 화면을 먼저 보여준다. **"공유하기"
   기능은 이번 스코프에서 완전히 제외**(다른 자리로 옮기는 건 별도 논의 — 이번 구현에서 삭제만 하고
   재배치는 하지 않는다).
6. **수정 완료 후 이동 방식** — §3.3에서 제안한 "완료 허브로 `router.push`" 그대로 채택.
7. **분석 이벤트 확장(§5)** — **스킵**. `partial_reason` 필드, 신규 클라이언트 이벤트 전부 이번
   스코프에서 뺀다. plan.md 8단계는 생략.
8. **DB 마이그레이션 적용 방식** — developer는 SQL 파일만 작성한다. 실제 `supabase db push`는
   **사용자가 직접** 실행한다(이 세션/에이전트가 원격에 적용하지 않는다).
9. **공용 컴포넌트 문구 모순 수정** — `ConfirmContent`(투표·예측 공용)의 고정 문구 "제출 후에는
   변경할 수 없습니다"는 이번 결정(자유 수정 허용)과 모순되므로, 예측 도메인 호출부에서 이 문구를
   prop으로 오버라이드해 "킥오프 전까지 다시 수정할 수 있어요"로 바꾼다(design-brief·시안-v2.html에서
   먼저 발견, 톤 취향이 아니라 모순 제거이므로 대안 없이 확정).

### 3.5 `PredictionMatchSelect` — 제출/수정 공용 컴포넌트로 확장 (§3.4 보강)

원래 §3.4는 "제출 문맥"만 다뤘는데, 5번 결정으로 "수정 문맥"에서도 같은 화면이 필요해졌다. 컴포넌트에
`mode: 'submit' | 'edit'` prop을 추가한다:

- `mode === 'submit'`: 기존 §3.4 그대로 — `pending`(미제출 경기) 목록, 버튼 "○○전만 하기" × N +
  "둘 다 예측하기" 버튼(경기가 정확히 2개일 때만 노출 — 3개 이상 더블/트리플은 이번 스코프 밖, 근거
  미확인이므로 developer가 실제로 3경기 이상 케이스가 존재하는지 fixtures 데이터로 확인 후 있다면
  다시 보고할 것).
- `mode === 'edit'`: `submittedMatches`(제출된 경기) 목록, 각 카드에 기존 제출값(스코어) 같이
  표시, 버튼 "○○전 수정하기" × N. **"둘 다 수정하기" 버튼 없음** — 수정은 항상 경기 1개 단위
  (design-brief §9 질문3=B, feature-spec §3.3).
- 완료 허브(§3.2)의 "수정하기" 버튼 클릭 핸들러: `submittedMatches.length === 1`이면
  `updateMatchPrediction` 플로우로 바로 이동(`?edit={id}`), `>= 2`면 `PredictionMatchSelect`
  (`mode: 'edit'`)로 이동(신규 쿼리 파라미터 필요 — 예: `?editSelect=1`, 정확한 라우팅 파라미터명은
  developer가 §3.1 분기 확장 시 결정).

---

## 9. 더블 매치위크 "둘 다 예측하기" 흐름 재설계 (2026-09-04, §3.3 갱신)

시안-v3~v7.html 검토 과정에서 사용자가 "둘 다 예측하기"의 실제 동작 방식을 여러 번 바꿨다. **최종
확정은 시안-v7.html**이고, 아래가 §3.3을 대체하는 내용이다. (v3~v6에서 다룬 "매치 탭 자유 전환" 방식은
전부 폐기됐다 — 최종 결정에 반영되지 않는다.)

### 9.1 확정된 흐름 — 고정 순서 a-b-a-b-c

`?match=both`로 들어오면(§3.1의 2번 분기, `matchTargets = pending` 그대로) `PredictionFlowClient`가
**경기 수만큼 (스코어→픽)을 반복하고 마지막에 공통 확인 화면 하나**를 보여준다. 경기 2개 기준:

1. (a) 경기 1 스코어 입력
2. (b) 경기 1 선수 픽
3. (a) 경기 2 스코어 입력
4. (b) 경기 2 선수 픽
5. (c) **확인 — 두 경기를 한 화면에서 같이 보고, "제출하기" 하나로 한 번에 제출**

자유 전환(탭)이 아니라 **고정 순서**다 — "이전" 버튼으로만 되돌아갈 수 있다.

### 9.2 `PredictionFlowClient.tsx` 내부 구조 변경

- **기존 `isMulti` 분기(경기별 블록 세로 스택 + 경기별 `BudgetBar` + "그대로 적용" `copyPicks`)는
  스코어·픽 "입력" 단계에서 완전히 제거한다.** 이 두 단계는 이제 `pending.length`와 무관하게 항상
  "경기 하나만 보여주는" 기존 싱글 매치 레이아웃을 쓴다 — `MatchLabel`, 경기별 `BudgetBar` 스택,
  `copyPicks` 관련 코드/버튼을 전부 들어낸다.
- **"그대로 적용" 기능(`copyPicks`, 관련 버튼·상태) 완전 삭제.**
- **스텝 상태 기계를 확장한다.** 기존 `STEP_META`(`score`/`pick`/`confirm` 3개 고정)를 그대로 두되,
  `pending.length > 1`일 때는 내부적으로 "지금 몇 번째 경기의 몇 번째 단계인지"를 추적하는 커서가
  필요하다(예: `matchCursor: number` state 추가, `score`/`pick` 단계는 `pending[matchCursor]`
  기준으로 렌더). `pick` 단계의 "다음"을 누르면: `matchCursor`가 마지막 경기가 아니면
  `matchCursor + 1`로 올리고 `score` 단계로 되돌아가고, 마지막 경기면 `confirm` 단계로 넘어간다.
  "이전"도 대칭으로 되돌린다(첫 경기의 score 단계에서 "이전"을 누르면 화면 이탈 확인 모달, 나머지는
  이전 경기의 pick 단계로).
- **`ProgressPips`는 세션이 다루는 전체 스텝 수(경기 수 × 2 + 1)에 맞춰 점 개수를 늘린 버전을 쓴다.**
  컴포넌트 자체(모양·색)는 안 바꾸고 개수만 동적으로 넘긴다 — `steps.tsx`의 `ProgressPips`가 `current`
  하나만 받는 지금 시그니처를 `total`/`activeCount`를 받도록 확장할지, 아니면 호출부에서 점 배열을
  직접 조립할지는 개발자 판단(둘 다 시안-v7.html의 렌더 결과와 같으면 됨).
- **확인(c) 단계는 기존 `isMulti` 확인 단계 패턴을 그대로 재사용한다** — `MatchLabel` + `SummarySection`
  ×2(결과 예측/선수 예측)가 경기별로 반복되는 구조는 이미 있던 코드이니 스코어/픽 입력 단계처럼 걷어낼
  필요가 없다. 다만 지금은 이 확인 화면이 "`isMulti`일 때의 유일한 진입 경로"였는데, 이제는 "고정
  순서의 마지막 단계"로 도달 경로만 바뀐다.
- **제출**: 확인 단계의 "제출하기"는 `submitWeekPrediction(week.weekKey, matchIds, input)`을
  **한 번만** 호출한다 — `matchIds`는 이미 두 경기 id를 다 담고 있고(§2.3.1에서 이미 다중 id를
  지원하도록 설계됨), `input.scores`/`input.picks`도 두 경기 키를 다 채운 상태이므로 **서버 액션은
  추가 변경이 필요 없다.** "경기마다 따로 제출"(2026-09-04 오전 결정)은 이 재설계로 폐기됐다 — 최종은
  한 번에 묶어 제출이다.
- **크레스트 모양**: 원형(`rounded-pill`, 기존 `TeamBadge` 폴백과 동일)을 그대로 쓴다 — 시안 과정에서
  잠깐 정사각형으로 바꿨다가 최종적으로 원래대로 되돌아갔다.

### 9.3 영향 없는 것

- §2(DB·서버 액션), §3.1(진입 라우팅), §3.2(완료 허브), §3.4/3.5(`PredictionMatchSelect`)는 이번
  재설계와 무관 — 그대로 유지한다. `PredictionMatchSelect`의 "둘 다 예측하기" 버튼은 여전히
  `?match=both`로 이동할 뿐, 그 뒤 `PredictionFlowClient` 내부 동작만 바뀐 것이다.
- §7의 카피 확정 사항(경기 선택 화면, 유예 섹션, 수정 확인 모달)도 그대로 유지.

---

## 8. 테스트 계획 (plan.md와 함께 상세화)

- `frontend/src/lib/predictions/submit.test.mjs` — 기존 테스트 전부 통과 확인(함수 변경 없음, 회귀
  없어야 정상).
- `frontend/src/lib/predictions/week.test.mjs` — 변경 없음, 회귀 확인만.
- 신규 `frontend/src/lib/actions/predictions.test.mjs` — 이 파일은 `'use server'` + Supabase
  의존이라 순수 단위 테스트가 어렵다. 기존 관례(`prediction-flow-action-bar.test.mjs`,
  `analytics-contract.test.mjs`)를 따라 **소스 문자열 검사**로: `submitWeekPrediction`이 `matchIds`
  파라미터를 받는지, `updateMatchPrediction`이 export되고 `.update(`/`.eq('fixture_id'`를 쓰는지,
  `trackServerEvent('prediction_updated'` 호출이 있는지 등을 정규식으로 확인.
- `frontend/src/lib/analytics/analytics-contract.test.mjs` — §5를 채택하면 관련 assert 추가.
- 신규 `frontend/src/components/composition/predict/*.test.mjs` — PredictionDone의
  submitted/deferred/missed 3분류 분기, PredictionFlowClient의 edit 모드 분기 존재 여부를 소스 문자열
  검사로 확인(기존 파일들과 같은 패턴).
- (§9 신규) `PredictionFlowClient.tsx`에 `copyPicks`/"그대로 적용" 관련 코드가 **더 이상 없는지**
  확인하는 부정 검사(`assert.doesNotMatch`)를 추가한다 — 제거 확정 사항이 실제로 지켜졌는지 회귀
  방지용. `matchCursor`(또는 동등한 커서 상태) 존재, `ProgressPips` 호출부가 동적 개수를 넘기는지도
  소스 문자열로 확인.
- `npm test`(전체 94→더 늘어난 개수) / `npm run lint` / `npm run build`는 구현 완료 후 **1회**
  게이트로 실행(개발자 에이전트 규칙 §3-6).
- **DB 마이그레이션은 로컬/스테이징에서 `supabase db push` 전 사람 확인** — 프로덕션 RLS 변경이라
  developer-agent-rules §4 "기존 데이터베이스 스키마... 영향 주는 변경"에 해당. plan.md 실행 순서
  마지막에 별도 승인 지점으로 남긴다.
