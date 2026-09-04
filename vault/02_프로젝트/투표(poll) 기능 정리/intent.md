# 투표(poll) 기능 정리 — intent

## 배경

사용자(0628lukas@gmail.com)가 "투표를 좀 손보고 싶다 — 지금은 너무 복잡하고 얽혀있어서 필요없는 부분들도 많고, 레거시 상태라 한번 정리해야 한다"고 문제 제기 (2026-09-04).

## 범위

- **팬 투표(poll) 기능만** (`/`, `/polls/[id]`, 댓글). 승부예측(prediction, `/predictions`)은 완전히 별도 기능이라 범위 밖 — 건드리지 않는다.
- 정리 축: **코드 구조 / 기능·UX / DB·스키마 세 가지 다 포함**.

## 조사 방법

Explore 에이전트가 읽기 전용으로 poll 관련 코드 전체(`lib/queries/polls.ts`, `lib/actions/{vote,polls,comments}.ts`, `lib/polls/*`, `components/composition/polls/*`, `app/polls/**`)와 스펙 문서(`vault/99_old/specs/04,05,07,08`)를 대조 조사. 이후 실제 프로덕션 DB(Supabase `xrvz…` 프로젝트)에 사람이 직접 SQL을 실행해 두 가지 핵심 사실을 실측 확인함:

```sql
select type, status, count(*) from polls group by type, status order by type, status;
-- 결과: free_choice/active 6, overall_rating/active 2, question_targets/active 2,
--       question_targets/closed 1, selection/active 1, subject_options/active 3
-- (evaluation 0건, scheduled 상태 0건)

select po.poll_id, count(*) filter (where po.player_id is not null) as with_player, count(*) as total
from poll_options po join polls p on p.id = po.poll_id where p.type = 'selection' group by po.poll_id;
-- 결과: 66377eb0-6773-4274-b8cc-4555816d4381, with_player=0, total=4
```

## 확정된 결정 사항

### 1) 예정 투표(scheduled polls) 기능 — 완전 삭제

- 근거: `status='scheduled'` 행이 프로덕션에 **0건**. 게다가 앱에서 애초에 예정 투표를 만들 방법이 없음(`createUserPoll`이 `status: 'active'`로 고정, 생성 폼에 `scheduled_at` 입력란 없음). cron/Edge Function 자동전환도 구현된 적 없음(`getEffectivePollStatus()`가 매 요청마다 날짜로 즉석 계산하는 우회 구조만 존재).
- 정리 대상: `vault/99_old/specs/07-scheduled-polls.md`(스펙 문서를 "기능 없음"으로 갱신 또는 폐기), `lib/polls/status.ts`의 `getEffectivePollStatus` scheduled 분기, `PollCard.tsx`의 scheduled 관련 처리, `poll-edit-eligibility.ts`의 scheduled 관련 조건 — 구체적 파일:줄은 developer 에이전트가 feature-spec에서 확정.

### 2) PollType 재설계 — "생성 타입" 개념 자체를 없애고 단일 모델로 통합

사용자가 대화 중 제기한 문제의식: "투표 유형이 대상+선택지/질문+선수로 나뉘어 있을 필요가 있나, 그냥 자유 선택에서 선수를 연결하면 되는 거 아닌가." 실측해보니 실제로 가능하다.

**근거(현재 데이터 구조 분석)**: 지금 생성 가능한 3개 타입은 선수 연결 위치만 다를 뿐 동일한 스키마를 쓴다.

| 타입 | 선수 연결 방식 |
|---|---|
| `subject_options`("대상+선택지") | poll 전체에 선수 하나(`polls.player_id`), 선택지엔 선수 없음 |
| `question_targets`("질문+선수") | 선택지마다 선수(`poll_options.player_id`), poll 전체 선수는 없음 |
| `free_choice`("자유 선택") | 선수 연결 없음 |

즉 "poll 전체 선수 연결(선택)"과 "선택지별 선수 연결(선택)"은 원래 독립된 두 슬롯인데, 지금은 이걸 3개의 분리된 타입으로 억지로 나눠놓은 상태다.

> **정정(2026-09-04, feature-spec 실측)**: 화면 렌더링(`app/polls/[id]/page.tsx:92-96`)은 `type` 문자열 화이트리스트(`selection|question_targets|free_choice`→TypeB, 그 외→TypeA)로 갈린다 — "poll에 선수가 달려있나"를 검사하는 게 아니다. 결과가 같은 건 우연이다. 통합 후 분기 기준은 feature-spec §2-3에서 `poll.player_id` 유무로 바꾸는 안을 제안한다. 또 `polls.type`/`status`는 DB에 CHECK/enum 제약이 없는 `text` 컬럼이라(feature-spec §0) 타입 통합에 스키마 마이그레이션은 필요 없다.

