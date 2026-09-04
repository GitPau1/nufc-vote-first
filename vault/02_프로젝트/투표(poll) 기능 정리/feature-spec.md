# 투표(poll) 기능 정리 — feature-spec

이 문서는 `intent.md`의 확정 결정을 실제 코드 `파일:줄` 단위로 구체화한다. **intent.md의 결정은 바꾸지 않는다** — 여기서는 "어떻게 구현할지"만 다룬다. 조사는 이 worktree(`refactor/poll-cleanup`, `origin/main` 311ae3f 기준)에서 직접 확인했다.

읽는 법: 각 섹션 제목에 Linear 이슈 번호를 붙였다. §2는 intent가 developer 판단으로 넘긴 항목이 많아 다른 이슈보다 길다. "사람 확인 필요"라고 적힌 항목은 이 spec에서 결론을 안 냈다는 뜻이니 plan.md 전에 답을 받아야 한다.

---

## 0. 지금 상태 요약 (모든 이슈의 공통 전제)

- `polls.type`, `polls.status`, `players.squad_status`는 DB에서 전부 **`text` 컬럼이고 CHECK 제약/enum이 없다**(`supabase/migrations/20260527155049_initial_schema.sql:33,37`, `20260529090000_player_status_poll_thumbnail.sql:3-4`). 값 강제는 TypeScript(`frontend/src/types/database.ts:3-4`)와 애플리케이션 코드에만 있다. 즉 **DB 마이그레이션 없이 앱 코드만 바꿔도 허용값을 좁힐 수 있다** — 이게 §2의 마이그레이션 리스크를 크게 낮춘다.
- `poll_options.image_url`/`description`은 `20260602090000_add_poll_option_descriptions.sql:1-5`에서, `players.squad_status`/`polls.thumbnail_url`은 `20260529090000_player_status_poll_thumbnail.sql:3-7`에서 이미 컬럼으로 존재한다(둘 다 3개월 넘게 지난 migration). `frontend/src/types/database.ts`에도 네 컬럼 모두 반영돼 있다(`players` Row 37-46행, `poll_options` Row 71-80행). §5에서 자세히 다룬다.
- `frontend/src/types/database.ts`의 `players` Row에 DB에 실재하는 `nationality`/`birth_date` 컬럼이 빠져있다(`supabase/migrations/20260821092457_remote_schema.sql:89,91`에서 추가됨). 이번 작업 범위는 아니지만 발견한 김에 기록 — 사람 확인 후 별도 이슈로 뺄지 판단 필요.

---

## TEA-25 — 예정 투표(scheduled) 기능 제거

**근거**: intent.md §1 (프로덕션 `scheduled` 0건, 생성 경로 없음, 자동전환 cron 미구현).

### 변경 대상

| 파일:줄 | 지금 | 바꿀 내용 |
|---|---|---|
| `frontend/src/lib/polls/status.ts:9-19` | `getEffectivePollStatus`가 `scheduled_at` 지남 여부로 `scheduled→active` 승격 분기(11-17행)를 가짐 | `PollStatus`가 `'active'\|'closed'`만 남으면 이 분기 전체 삭제, 함수는 `closes_at` 체크(10행)만 남기거나 함수 자체를 인라인 |
| `frontend/src/lib/polls/vote-eligibility.ts:9-13` | 10행 `status !== 'active'`, 11행 `scheduled_at` 미래 체크 | 11행 삭제(scheduled_at 자체가 없어지므로), 10행은 유지 |
| `frontend/src/lib/polls/poll-edit-eligibility.ts:16-32` | `EditablePollField` 타입, 19-24행 `canAccessPollEdit`의 21행 `status === 'scheduled' return false`, 27-32행 `getEditablePollFields`의 scheduled 분기(31행 `return []`) | 21행 분기 삭제(더 이상 도달 불가 상태이므로), `getEditablePollFields`는 active/closed 두 분기만 남김 |
| `frontend/src/lib/queries/polls.ts:298-302` | `PollHomeSections` 타입에 `scheduled: PollListItem[]` | 필드 제거 |
| `frontend/src/lib/queries/polls.ts:311-369` | `getPollHomeSectionsUncached`가 `bucketPollsByStatus`(342-369행)에서 active/scheduled/closed 3분류, scheduled 정렬(355-360행) | scheduled 분류·정렬 로직 삭제, active/closed 2분류로 축소 |
| `frontend/src/components/composition/common/HomeClient.tsx:25-38` | 25행 구조분해에 `scheduled`, 28행 `heroPoll = active[0] ?? scheduled[0] ?? closed[0]`, 37행 `<PollHomeSection title="예정된 투표" polls={scheduled} />` | `scheduled` 구조분해·37행 섹션 제거, 28행 `heroPoll = active[0] ?? closed[0] ?? null` |
| `frontend/src/components/composition/polls/PollListClient.tsx:15,68,72,76,82,118,134,140,147` | `PollTab` 유니온에 `'scheduled'`, `scheduled` 필터(68행), 탭 카운트/빈 상태 문구(118행)/`PollTabs` prop(134-147행) | `scheduled` 관련 전부 제거, 탭은 all/active/closed 3개로 축소 |
| `frontend/src/components/composition/polls/PollCard.tsx:39-43` | `getStatusLabel`의 40행 `status === 'scheduled'` 분기(공개예정 라벨/카운트다운) | 40행 삭제, closed/기본(진행중) 2분기만 남김 |
| `frontend/src/lib/queries/polls.ts` (select 상수) | `POLL_LIST_SELECT`(209-213행)·fallback(214-218행)·`getPollById` select(381-386, 393-398행)에 `scheduled_at` 컬럼 포함 | DB 컬럼 자체를 지우지 않는 한(§2-a 이하 참고, 이번 스코프에 컬럼 DROP은 없음) select 목록은 유지 가능 — 단 `PollListItem`/`PollDetail` 타입(19-54행)에서 `scheduled_at` 필드를 제거하면 select에서도 자연히 뺀다. **DB 컬럼 DROP 여부는 §5-연동 판단**(아래 "DB 컬럼 정리" 참고) |
| `frontend/src/types/database.ts:4` | `PollStatus = 'scheduled' \| 'active' \| 'closed'` | `'active' \| 'closed'`로 축소 |
| `vault/99_old/specs/07-scheduled-polls.md` | 예정 투표 기능 스펙 전체 | "기능 없음"으로 갱신(문서 갱신 목록에 포함, 아래 §문서 갱신) |

