# plan — 승부예측 주 경계 일요일 기준 변경

작성: 2026-09-04 · 작성자: developer 에이전트
**사람 승인 전까지 구현 시작 금지.** 아래 0단계 확인 없이는 1~4단계도 정확한 값을 못 채운다.

---

## 0단계 (구현 착수 전 필수 확인 — feature-spec.md §5, §6)

승인자가 아래 3가지를 확정해야 이후 단계 착수 가능:

1. **친선경기(시즌 앵커 이전 6경기) 처리** — feature-spec §6-1의 A(화면·쿼리에서 제외) / B(음수·0 순번 그대로 노출) / C(별도 표기) 중 선택. **A를 고르면 `lib/queries/fixtures.ts`의 조회 쿼리에 `competition_name` 필터를 추가하는 작업이 스코프에 새로 들어간다** — 이 경우 developer-agent-rules 에스컬레이션 기준(DB 조회 로직·프로덕션 데이터 노출 변경)에 해당하므로 이 확인 자체가 그 절차다.
2. **`weekKey`의 "연도" 자리** — feature-spec §6-2의 안 1(시즌 개막 연도 2026 고정) / 안 2(그 주의 실제 달력 연도) 중 선택.
3. **`isoWeek`/`weekKey` 함수명 유지 여부** — feature-spec §5. 유지(주석만 정정) 또는 개명(구체 이름은 승인자가 지정하거나 기본안 승인).

이 세 가지가 확정되면 1~4단계의 "TBD" 표시를 채워 그대로 실행한다.

---

## 1단계 — DB 마이그레이션

새 파일 `supabase/migrations/20260904140000_predictions_sunday_week_boundary.sql` (타임스탬프는 최신 마이그레이션 `20260903130000` 이후로 설정, 리포 리포 마이그레이션 타임스탬프 관례 그대로).

변경 대상 (feature-spec §1):

1. `public.prediction_week_start(target_fixture bigint)` — 본문을 아래 일요일 앵커 식으로 교체:
   ```sql
   select date_trunc('week', (f.kickoff_at at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day'
   from public.fixtures f
   where f.fixture_id = target_fixture;
   ```
2. `public.prediction_week_first_kickoff(target_fixture bigint)` — 인라인 `date_trunc('week', ...)` 비교도 **같은 일요일 앵커 식**으로 함께 교체(§1-1에서 확인한 대로, `prediction_week_start()`만 고치면 이 함수의 비교가 깨진다).
3. `public.week_leaderboard` 뷰 재정의 — `week_key` 계산을 ISO 문자열(`to_char(..., 'IYYY-IW')`) 대신 시즌 앵커 순번 식으로 교체. **정확한 SQL은 0단계 결정 2번(연도 자리)에 따라 달라진다**:
   - 안 1(연도 고정)이면: `'2026-' || (floor(extract(day from (일요일앵커 - date '2026-08-23')) / 7) + 1)::text`
   - 안 2(달력 연도)면: 앵커 날짜에서 연도를 뽑아 문자열 조합(구체 식은 승인 후 작성).
   - **0단계 결정 1번이 A(친선경기 제외)면**, 이 뷰가 읽는 `prediction_results`가 애초에 친선경기 행을 안 갖게 되므로(§1단계 3-b 참고) 순번 음수 케이스는 뷰에서 안 나온다. B/C를 고르면 순번이 음수/0으로 나가는 걸 그대로 둔다.
4. `public.prediction_results` 뷰의 정산 게이트 인라인 `date_trunc('week', ...)` 2곳(줄 64-65)도 같은 일요일 앵커 식으로 교체 — 그래야 "그 주 다른 경기가 안 끝났으면 숨긴다" 판정이 새 주차 그룹핑과 일치한다.
5. **0단계 결정 1번이 A(친선경기 제외)인 경우에만 추가**: `frontend/src/lib/queries/fixtures.ts`의 `getFixtureWeeksUncached()` 쿼리에 `.neq('competition_name', 'Club Friendlies')` 추가(또는 동등한 필터). 이건 DB 마이그레이션이 아니라 클라이언트 쿼리 변경이지만 0단계 1번과 묶여 있어 여기 같이 적어둔다.
6. `supabase/rollback/`에 대응 리버트 스크립트 추가(리포 관례 — 43개 마이그레이션 중 13개가 리버트 스크립트를 동반). `prediction_week_start`/`prediction_week_first_kickoff`/두 뷰를 월요일 기준 원래 식으로 되돌리는 내용.