**결정**: 생성 시 타입 선택 자체를 없애고 단일 흐름으로 통합한다 — (a) "이 투표가 특정 선수 하나에 대한 것인가" 여부(선택), (b) "선택지마다 선수를 연결할 것인가" 여부(선택), 둘 다 옵션으로 제공. `overall_rating`(여러 선수에게 각각 등급을 매기는 구조적으로 다른 기능)은 그대로 분리 유지.

**기존 데이터 포함 범위**: `subject_options`(3) + `question_targets`(3, closed 1건 포함) + `free_choice`(6) + `evaluation`(0, 완전 삭제) + `selection`(1, 아래 마이그레이션 후 편입) = 총 13개 poll이 통합 모델로 편입된다. `evaluation`은 프로덕션 0건이라 그대로 삭제, `selection`은 1건(`poll_id: 66377eb0-6773-4274-b8cc-4555816d4381`, 옵션 4개 전부 `player_id` 없음 — 순수 자유 선택형)을 통합 모델의 "선수 없음" 케이스로 편입한다.

- **마이그레이션 SQL(실행은 승인된 plan.md 단계에서만)**: `update polls set type = 'free_choice' where id = '66377eb0-6773-4274-b8cc-4555816d4381';` (통합 후 최종 컬럼/값 형태에 맞게 developer 에이전트가 feature-spec에서 조정)
  - 이건 프로덕션 데이터 변경이라 CLAUDE.md/orchestrator-rules 기준 **되돌리기 어려운 변경 — plan.md 승인 시 이 문장이 다시 명시적으로 확인되어야 함.**
- **DB enum/컬럼 설계**(`PollType`을 그대로 두고 앱 로직만 통합할지, enum 자체를 줄일지)는 developer 에이전트가 feature-spec 단계에서 구체적인 마이그레이션 방법과 함께 제안 — 어느 쪽이든 기존 13개 poll의 조회/렌더링이 깨지지 않아야 한다.
- 생성 폼(`UserPollCreateForm.tsx`)의 타입 선택 UI(`POLL_TYPES` 배열)를 "투표 형식"(일반 투표 / 전체 평점, 2개)으로 축소한다. "일반 투표"를 고르면 기본 정보 아래 위 (a)/(b) 두 옵션(대상 선수 전체 토글 + 선택지별 선수 연결)이 나오고, "전체 평점"을 고르면 지금과 동일한 "평가 대상 선수" 다중 선택 화면이 그대로 나온다 — `overall_rating`은 데이터 구조·화면 다 바꾸지 않고 진입 경로만 4개 카드에서 2개 카드로 단순화. 새로운 시각 디자인이 필요한 건 아니고 기존 흐름을 합치는 정리이므로 developer 에이전트가 처리하되, UI 판단이 애매하면 orchestrator를 거쳐 designer에게 넘긴다.
- **추가 결정(2026-09-04)**: 기본 정보의 "설명" 입력을 지금의 한 줄 `<input>`에서 여러 줄 `<textarea>`로 바꾼다 — 투표 설명은 본문 수준 텍스트라 한 줄 입력은 가독성이 떨어짐(선택지 설명은 이미 `<textarea min-h-[72px]>`를 쓰고 있어 지금 구조가 비대칭이었다). `UserPollCreateForm.tsx`의 `title="description"` 입력, 그리고 수정 폼(`UserPollEditForm.tsx`)에 동일 필드가 있으면 같이 바꾼다.

### 2-a) 선수 연결 대상(players vs season_squads) — players 유지, FK 전환 안 함

- 검토 배경: 사용자가 "선수 연결을 `players` 대신 `season_squads`로 하면 어떨까"를 제기했으나, 근거 확인 결과 위험 요소가 커서 **기각**.
  - `season_squads`는 DB 제약(`position in ('GK','DEF','MID','FWD')`)상 감독(`MGR`)을 저장할 수 없음 — `players`엔 `MGR`이 있어 감독 관련 투표가 지금은 가능한데 막힘.
  - `season_squads`엔 `photo_url` 컬럼이 없음 — 투표 카드/상세의 선수 사진은 전부 `players.photo_url` 의존이라, 전환해도 결국 `players`를 다시 join해야 함.
  - `season_squads`는 시즌마다 동기화되는 시즌 스코프 데이터라 과거에 떠난 선수를 다루는 투표에서 행이 없을 수 있음.
- **결정**: `poll_options.player_id`/`polls.player_id` 모두 `players` 테이블 참조를 유지한다.
- **후속 검토(확정 아님)**: 생성 폼 후보 명단(`getPollFormPlayers()`)이 지금 `players` 전체를 필터 없이 가져오는 게 실제로 불편하면(예: 은퇴/방출 선수까지 다 뜸), `is_active` 등으로 후보만 좁히는 저위험 개선을 feature-spec에 포함할 수 있음 — developer 에이전트가 필요성 재확인 후 포함 여부 판단.