### DB 컬럼 정리 (scheduled_at)

- `polls.scheduled_at` 컬럼 자체를 DROP할지, 컬럼은 남기고 안 쓸지는 **사람 확인 필요** — DROP은 되돌리기 어려운 스키마 변경이라 intent.md 기준 plan.md 승인 시 재확인 대상. 근거: 프로덕션 13개 poll 전부 `scheduled_at IS NULL`(intent.md 실측)이라 DROP해도 데이터 손실은 없지만, "정리축에 DB·스키마도 포함"이라는 intent 범위상 컬럼까지 지우는 게 맞는지는 취향 판단(더 깨끗함) vs 리스크 회피(컬럼 남겨도 무해) 사이 선택이라 이 spec에서 임의로 정하지 않는다.
  - **선택지 A**: 컬럼 유지, 앱 코드에서만 안 씀 — 마이그레이션 불필요, 롤백 걱정 없음.
  - **선택지 B**: `ALTER TABLE polls DROP COLUMN scheduled_at;` — 스키마가 깨끗해지지만 롤백 시 컬럼 재생성 필요(데이터는 어차피 전부 NULL이라 복구할 값 없음).
  - 이 spec의 제안(사용자 목표가 아니라 리스크 회피 관점 표시): **선택지 A**를 plan.md 1차안으로 제안 — TEA-25는 "기능 제거"가 목적이지 "컬럼 제거"가 목적이 아니고, §2에서 이미 DB 마이그레이션이 하나 예정돼 있어 한 프로젝트 안에 마이그레이션을 늘리지 않는 게 검증 부담이 적다. 확정은 plan.md 단계에서 사람이.

### 영향받는 테스트

- `frontend/src/lib/polls/status.test.mjs` — 전체 파일이 scheduled→active 전환 로직 테스트(L38-58). **파일 전체 재작성 대상.**
- `frontend/src/lib/polls/vote-eligibility.test.mjs:38-65` — `status: 'scheduled'` 케이스 포함 4종 차단 검사. scheduled 케이스 삭제, 나머지 3종(닫힘/미래시작/마감지남)은 유지.
- `frontend/src/lib/polls/poll-edit-eligibility.test.mjs:70-81,130-139` — scheduled 관련 2개 케이스 삭제.
- `frontend/src/components/composition/polls/poll-list-client.test.mjs:28-42` — `const heroPoll = active[0] ?? scheduled[0] ?? closed[0] ?? null` 리터럴 검사(L36) → `active[0] ?? closed[0] ?? null`로 단정문 재작성.

### 검증

`npm test`(전체), 개별로는 `npm run test:vote-eligibility`. `status.test.mjs`/`poll-edit-eligibility.test.mjs`엔 개별 script가 없어 `npm test`로만 확인됨(CLAUDE.md 명시).

### 불변 제약 영향

- 세 불변 제약과 직접 충돌 없음. `canSubmitVote`에서 scheduled 분기 제거는 "아직 시작 안 한 투표" 개념 자체가 없어지는 것뿐, 제출 후 수정 불가/결과 공개 시점/댓글 참여자 제한과는 무관.

---

## TEA-26 — PollType 통합

**근거**: intent.md §2, §2-a. 여기가 이번 정리의 핵심이자 가장 판단이 많은 이슈다.

### 2-1. DB enum/컬럼 설계 (근거 기반 제안)

**조사 결과**: `polls.type`은 `text` 컬럼이고 CHECK 제약이 전혀 없다(0-섹션 참고). `Enums: { poll_type: PollType }`(`database.ts:402-405` 부근, TS 전용 매핑)도 실제 Postgres enum이 아니다. 즉 DB는 애초에 `type` 값을 강제한 적이 없다.

**제안**: **컬럼은 유지하고 앱 로직만 통합한다.** DB 마이그레이션으로 enum/CHECK를 새로 만들 필요도, `type` 컬럼 자체를 없앨 필요도 없다.
- 이유: (1) DB가 애초에 값을 강제하지 않으므로 "DB 설계를 바꾼다"는 게 스키마 변경이 아니라 순수 애플리케이션 코드 변경이다. (2) `overall_rating`은 분리 유지(intent 확정)이므로 `type` 컬럼 자체는 계속 필요하다 — "일반 투표"(subject_options/question_targets/free_choice/evaluation/selection 통합) vs `overall_rating` 두 갈래를 구분하는 역할은 남는다.
- 구체적으로: 생성 시 저장하는 `type` 값을 `'poll'` 같은 새 단일 값으로 통일할지, 아니면 기존 `subject_options`/`question_targets`/`free_choice` 세 문자열을 계속 쓰되 화면 분기만 걷어낼지는 **선택 필요**:
  - **안 A (문자열 유지, 분기만 제거)**: `createUserPoll`이 여전히 사용자가 고른 (a)/(b) 조합에 따라 `subject_options`/`question_targets`/`free_choice` 중 하나를 저장한다(예: 대상선수 있음+선택지 선수 없음→`subject_options`, 선택지마다 선수→`question_targets`, 둘 다 없음→`free_choice`, 둘 다 있음은 지금 폼에 없는 조합이라 신규 결정 필요 — 아래 2-4 참고). `app/polls/[id]/page.tsx`의 화면 분기(92행)는 그대로 세 값을 화이트리스트로 묶어 TypeB로 보내면 되므로 **코드 변경이 사실상 없다.**
  - **안 B (새 단일값 `'poll'`로 저장)**: `createUserPoll`이 무조건 `type: 'poll'`로 저장하고, 화면 분기는 `type` 대신 실제 데이터 모양(예: `poll_options`에 `player_id`가 있는지)으로 바꾼다. 개념적으로 더 깔끔하지만 `app/polls/[id]/page.tsx:92`의 분기 기준을 새로 설계해야 하고(2-3 참고), 기존 13개 poll의 `type`도 마이그레이션 문장으로 `'poll'`로 바꿔야 한다(되돌리기 어려운 데이터 변경 1건 추가).
  - **이 spec의 제안**: **안 A**. 근거: "타입 선택 UI를 없앤다"는 intent 결정은 **생성 폼의 사용자 노출 개념**을 없애는 것이지 저장 값의 재설계를 요구하지 않는다. 안 A는 마이그레이션·화면 분기 변경이 거의 없어 회귀 위험이 가장 낮다. 이건 리스크 회피 관점의 제안이며, "개념을 완전히 지운다"는 사용자 목표에 더 부합하는 건 안 B다 — **사람 확인 필요**.