검증: `supabase db push`(사전에 `supabase link` 대상이 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`과 같은 프로젝트인지 재확인 — `AGENT_MAINTENANCE_GUIDE.md` 경고 참고), 이후 `supabase db query --linked`로 §1-2 표의 3개 실제 경기(리버풀/웨스트브롬/토트넘)를 다시 조회해 `week_key`가 예상대로 나오는지 확인.

---

## 2단계 — 클라이언트 (`frontend/src/lib/predictions/week.ts`)

1. `isoWeek()`/`weekKey()` 본체를 feature-spec §2-2의 앵커 계산식으로 교체(0단계 결정 3번에 따라 함수명은 유지 또는 개명).
2. `SEASON_WEEK1_ANCHOR = Date.UTC(2026, 7, 23)` 상수 추가, 주석에 "이번 시즌(2026-27) 전용, 다음 시즌 시작 전 갱신 필요"를 남긴다(feature-spec §8).
3. `fillGapWeeks()`의 "직전 월요일 찾기" 커서 로직을 "직전 일요일 찾기"(`cursor.getUTCDate() - cursor.getUTCDay()`)로 교체.
4. `weekKey()`의 연도 조합 로직을 0단계 결정 2번에 맞게 작성.
5. 0단계 결정 1번이 A(제외)면: `groupFixturesByWeek()`의 `.filter(f => !f.cancelled && f.kickoff_at)`에 친선경기 배제 조건은 넣지 않는다 — **쿼리 단(1단계 5번)에서 이미 걸러지므로 여기 도달하는 행 자체가 없다.** week.ts는 순수 함수라 DB/쿼리 필터 여부를 모르는 채로 그대로 둔다.

이 파일 외 다른 소스 파일은 코드 변경 없음(feature-spec §2-4 표 — 전부 값만 위임받는 호출부).

---

## 3단계 — 문서 drift 정리 (developer-agent-rules 체크리스트 1번)

- `lib/queries/fixtures.ts:56` 주석의 `"2026-35"` 예시 → 새 포맷 예시로 교체.
- `types/database.ts:355` 주석의 `"lib/predictions/week.ts의 weekKey()와 같은 ISO 주차 문자열('2026-35')"` → "시즌 앵커 기준 순번 문자열"로 정정(§5의 개명 여부에 맞춰 문구 조정).
- `supabase/migrations/20260823140000_week_leaderboard.sql:8-9`, `20260823130000_predictions_weekly_window.sql:17,43`, `20260824120000_prediction_results_week_settled.sql:55` 등 "월요일 시작"을 언급하는 주석들 — **기존 마이그레이션 파일은 수정하지 않는다**(이미 적용된 히스토리). 대신 1단계에서 만드는 새 마이그레이션 파일의 주석에서 "이 함수는 지금부터 일요일 기준이며, 과거 파일의 '월요일 시작' 주석은 히스토리 기록이라 그대로 둔다"를 명시.

---

## 4단계 — 테스트 (`lib/predictions/week.test.mjs`)

feature-spec §7 그대로:

1. `currentWeekKey` 관련 3개 테스트의 기대값을 새 계산식(0단계 결정 반영)으로 재계산.
2. 더블 매치위크 테스트(83행)의 픽스처 날짜를 **일요일 경계에서도 실제로 같은 주에 남는 조합**으로 교체(예: 일요일 경기 + 같은 주 목요일 경기 — §1-2의 리버풀/웨스트브롬 조합처럼). 테스트 설명(더블 매치위크 그룹핑 취지)은 유지.
3. 빈 그룹 테스트(101행)는 그룹 개수·빈 그룹 위치 구조는 그대로, `weekKey` 리터럴만 재계산.
4. `findWeekSession`/`toPredictWeeks` 테스트(179, 197, 264, 285행)의 리터럴 weekKey 재계산.
5. 새로 추가할 테스트: 0단계 결정 1번이 B/C(친선경기 미제외)라면 "시즌 앵커 이전 경기는 음수/0 순번을 받는다"를 명시적으로 검증하는 케이스 하나. A(제외)라면 이 케이스 대신 "친선경기는 `groupFixturesByWeek` 입력에 아예 안 들어온다는 전제"를 테스트 상단 주석으로 남긴다(쿼리 필터는 이 파일이 검증할 수 없으므로).

실행: `cd frontend && npm test`(94개 전체 — 개별 script에 `week.ts`가 없으므로 반드시 `npm test`로 확인, CLAUDE.md 명령어 섹션 참고).

---

## 5단계 — 검증 (구현 완료 후 1회, developer-agent-rules 6번)

```bash
cd frontend
npm test          # week.test.mjs 포함 전체
npm run lint
npm run build
```

DB 변경이 있으므로 추가로:

- mock 모드(`.env.local` 없이 `npm run dev`)에서 승부예측 목록·제출·결과 화면 스모크 확인(CLAUDE.md — "mock 모드에서만 확인하고 끝내지 말 것"과 짝으로, 실 Supabase 연동 확인도 필요하면 `supabase db push` 반영 후 별도 확인).
- `supabase db query --linked`로 `week_leaderboard`/`prediction_results`가 새 `week_key`로 정상 집계되는지 재확인.

---

## 6단계 — PR

- 브랜치명: Linear 프로젝트 브랜치(이 워크트리 `predictions-week-boundary-saturday`는 이름만 검토 초기의 오기 — 실제 PR 브랜치명은 Linear 이슈 생성 후 그 규칙을 따른다).
- PR 설명에 관련 Linear 이슈 ID + `Fixes TEA-XX`, "무엇을·왜" 요약, **0단계에서 확정된 3가지 결정 사항을 그대로 명시**(리뷰어가 이 PR만 보고도 왜 이렇게 됐는지 알 수 있게).

---

## 요약 — 지금 상태

- DB(1단계 1,2,4번)·클라이언트(2단계 1,2,3번)·테스트 구조(4단계 1,3,4번)는 **0단계 결정 없이도 방향이 확정**돼 있다.
- 1단계 3,5번, 2단계 4,5번, 4단계 2,5번은 **0단계 확인 후에만 정확히 채울 수 있다.**
- 사람 승인(0단계 답변)이 오면 이 plan.md를 갱신해 TBD를 확정 SQL/코드로 채우고 나서 구현을 시작한다.