### 3) UX — 스펙 문서(04/05) vs 실제 코드 불일치 6건에 대한 결정

| 항목 | 결정 | 방향 |
|---|---|---|
| 유형 뱃지(평가/선택) | **표시 안 함** — `TypeAPollClient.tsx` 커버 이미지 위 하드코딩된 "평가" 칩도 §2 타입 통합에 따라 제거 대상(타입 개념 자체가 없어지므로) | 코드 유지/정리, 스펙 문서 갱신 |
| 카드 부제("N명의 후보" 등) | **추가 안 함 — 지금처럼 부제 없음 유지** (2026-09-04 재확인, 앞선 "추가 구현" 결정을 번복) | 스펙 문서를 코드에 맞게 갱신 |
| 표지 이미지 높이(150/160/252px 혼재) | **반응형으로 통일 — 모바일 160px / 데스크탑 252px** (2026-09-04 재확인, 앞선 "252px 단일 통일" 결정을 번복). 지금 코드엔 이런 반응형 분기 패턴이 없어 새로 만들어야 함 | 코드 통일(반응형 브레이크포인트 추가) |
| 뒤로가기 버튼(플로팅 pill) | **변경 없음** | 스펙 폐기 — 애초에 구현된 적 없음, 지금 상단 고정 헤더 유지 |
| Type B 캐러셀 UI | **변경 없음** | 스펙 폐기 — 지금 세로 라디오 리스트 유지(코드에 "의도적으로 캐러셀에서 바꿨다"는 주석 기존재) |
| 결과 화면 최다득표 전용 카드 | **변경 없음** | 스펙 폐기 — 지금 리스트 내 강조 표시 유지 |

### 4) 코드 구조 정리 (동작 변화 없음, 순수 리팩터링)

- fallback query 패턴(`isMissingColumnError` 감지 후 컬럼 제외 select) — 목록/상세/폼 조회 4곳(`getPollListUncached`, `getPollHomeSectionsUncached`, `getPollById`, `getPollFormPlayers`)에 각자 인라인 반복 → 공용 헬퍼로 추출
- 권한 검사 없는 service-role 클라이언트 생성 코드 — `queries/polls.ts` 3곳, `actions/polls.ts` 2곳, `actions/comments.ts` 2곳(총 8곳) 복붙 → 공용 헬퍼로 추출 (기존 `lib/supabase/admin.ts`의 `requireAdminClient()`는 관리자 전용이라 대체 불가, 별도 헬퍼 필요)
- `TypeAPollClient.tsx`/`TypeBPollClient.tsx`의 `handleConfirm` 확인 흐름(트래킹 페이로드 포함) 중복 → 공유 훅/함수로 추출
- 과대 파일 책임 분리: `lib/queries/polls.ts`(597줄 — 조회+집계+fallback 3벌+평점 계산 혼재), `lib/actions/comments.ts`(270줄 — 액션 4개가 인증·service-role·프로필조회 반복)
- 이름-책임 불일치: `ResultView.tsx`(결과 화면용 파일)가 export한 헬퍼(`getOptionThumb`, `formatPollDate`)를 `TypeBPollClient`, `UserPollEditForm`이 가져다 씀 → 위치 재검토

### 5) DB/스키마 정리

- fallback이 막아주는 컬럼: `players.squad_status`, `polls.thumbnail_url` 외에 `poll_options.image_url`, `poll_options.description`도 대상이었음(기존 `AGENT_MAINTENANCE_GUIDE.md`엔 미기재 — 이번에 발견) → 실제 컬럼 존재 여부는 developer 에이전트가 feature-spec 단계에서 migration 이력 대조
- 선택지 이미지(`poll_options.image_url`)는 썸네일과 달리 스토리지 정리 로직이 없음(코드 주석이 스스로 명시) — 정리 필요 여부는 feature-spec에서 판단
- `OverallRatingPollClient.tsx`의 "전체 평가 DB 마이그레이션이 필요합니다"(`setup_required`) 방어 문구가 실제로 지금도 발생 가능한 상황인지 `lib/actions/ratings.ts` 확인 필요 (이번 조사 범위 밖)

## feature-spec 검토 후 확정 (2026-09-04) — spec의 "사람 확인 필요" 9건에 대한 답

feature-spec.md 끝의 목록 번호 기준. 여기 적힌 것이 plan.md의 입력이다.