### 2-2. `selection` 1건 마이그레이션 문장 최종 형태

intent.md 확정 문장을 그대로 쓰되, 안 A/B에 따라 목적 값만 다르다:
```sql
-- 안 A (문자열 유지) — intent.md 원안 그대로
update polls set type = 'free_choice' where id = '66377eb0-6773-4274-b8cc-4555816d4381';

-- 안 B (신규 단일값)
update polls set type = 'poll' where id = '66377eb0-6773-4274-b8cc-4555816d4381';
```
`evaluation`은 프로덕션 0건이라 마이그레이션 대상 아님(코드에서 참조만 제거).

**이 SQL은 plan.md 승인 시 다시 명시적으로 확인**(intent.md 요구사항).

### 2-3. 렌더 분기 기준 재검토

현재 `frontend/src/app/polls/[id]/page.tsx:92-96`:
```
92  if (poll.type === 'selection' || poll.type === 'question_targets' || poll.type === 'free_choice') {
93    return <TypeBPollClient poll={poll} isAuthenticated={!!user} canEdit={canEdit} />
94  }
95
96  return <TypeAPollClient poll={poll} isAuthenticated={!!user} canEdit={canEdit} />
```
**중요한 실측 사실**: 이건 `type` 문자열 화이트리스트지, intent.md가 서술한 "사실상 poll에 선수가 달려있나" 기준이 **아니다**. 명시적으로 나열 안 된 `subject_options`(현재 생성 폼의 정식 타입)는 default 경로로 TypeA에 떨어진다 — 우연히 맞아떨어질 뿐 `player_id` 유무를 실제로 검사하지 않는다.

**TypeA/TypeB 실제 차이 대조** (조사 결과, 완전한 코드 인용):
- `handleConfirm` 로직은 **토큰 단위로 100% 동일**하다(`TypeAPollClient.tsx:43-69` vs `TypeBPollClient.tsx:65-91`) — `submitVote` 호출, `trackEvent('vote_submitted', {...})` 9개 필드, 에러 메시지 분기까지 한 글자도 다르지 않음. → TEA-28에서 공유 훅으로 추출(아래 §4-3).
- 마크업 차이만 존재: TypeA는 커버 이미지 위에 칩+제목을 오버레이(90-117행, "평가" 칩 하드코딩 95-98행), 하단에 "선수 정보" 카드 추가(§3 표 "유형 뱃지" 항목과 연동, 이번에 "평가" 칩은 제거 대상). TypeB는 커버 이미지 단독 블록 + 아래 별도 글 컨테이너(제목/상태뱃지/날짜/작성자/설명, 113-155행), 옵션은 라디오 리스트(썸네일 40px pill + 라벨, 164-231행).
- `design-foundation.test.mjs`가 TypeA엔 `banner-text-overlay`가 있어야/TypeB엔 없어야 함을 명시적으로 검사한다(L96-136) — 즉 이 마크업 차이는 의도된 디자인 계약이지 우연이 아니다.

**렌더 분기 기준 제안**: `type` 문자열 대신 **poll 전체에 선수가 달려있는지**(`poll.player_id` 유무)로 바꾼다.
```
if (poll.player_id) return <TypeAPollClient ... />   // "이 투표는 특정 선수 하나에 대한 것"
return <TypeBPollClient ... />                        // 그 외 전부(선택지별 선수 연결 포함, 선수 없음도 포함)
```
근거: intent.md §2 결정 자체가 "poll 전체 선수 연결" vs "선택지별 선수 연결(또는 없음)"을 독립 슬롯 두 개로 재정의했으므로, 화면도 그 두 슬롯 중 첫 번째("poll 전체 선수")를 기준으로 나누는 게 결정과 정합적이다. 기존 13개 poll 검증: `subject_options`(3건, poll.player_id 있음)→TypeA 유지, `question_targets`(3건, poll_options.player_id만 있음)→TypeB 유지, `free_choice`+`selection`(7건, 둘 다 없음)→TypeB 유지. **기존 동작이 그대로 보존된다.**

**TypeA/TypeB 컴포넌트 자체를 통합할지**: **통합하지 않는 것을 제안**. 근거: 위 대조에서 로직은 100%, 마크업은 의도된 디자인 계약으로 다르다 — 합치면 `design-foundation.test.mjs`(L77,101,126,304-305)와 `login-modal.test.mjs`(L18-19)가 파일 경로 하드코딩 때문에 깨져서 재작성해야 하고, `handleConfirm` 중복은 컴포넌트를 합치지 않고도 공유 훅 추출(§4-3)로 해결 가능하다. 컴포넌트 병합은 이번 정리 목표(중복 제거)를 넘어서는 별도 리팩터링이라 스코프 확장 — **사람 확인 필요**(원하면 별도 후속 이슈로).

### 2-4. 생성 폼 재구성

**현재 구조** (`UserPollCreateForm.tsx`):
- `POLL_TYPES`(19-24행) 4개: `subject_options`/`question_targets`/`free_choice`/`overall_rating`.
- 타입별 분기(231-326행): `subject_options`→대상 선수 1명 + 텍스트 선택지(231-256행), `free_choice`→선택지별 라벨/설명/이미지크롭 1000×1300(257-302행, 크롭 289행), 그 외(`question_targets`/`overall_rating`)→다중 선수 선택 UI 공용(303-326행, `overall_rating`이면 라벨만 "평가 대상 선수"로 바뀜 307행).
- 대표 이미지 크롭은 1200×400(220-227행)로 선택지 카드 크롭(1000×1300)과 별개.

**intent 결정대로 재구성**: "투표 형식" 2카드(일반 투표/전체 평점) + 일반 투표 안에 (a) 대상 선수 토글 (b) 선택지별 선수 연결 두 옵션.

**선택지 데이터 형태 제안**: 지금 세 갈래로 나뉜 옵션 입력(텍스트만/라벨+설명+이미지크롭/선수선택)을 하나의 옵션 카드로 합친다.
```ts
type UnifiedOption = {
  label: string
  description?: string | null   // free_choice 옵션엔 있었지만 subject_options 텍스트 옵션엔 없었음
  imageUrl?: string | null      // free_choice 전용이었음
  playerId?: string | null      // question_targets 전용이었음
}
```
**이미지 vs 선수 사진 공존 — 사람 확인 필요**: intent.md가 명시적으로 질문 형식을 요구한 지점.
- **상황**: (b) "선택지별 선수 연결"을 켜면 그 옵션은 이미 `player.photo_url`이 있다(`ResultView.tsx`의 `getOptionThumb`가 이미 이 우선순위로 썸네일을 고름). 그런데 지금 `free_choice`는 옵션마다 1000×1300 크롭 이미지를 사용자가 직접 올린다. 하나의 통합 폼에서 "이 옵션에 선수를 연결했다"와 "이 옵션에 이미지를 올렸다"가 동시에 가능해지면 어느 쪽을 카드에 쓸지 규칙이 필요하다.
- **선택지**:
  1. 선수 연결된 옵션은 이미지 업로드 UI 자체를 숨기고 무조건 선수 사진을 쓴다(현재 `getOptionThumb`의 fallback 순서와 자연스럽게 일치).
  2. 선수를 연결해도 이미지 업로드를 허용하고, 업로드하면 그 이미지가 선수 사진보다 우선한다(사용자가 원하면 다른 이미지로 대체 가능).
  3. 애초에 (b)를 켜면 모든 옵션이 "선수 선택" 방식이 되고 커스텀 이미지 옵션은 함께 못 쓴다(지금 `question_targets` 방식 그대로, 이미지 업로드 UI가 이 모드에서 아예 안 나옴).
- **트레이드오프**: 1안은 단순하지만 사용자가 선수 사진 대신 다른 이미지(팬아트 등)를 쓰고 싶을 때 막는다. 2안은 유연하지만 "선수 연결 옵션인데 이미지가 다르다"는 헷갈리는 상태가 생긴다. 3안은 지금 코드 구조 변경이 가장 적다(옵션 카드가 "선수 목록에서 고르기" 모드와 "직접 입력(라벨+설명+이미지)" 모드로 나뉘는 지금 구조를 유지, 두 모드 중 어느 걸 쓸지만 poll 단위로 고르게 함).
- **이 spec의 제안(리스크 회피 관점)**: 3안. 지금 코드가 이미 이 경계로 나뉘어 있어(`question_targets` 분기 vs `free_choice` 분기) 구현 변경이 가장 적고, 기존 13개 poll도 전부 이 경계 중 하나에 속한다. 최종 결정은 **사람 확인 필요**.

**`createUserPoll` payload 변경**:
- `frontend/src/lib/actions/polls.ts:18-101` — `type`을 폼에서 안 받고(19행 `formData.get('type')`) 서버가 옵션 모양으로 추론하거나(안 B라면), 안 A를 따르면 폼이 여전히 계산해서 넘긴다(대상선수 유무+선택지 선수 유무 조합 → 문자열). `player_id` 필수 검증(56행, 지금 `subject_options`에서만)은 "대상 선수 토글 켬" 조건으로 바뀐다. `options` JSON 구조가 `UnifiedOption`으로 통일되며 `poll_options` insert(91행)의 필드도 `label`/`description`/`image_url`/`player_id`를 조건 없이 다 받는 형태로 단순화된다(지금은 타입별로 다른 형태의 JSON을 조립해서 넘김).

### 2-5. `UserPollEditForm.tsx` 처리

- `showSubjectPlayer = poll.type === 'subject_options' || poll.type === 'evaluation'`(44행)는 안 A를 따르면 그대로 유지(값이 안 바뀌므로). 안 B라면 `poll.player_id` 유무 기준으로 바꿔야 함(2-3과 동일한 기준으로 통일하는 게 일관적).
- `POLL_TYPE_LABELS`(18-23행)는 타입 자체가 화면에 안 보이면(투표 유형 섹션, 86-91행) 통째로 걷어낼지, "일반 투표"/"전체 평점" 2개 라벨로 축소할지 — 이건 생성 폼과 대칭을 맞추는 게 자연스러우므로 2개 라벨로 축소 제안. 수정 가능 필드 판정(`poll-edit-eligibility.ts`)은 type과 무관하게 이미 title/description/thumbnail_url만 다루므로 **변경 없음**.

### 2-6. `getPollFormPlayers()` 필터 (2-a 후속 검토)

**실측**: `frontend/src/lib/queries/polls.ts:176-189`에서 `players` 테이블을 `.eq('is_active', ...)` 같은 조건 없이 전체 조회(정렬만 `squad_number` 기준, 180행). `is_active`/`squad_status` 컬럼은 select에 포함되지만 필터로 안 쓰인다. 즉 **은퇴/방출 선수도 후보 목록에 그대로 노출된다.**
- 포함 여부는 intent.md 명시대로 **사람 확인 필요**. 참고로 넣는다면 가장 단순한 조건은 `is_active = true`(컬럼이 이미 select에 있어 쿼리 추가만 필요, 마이그레이션 불필요)이고, `squad_status`까지 볼지는 추가 판단 필요.

### 영향받는 테스트