| # | 항목 | 확정 |
|---|---|---|
| 1 | `polls.type` 저장 값 (spec §2-1) | **안 B** — 일반 투표는 전부 `'poll'` 한 값으로 저장. 기존 13개 poll(`subject_options` 3, `question_targets` 3, `free_choice` 6, `selection` 1)도 `'poll'`로 마이그레이션. `selection`→`free_choice` 문장은 이 마이그레이션에 흡수된다. `overall_rating`은 그대로. 화면 분기는 `poll.player_id` 유무(spec §2-3) |
| 2 | 선수 연결 옵션 + 이미지 공존 (spec §2-4) | **1안** — 옵션별로 선수 연결/직접 입력을 섞어 쓸 수 있고, 선수를 연결한 옵션은 이미지 업로드 UI를 숨기고 무조건 선수 사진을 쓴다 |
| 3 | TypeA/TypeB 컴포넌트 통합 (spec §2-3) | **합친다** — 하나의 PollClient로. 표지 오버레이·선수 정보 카드는 `poll.player_id` 유무로 조건 렌더. `design-foundation.test.mjs`·`login-modal.test.mjs`의 파일 경로 단정문은 새 파일 기준으로 재작성(테스트를 지우지 않는다). 사용자가 스코프 확대를 승인한 항목 |
| 4 | `getPollFormPlayers()` 후보 필터 (spec §2-6) | **`is_active = true`만 노출** |
| 5 | 표지 높이 상수 위치·`PollHeroCard` 포함 (spec §3-1) | `PollHeroCard`는 **범위 밖(252 유지)**. 상수 추출은 선택되지 않음 → 5개 컴포넌트에 `h-[160px] sm:h-[252px]`를 각각 직접 쓴다(새 상수/파일 만들지 않음) |
| 6 | TEA-28 새 이름 5개 (spec §4) | **TEA-28 plan 단계에서 따로 결정** — 이번 plan.md 범위에서 TEA-28 제외 |
| 7 | 선택지 이미지 고아 파일 정리 (spec §5-2) | **안 만든다** |
| 8 | `setup_required` 방어 코드 (spec §5-3) | **지운다** — `lib/actions/ratings.ts`의 `isMissingRatingSchemaError`·`setup_required` 반환, `OverallRatingPollClient.tsx`의 해당 문구 분기 삭제 |
| 9 | `polls.scheduled_at` 컬럼 (spec TEA-25) | **DROP COLUMN** — 마이그레이션 1건 |

### plan 검토 후 추가 확정 (2026-09-04)

| # | 항목 | 확정 |
|---|---|---|
| 10 | plan이 새로 지은 이름 — `POLL_FORMATS`(기존 `POLL_TYPES` 대체), `PollFormat`, `getOptionSubLabel`, 마이그레이션 파일명 `20260904140000_drop_polls_scheduled_at.sql` / `20260904150000_consolidate_poll_type_to_poll.sql` | **전부 그대로 사용**. 단 `hasSubjectPlayer`는 기존 `showSubjectPlayer`(`UserPollEditForm.tsx`)로 통일 |
| 11 | PR 전략 | **TEA-25(예정 투표 제거)만 먼저 별도 PR, 나머지(TEA-26/27/29)는 PR 1개** |
| 12 | mock 데이터의 "공개 예정" 데모 투표(`poll-3`) | **삭제** (active로 바꿔 유지하지 않음) |
| 13 | 합쳐진 `PollClient` 화면 | **목업의 표지(160/252, 뱃지 없음) + 나머지 마크업은 기존 TypeA/TypeB 그대로**, `poll.player_id` 유무로 분기. 별도 디자인 시안 없음 |
| 14 | plan 검토에서 잡힌 수정 | `design-foundation.test.mjs`의 오버레이 부재 검사는 삭제가 아니라 `PollClient.tsx` 조건 분기 기준으로 재작성 / Step 4를 "데이터 모델·분기·픽스처"와 "PollClient 병합" 두 단계로 분리 / Step 4 완료 기준에 "런타임 `type === 'poll'` 양성 검사 없음(배포→마이그레이션 사이 옛 값 공존)" 추가 |

**되돌리기 어려운 변경 목록(plan.md 승인 시 문장 그대로 재확인)**:
- `alter table polls drop column scheduled_at;`
- `update polls set type = 'poll' where type in ('subject_options','question_targets','free_choice','selection','evaluation');` — 실행 전 `select type, count(*) from polls group by type`로 13건 확인, 실행 후 `poll` 13 / `overall_rating` 2 확인.
- fallback 제거 전 프로덕션 `information_schema.columns` 1회 조회(spec §5-1).

## 불변 제약 (건드리면 안 됨)

- 투표는 제출 후 수정 불가 (DB UNIQUE 제약)
- 결과(%)는 투표 완료 후에만 공개
- 댓글은 투표 참여자만 작성 가능

## 다음 단계

1. developer 에이전트가 위 결정 사항을 `feature-spec.md` → `plan.md`로 구체화 (파일:줄 단위 변경 계획, 특히 §2 마이그레이션 SQL은 plan.md에서 재확인)
2. `plan.md`는 사람 승인 전까지 구현 착수 안 함