- `frontend/src/components/composition/polls/login-modal.test.mjs:14-22` — `TypeAPollClient.tsx`/`TypeBPollClient.tsx` **파일 경로**를 하드코딩. 컴포넌트를 안 합치면(2-3 제안대로) 영향 없음.
- `frontend/src/components/design-foundation.test.mjs:77,101,126,304-305` — 동일하게 파일 경로 하드코딩. 컴포넌트 안 합치면 영향 없음. 단 95-98행 "평가" 칩을 지우면 이 파일의 오버레이 검사(L96-136, `banner-text-overlay` 유무)는 칩과 무관해 영향 없음.
- poll type 값(`evaluation`/`selection`/`free_choice`/`subject_options`/`question_targets`/`overall_rating`) 문자열을 검사하는 테스트는 **0건**(테스트 조사에서 grep 확인) — 저장 값을 안 A/B 어느 쪽으로 바꿔도 테스트는 안 깨진다.
- `frontend/src/lib/mock/data.ts:68,81,98,111,124,137,182,191,204,212,220,229` — mock fixture가 `evaluation`/`selection`을 계속 poll.type 값으로 씀. 안 A를 따르면 mock도 실제 코드 분기와 어긋나지 않게 유지 가능(이미 `evaluation→TypeA default`, `selection→TypeB whitelist`로 우연히 맞음). 다만 mock이 "지금은 생성 불가능한 레거시 값"을 계속 쓰는 게 맞는지는 문서화만 하면 되고 굳이 갱신할 필요는 없음(실제 프로덕션에도 남아있는 값이라 fixture로서 유효).
- `frontend/src/storybook/contents/{CommentsSection,PollCard,PollHomeSection,PollHeroCard,PollCarouselCard}.stories.tsx`의 `selection` 참조 5건 — 값 자체는 안 A에서 그대로 유효한 문자열이라 안 바꿔도 동작하지만, "이제 이 값으로 생성할 수 없다"는 사실과 어긋나 스토리북 fixture 의미가 흐려질 수 있음. 정합성 위해 갱신 권장하되 필수는 아님.

### 검증

`npm test` 전체(개별 script 없음 — CLAUDE.md 확인). DB 변경 있는 경우 `supabase db push` 전 `plan.md`에서 재확인.

### 불변 제약 영향

- 제출 후 수정 불가: `votes` UNIQUE 제약과 무관한 변경, 영향 없음.
- 결과는 참여 후 공개: `app/polls/[id]/page.tsx`의 `showResult` 판정(72-89행 부근)은 `type`이 아니라 `isClosed || hasVoted` 기준이라 이번 변경과 무관.
- 댓글은 참여자만: `comments.ts`의 `hasVoted` 체크는 poll type과 무관, 영향 없음.

---

## TEA-27 — 표지 반응형(160/252) · 설명 textarea · 스펙 문서 갱신

### 3-1. 표지 반응형 높이

**실측**: 아래 5개 컴포넌트가 표지 이미지 높이를 각자 하드코딩하고 있다(플랫 값, 반응형 분기 없음).

| 파일:줄 | 지금 값 |
|---|---|
| `TypeAPollClient.tsx:90` | `h-[160px]` |
| `TypeBPollClient.tsx:121` | `h-[252px]` |
| `ResultView.tsx:110` | `h-[252px]` |
| `OverallRatingPollClient.tsx:155` | `h-[252px]` |
| `OverallRatingResultView.tsx:55` | `h-[252px]` |

**적용안**: `h-[160px] sm:h-[252px]`(Tailwind `sm:` = 640px, `AppHeader.tsx:35,63`가 모바일/데스크탑 GNB 전환에 실제로 쓰는 것과 같은 브레이크포인트 — `sm:hidden`/`hidden ... sm:flex` 확인됨)로 5곳 다 통일. 공통 컴포넌트로 뽑을지: 5곳 모두 `<img ... className="{h값} w-full object-cover">` 한 줄이라 추출해도 이득이 적고(한 줄 클래스 문자열 상수화 정도), 추출한다면 `lib/`가 아니라 클래스 문자열 상수 하나(예: `POLL_COVER_HEIGHT_CLASS`)를 어디에 둘지가 "이름/위치 발명"에 해당 — **사람 확인 필요**(후보 1개: `frontend/src/lib/constants.ts`에 문자열 상수 추가, 이미 `PAGE_SIZE` 등 도메인 상수를 이 파일이 갖고 있어 자리가 맞음).
- **참고(스코프 확인 필요)**: `PollHeroCard.tsx:25`도 동일하게 `h-[252px]`를 쓴다(홈 캐러셀 히어로). intent.md·조사 지시 대상 5개 목록엔 없었지만, 같은 시각적 패턴이라 반응형 통일에서 빠지면 이질적으로 보일 수 있음 — 포함 여부 **사람 확인 필요**.

### 3-2. 설명 textarea 전환

| 파일:줄 | 지금 |
|---|---|
| `UserPollCreateForm.tsx:218` | `<input name="description" className="input-field" placeholder="설명(선택)" />` |
| `UserPollEditForm.tsx:103` | `<input name="description" defaultValue={poll.description ?? ''} className="input-field" placeholder="설명(선택)" />` |

**변경**: 둘 다 `<textarea>`로 전환, 기존 옵션 설명 textarea(`UserPollCreateForm.tsx:270-275`, `min-h-[72px] resize-none py-2`)와 동일한 클래스 패턴을 재사용 제안(비대칭 해소 취지와 일치).

### 3-3. 스펙 문서 갱신 (§문서 갱신 섹션에 통합 기재)

`vault/99_old/specs/04-poll-list.md`, `05-poll-detail.md`가 코드와 어긋나는 지점(intent.md §3 표에 정리됨: 유형뱃지 없음, 카드 부제 없음, 표지 150px→160/252 반응형, 뒤로가기 버튼·캐러셀·최다득표 카드는 스펙 폐기)을 코드에 맞게 갱신.

### 영향받는 테스트

- `frontend/src/components/composition/polls/result-view-figma-contract.test.mjs:11-14` — **`assert.match(resultView, /h-\[252px\]/)`, `assert.doesNotMatch(resultView, /h-\[188px\]/)`**. 252px가 `h-[160px] sm:h-[252px]`로 바뀌면 정규식 `/h-\[252px\]/`는 여전히 매치(문자열에 `h-[252px]`가 부분포함)하므로 **1차 통과 가능성 높음** — 단 반드시 실행해서 확인해야 함(정규식이 앞뒤 경계를 안 잡으므로 `sm:h-[252px]`도 매치됨). `h-[188px]` 없음 조건은 영향 없음.
- `frontend/src/components/composition/polls/poll-list-client.test.mjs:44-59` — `hero` 소스에서 `relative block h-[252px] overflow-hidden rounded-lg`(L56)를 **정확히 이 순서의 클래스 문자열**로 검사(`PollHeroCard.tsx:25`). 만약 3-1에서 `PollHeroCard`도 반응형으로 바꾸면 이 단정문이 깨짐 → 옮겨간 클래스 문자열 기준으로 재작성 필요. `PollHeroCard`를 스코프에서 뺀다면 이 테스트는 영향 없음.
- description textarea 전환을 검사하는 테스트는 **0건**(grep 확인) — 안전.

### 검증

`npm test`(위 두 파일 다 개별 script 없음 — `npm test`로만 확인 가능, CLAUDE.md 명시).

### 불변 제약 영향

없음(순수 표시/입력 UI 변경).

---

## TEA-28 — 코드 구조 정리 (동작 변화 없음)

intent.md §4 5개 항목을 파일:줄로 구체화.

### 4-1. fallback query 공용 헬퍼

- 대상: `getPollFormPlayers`(175-189행), `getPollListUncached`(269-284행), `getPollHomeSectionsUncached`(315-330행), `getPollById`(379-404행 부근) — 4곳 모두 "1차 select → `isMissingColumnError` 감지(132-138행) → 컬럼 뺀 재시도" 패턴이 동일.
- 제안: `queryWithFallback<T>(primary: () => Promise<{data,error}>, fallback: () => Promise<{data,error}>)` 형태의 공용 헬퍼로 추출, `queries/polls.ts` 안에 두거나 `lib/queries/_shared.ts` 신설 — **파일 위치는 이름/카테고리 발명에 해당해 사람 확인 필요**(후보 1개: 같은 파일 안 상단 헬퍼로 유지, poll 쿼리 전용이라 굳이 새 공유 파일을 안 만들어도 됨).
- **TEA-29와 연동**: §5에서 fallback 자체를 걷어낼 수 있다는 결론이 나오면(컬럼이 이미 다 있으므로) 이 리팩터링은 **불필요해진다** — 순서 의존 있음(아래 "이슈 간 의존 순서" 참고).

### 4-2. service-role 클라이언트 생성 공용 헬퍼

대상 8곳, 전부 `requireAdminClient()`(관리자 전용, 재사용 불가) 대신 `@supabase/supabase-js`의 `createClient`를 직접 dynamic import:

| 파일:줄 | 함수 |
|---|---|
| `queries/polls.ts:116-120` | `getPollVoteCounts` 내부 |
| `queries/polls.ts:152-156` | `getCreatorNamesById` 내부 |
| `queries/polls.ts:454-458` | `getVoteCounts` 내부 |
| `actions/polls.ts:58-62` | `createUserPoll` 내부 |
| `actions/polls.ts:164-168` | `updateUserPoll` 내부 |
| `actions/comments.ts:173-177` | `updateComment` 내부 |
| `actions/comments.ts:215-219` | `deleteComment` 내부 |

제안: `lib/supabase/service-client.ts` 신설, `getServiceRoleClient()` export(이름 후보 — **사람 확인 필요**, 기존 `admin.ts`의 `requireAdminClient`와 구분되는 이름이어야 함). 권한 검사는 각 호출부가 이미 자체로 하고 있으므로(예: `actions/polls.ts`의 `isAdmin` 체크) 헬퍼 자체엔 권한 로직을 넣지 않고 클라이언트 생성만 담당.

### 4-3. TypeA/TypeB `handleConfirm` 공유 훅

- `TypeAPollClient.tsx:43-69`와 `TypeBPollClient.tsx:65-91`이 완전 동일(§2-3에서 대조 완료). `useVoteConfirm(poll)` 같은 훅으로 추출해 `selectedId`/`showConfirm`/`errorMsg`/`isPending`/`handleConfirm`을 반환하는 형태 제안. 위치는 두 컴포넌트가 함께 있는 `components/composition/polls/` 안에 `use-vote-confirm.ts`(후보, **사람 확인 필요** — 새 파일 이름).

### 4-4. 과대 파일 책임 분리

- `queries/polls.ts`(현재 598행 — 조사 시점, "조회+집계+fallback+평점 계산" 혼재)와 `actions/comments.ts`(현재 271행)를 어떻게 쪼갤지는 intent.md도 "위치 재검토" 수준으로만 언급했고 구체적 분리 경계(예: 평점 관련 함수만 `queries/ratings.ts`로 뺄지)는 **사람 확인 필요** — 폴더/파일 이름을 새로 짓는 결정이라 CLAUDE.md 원칙 1번(구조 임의 발명 금지)에 해당.

### 4-5. `ResultView.tsx`의 `getOptionThumb`/`formatPollDate` 위치 재검토

- 실측: `getOptionThumb`(54-63행), `formatPollDate`(40-48행) 둘 다 export 되어 있고, `TypeBPollClient.tsx:21`과 `UserPollEditForm.tsx:13`이 import해서 씀(`result-view-figma-contract.test.mjs:66`도 `getOptionThumb` 문자열 존재를 검사). "결과 화면용 파일"이 다른 화면의 헬퍼 소스가 되는 이름-책임 불일치는 실재 — 어디로 옮길지(`lib/polls/format.ts`? `components/composition/polls/poll-format.ts`?)는 새 파일 이름 발명이라 **사람 확인 필요**.

### 영향받는 테스트

- `result-view-figma-contract.test.mjs:66` — `getOptionThumb`가 `ResultView.tsx` 밖으로 옮겨지면 이 파일의 `assert.match(resultView, /getOptionThumb/)`가 깨짐(함수가 더 이상 그 파일에 없으므로) → re-export 유지하거나 테스트를 새 위치 기준으로 재작성.
- 그 외 4-1/4-2/4-3(순수 내부 구조 변경, 외부 동작·마크업·문자열 불변)은 소스 문자열 검사 테스트에 영향 없음 — 단, 4-2에서 새 헬퍼 함수/파일을 만들면 만든 파일이 다른 테스트가 검사하는 파일 목록에 없는지 확인만 하면 됨(현재 grep 결과 없음).

### 검증

`npm test` 전체 + `npm run lint` + `npm run build`(구조 변경이라 빌드 확인 필수).

### 이슈 간 의존 순서 (TEA-28 내부)

4-1(fallback 헬퍼)은 TEA-29 §5 결론이 먼저 나와야 방향이 정해진다 — fallback을 아예 없앨 수 있으면 헬퍼 자체가 불필요. **TEA-29를 TEA-28보다 먼저 결정**(구현 순서가 아니라 "결론이 먼저 필요"라는 뜻).

### 불변 제약 영향

없음(intent.md 명시: "동작 변화 없음, 순수 리팩터링"). 리팩터링 중 세 불변 제약(제출 후 수정 불가/결과 공개 시점/댓글 참여자 제한)을 건드리는 코드 경로(`votes` UNIQUE, `canSubmitVote`, `hasVoted`)는 이번 4개 항목 어디에도 포함되지 않는다.

---

## TEA-29 — DB/스토리지 정리 확인

### 5-1. fallback이 막아주는 컬럼 — 실제 존재 여부 대조

| 컬럼 | migration | 존재 여부 |
|---|---|---|
| `players.squad_status` | `20260529090000_player_status_poll_thumbnail.sql:3-4` | **존재** |
| `polls.thumbnail_url` | `20260529090000_player_status_poll_thumbnail.sql:6-7` | **존재** |
| `poll_options.image_url` | `20260602090000_add_poll_option_descriptions.sql:1-5`(및 `20260618120000_restore_overall_rating.sql:3-4`에서 재확인성 재추가) | **존재** |
| `poll_options.description` | `20260602090000_add_poll_option_descriptions.sql:1-5` | **존재** |

**결론**: 4개 컬럼 전부 migration 파일 상 존재하고, `frontend/src/types/database.ts`(players Row 37-46행, poll_options Row 71-80행)에도 반영돼 있다. **fallback 제거 가능성이 높다** — 단, "migration 파일에 있다"가 "실제 프로덕션 DB에 적용됐다"의 100% 증거는 아니므로(migration 파일과 실제 원격 DB 상태가 어긋나는 사례가 `AGENT_MAINTENANCE_GUIDE.md`에 실제로 기록돼 있음 — `ykjf…` 프로젝트 오연결 사고), **plan.md 실행 전 실제 프로덕션(`xrvz…`) 스키마를 `information_schema.columns`로 1회 조회해 최종 확인**을 권장한다(빠른 SQL 한 줄, 되돌리기 어려운 변경 아님). 이 확인을 거치면 `queries/polls.ts`의 fallback 4곳(§4-1 대상과 동일)을 걷어내고 1차 select만 남길 수 있다.

### 5-2. 선택지 이미지(`poll_options.image_url`) 스토리지 정리 로직

**실측**: `frontend/src/lib/images/storage-cleanup.ts:10-14`— 코드 주석이 명시적으로 "poll_options.image_url(poll-options/ 폴더)에는 이 삭제 로직과 같은 교차 참조 확인·정리 경로가 따로 없다"고 밝힘. `POLL_THUMBNAIL_DELETE_FOLDERS`(14행)는 `['poll-thumbnails']`만 포함, `poll-options`는 의도적으로 제외. `actions/polls.ts`의 `cleanupOldPollThumbnail`(185-222행)은 썸네일 교체 시에만 동작하고, 선택지 이미지가 교체/삭제될 때 옛 스토리지 파일을 지우는 코드 경로는 **없다**(옵션 자체가 poll 생성 후엔 수정 불가 UI이므로 "교체" 상황 자체가 지금은 없지만, poll이 삭제되거나 옵션이 재생성되면 고아 파일이 남을 수 있음).
- 정리 필요 여부: **사람 확인 필요**. 이번 스코프(§2 생성 폼 재구성)에서 선택지 이미지 업로드 흐름 자체는 유지되므로, 고아 파일 정리 로직을 새로 만드는 건 intent.md 범위(코드 정리) 밖의 **신규 기능 추가**에 가깝다 — 하지 않는 쪽을 제안하되 확정은 사람이.

### 5-3. `overall_rating`의 `setup_required` 방어 문구

**실측**: `frontend/src/lib/actions/ratings.ts:18-25`(`isMissingRatingSchemaError`)와 `91-99`(`submitRatingVotes`)에서 `rating_votes` insert 실패 시 에러 메시지에 `rating_votes`/`schema cache`/`does not exist` 문자열이 있으면 `setup_required`를 반환. 그런데 `supabase/migrations/20260618120000_restore_overall_rating.sql:6-15`에서 `rating_votes` 테이블이 이미 생성돼 있고, 프로덕션에 `overall_rating` poll이 2건 활성 상태로 실제 운영 중(intent.md 실측 count). **결론: 이 방어 문구는 지금 발생할 조건이 없다**(테이블이 이미 있고 정상 운영 중이므로) — 죽은 방어 코드에 가깝다. 제거해도 무방해 보이나, "혹시 모를 스키마 캐시 지연"에 대한 방어일 수도 있어 **완전 제거보다는 유지 + 문서에 "현재는 발생 안 함" 주석 추가를 제안**(리스크 회피 관점, 취향 판단 아님 — 제거해서 얻는 이득이 없고 유지 비용도 거의 없음). 사람이 다르게 판단하면 제거해도 안전.

### 영향받는 테스트

- fallback 제거(5-1) 시 `isMissingColumnError`(132-138행) 함수 자체가 미사용이 될 수 있음 — 이를 검사하는 테스트는 없음(grep 확인). TEA-28 §4-1과 동일한 4개 함수가 대상이므로 테스트 영향도 §4-1과 동일.
- 5-2, 5-3은 코드 변경이 없거나 매우 국소적이라(주석 추가 수준) 영향받는 테스트 없음.

### 검증

fallback 제거는 `npm run build` + `npm test`로 충분(select 문자열 상수 변경뿐). 프로덕션 스키마 확인은 SQL 조회라 애플리케이션 테스트 대상이 아님.

### 불변 제약 영향

없음.

---

## 이슈 간 의존 순서 (전체)

1. **TEA-29 §5-1 확인이 TEA-28 §4-1보다 먼저**: fallback을 없앨 수 있는지 결론이 나야 "공용 헬퍼로 추출"이 의미가 있는지(또는 아예 fallback 코드 자체가 사라져 헬퍼가 불필요한지) 정해진다.
2. **TEA-26이 TEA-27의 "평가" 칩 제거에 선행**: intent.md가 명시(§3 표) — "평가" 칩(`TypeAPollClient.tsx:95-98`)은 "타입 개념 자체가 없어진다"는 §2 결정에 근거해 지우는 것이므로, §2 구현(타입 통합) 없이 칩만 먼저 지우면 근거 없는 변경이 된다.
3. **TEA-26의 `handleConfirm` 중복은 TEA-28 §4-3과 독립적으로 먼저 시작 가능**: 이 중복은 §2 타입 통합과 무관하게 이미 존재하는 중복이라(현재 코드 기준 실측), TEA-28을 TEA-26보다 먼저 하거나 병행해도 무방. intent.md가 "TEA-26이 TEA-28의 handleConfirm 통합에 선행하는지" 물었는데, **선행 관계 없음** — 독립적으로 처리 가능하다는 게 이 spec의 결론(단, 같은 파일을 두 이슈가 건드리므로 구현 순서상 충돌을 피하려면 순차 진행 권장).
4. **TEA-25(예정투표 삭제)는 나머지와 독립적**: `PollType`이 아니라 `PollStatus`를 건드리므로 §2/§3/§4/§5 어느 것과도 파일 겹침이 적다(`poll-edit-eligibility.ts`, `PollListClient.tsx`, `HomeClient.tsx`, `queries/polls.ts`의 타입 정의 정도만 겹침). 순서 제약 없음, 가장 먼저 처리해도 무방.

권장 순서: **TEA-25 → TEA-29(§5-1 확인) → TEA-26 → TEA-27 → TEA-28**.

---

## 불변 제약 3개 — 전체 변경에서 어떻게 보존되는지

- **투표는 제출 후 수정 불가(DB UNIQUE 제약)**: `votes` 테이블의 `UNIQUE(poll_id, user_id)`(`SUPABASE_DATA_CONNECTIONS.md:237`)는 이번 어느 이슈에서도 건드리지 않는다. `submitVote()`(`actions/vote.ts:63-69`)의 `23505` 처리도 무변경.
- **결과는 참여 후에만 공개**: `app/polls/[id]/page.tsx`의 `showResult = isClosed || hasVoted` 판정은 TEA-26의 렌더 분기 변경(§2-3, `type` → `player_id` 기준)과 **별개 조건문**이라 영향 없음. TEA-25에서 `scheduled` 개념이 없어져도 이 판정 로직 자체는 안 건드림.
- **댓글은 투표 참여자만 작성 가능**: `comments.ts`의 `hasVoted`(20-33행) 체크, RLS 정책(같은 poll에 대한 본인 vote 존재 여부) 둘 다 poll type/status 값과 무관하게 동작하므로 다섯 이슈 어디에서도 변경 대상이 아니다.

---

## 문서 갱신 목록

구현 완료 후(plan.md 단계) 아래를 함께 갱신한다:

- `vault/99_old/AGENT_MAINTENANCE_GUIDE.md` — "현재 특히 조심할 부분"의 `players.squad_status`/`polls.thumbnail_url` fallback 문장(50행 부근) — TEA-29에서 fallback을 걷어내면 이 문장 자체를 삭제. "예정/마감 투표 자동 상태 전환은 아직 cron/Edge Function 후속 작업"(57행) 문장도 TEA-25 완료 후 "예정 투표 기능 자체가 없음"으로 갱신.
- `vault/99_old/SUPABASE_DATA_CONNECTIONS.md` — `polls`/`poll_options` 섹션(181-226행)의 "Type A/evaluation", "Type B/selection" 서술을 새 분기 기준(§2-3)에 맞게 갱신. `votes`/`comments` 섹션은 변경 없음(불변 제약 무관).
- `vault/99_old/specs/04-poll-list.md`, `05-poll-detail.md` — intent.md §3 표 그대로 반영(유형뱃지 삭제, 표지 반응형, 부제 없음 확정 등).
- `vault/99_old/specs/07-scheduled-polls.md` — "기능 없음"으로 전면 갱신 또는 폐기 표시(TEA-25).

---

## "사람 확인 필요" 항목 전체 목록 (재정리)

1. §2-1: `polls.type` 저장 값 — 안 A(기존 문자열 유지) vs 안 B(신규 단일값 `'poll'`).
2. §2-4: 선수 연결 옵션 + 커스텀 이미지 공존 규칙 — 안 1/2/3 중 선택.
3. §2-3: TypeA/TypeB 컴포넌트 자체를 통합할지(이 spec은 "통합하지 않음" 제안, 원하면 별도 이슈).
4. §2-6: `getPollFormPlayers()`에 `is_active` 필터를 추가할지.
5. §3-1: 클래스 문자열 상수 추출 위치(`lib/constants.ts` 제안) + `PollHeroCard.tsx`를 표지 반응형 스코프에 포함할지.
6. §4-1/4-2/4-3/4-4/4-5: 새 헬퍼 함수/파일 이름과 위치(공용 fallback 헬퍼, service-role 헬퍼, `useVoteConfirm` 훅, `queries/polls.ts` 분리 경계, `getOptionThumb`/`formatPollDate` 이동 위치) — 전부 이름/폴더 발명이라 확인 필요.
7. §5-2: 선택지 이미지 고아 파일 정리 로직을 새로 만들지(이 spec은 "안 만듦" 제안).
8. §5-3: `setup_required` 방어 코드를 제거할지 유지할지(이 spec은 "유지 + 주석 추가" 제안).
9. TEA-25: `polls.scheduled_at` 컬럼을 DROP할지 유지할지(이 spec은 "유지" 제안).
