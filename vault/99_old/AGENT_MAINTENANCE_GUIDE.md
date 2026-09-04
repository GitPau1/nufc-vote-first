# Agent Maintenance Guide

최종 업데이트: 2026-09-04

이 문서는 앞으로 이 저장소에서 기능 수정, 개선, DB 변경, Supabase 연동 작업을 할 때 먼저 확인할 작업 기준입니다. 작업 중 새로 알게 된 구조나 반복되는 오류 원인이 있으면 이 문서를 계속 업데이트합니다.

## 작업 전 반드시 확인할 문서

1. `AGENTS.md`
2. `vault/99_old/SUPABASE_DATA_CONNECTIONS.md`
3. `frontend/src/types/database.ts`
4. 관련 기능의 query/action 파일
5. 관련 Supabase migration 파일

## 기본 원칙

- 기능을 바꾸기 전에 실제 데이터 흐름을 먼저 확인합니다.
- DB 스키마를 바꾸면 migration, `frontend/src/types/database.ts`, query `select(...)`, server action payload, RLS 정책을 함께 확인합니다.
- mock mode에서만 확인하지 않습니다. Supabase 연동 기능은 실제 Supabase mode에서 깨질 수 있습니다.
- `getFixtureWeeks`처럼 `unstable_cache`로 감싼 query는 IS_MOCK 분기까지 캐시 안에 들어갑니다. `.next/cache`는 실행 간에 공유되므로, 실 모드로 띄운 적이 있는 프로젝트를 mock 모드로 다시 띄우면 **실 데이터가 그대로 나옵니다**(반대도 마찬가지). mock 모드로 확인하려면 `rm -rf .next/cache/fetch-cache` 후에 띄우고, 끝나면 다시 지웁니다.
- 기존 fallback query가 있으면 본 query와 fallback query를 함께 수정합니다.
- 관리자 기능은 앱 코드의 `ADMIN_EMAILS` 확인과 service-role DB 쓰기가 같이 작동한다는 점을 전제로 봅니다.
- 기존 변경사항이 많은 저장소이므로, 요청과 직접 관련 없는 파일은 건드리지 않습니다.

## Supabase 작업 체크리스트

DB나 Supabase 연동을 건드릴 때:

1. 영향을 받는 테이블/컬럼을 검색합니다.
   - `rg -n "from\\('table_name'\\)|column_name" frontend/src`
2. `supabase/migrations/`에서 실제 스키마와 RLS 정책을 확인합니다.
3. `frontend/src/types/database.ts`가 실제 스키마와 맞는지 확인합니다.
4. query 파일과 action 파일을 함께 봅니다.
   - 조회: `frontend/src/lib/queries/*`
   - 쓰기: `frontend/src/lib/actions/*`
5. 화면 진입점도 확인합니다.
   - `frontend/src/app/**/page.tsx`
   - 관련 client component
6. Storage가 관련되면 bucket 생성/정책이 migration 또는 Supabase 설정에 있는지 확인합니다.
7. 변경 후 최소 검증:
   - `cd app`
   - `npm run lint`
   - `npm run build`
8. 가능하면 실제 Supabase mode에서 해당 화면을 smoke test합니다.
9. 변경 내용이 데이터 연결 구조에 영향을 주면 `vault/99_old/SUPABASE_DATA_CONNECTIONS.md`와 이 문서를 업데이트합니다.

## 현재 특히 조심할 부분

- `frontend/src/types/database.ts`는 수동 관리라 실제 DB와 drift가 생기기 쉽습니다.
- `player-photos` Storage bucket은 `20260529_public_profiles_storage_vote_guards.sql`에서 public bucket으로 생성/보정합니다.
- **Storage에 파일을 대시보드/스크립트로 직접 올리면 `Cache-Control`이 빠지거나 잘못 들어갑니다.** 코드 경로(`lib/actions/images.ts:30`)는 `cacheControl: '31536000'`을 붙이지만, `team-logos/*.png`는 수동 업로드라 헤더값이 `max-age=` 없는 `31536000`(무효 → 브라우저가 캐시 안 함)으로 들어가 있었습니다(2026-08-26에 32개 일괄 수정). 수동 업로드 시 `cache-control: max-age=31536000`을 직접 지정하고, 어긋나면 `node --env-file=frontend/.env.local scripts/fix-storage-cache-control.mjs`(기본 dry-run, `--apply`로 반영)로 정리합니다.
- `club_status`, `player_season_stats`의 DB write policy는 넓게 열려 있습니다.
- 댓글 작성자 표시는 `public_profiles`를 사용해야 합니다. `users` 전체 공개로 해결하지 않습니다.
- `votes`는 `20260529_public_profiles_storage_vote_guards.sql` 이후 option-poll 복합 FK로 보강됩니다.
- `submitVote()`는 status/closes_at 검증을 거친 뒤 INSERT해야 합니다.
- 예정 투표(scheduled poll) 기능 자체가 없습니다(TEA-25, 2026-09 완전 제거 — `PollStatus`는 `'active' | 'closed'` 둘뿐). `polls.scheduled_at` 컬럼은 DB에 아직 남아 있으나 코드가 더는 읽지 않고, `supabase/migrations/20260904160000_drop_polls_scheduled_at.sql`로 PR #2 머지 후 사람이 실행 대기 중입니다. `polls.type`의 옛 5개 값(`subject_options`/`question_targets`/`free_choice`/`selection`/`evaluation`)을 `'poll'`로 통합하는 `20260904150000_consolidate_poll_type_to_poll.sql`도 같은 시점(PR #2 머지 후) 실행 대기입니다.
- 경기·평점 수집은 `supabase/functions/`의 Edge Function + Supabase 대시보드 Cron(KST 08:00/08:05)입니다. **함수 소스는 리포에서 관리하니 대시보드에서 직접 고치지 말고** `npx supabase functions deploy <name>`으로 배포합니다. 크론 등록만 대시보드에 있습니다(`supabase/functions/README.md`).
- **`supabase link` 대상 프로젝트를 먼저 확인합니다.** 실제로 쓰는 DB는 `frontend/.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`이 가리키는 프로젝트(`xrvz…`)입니다. 리포에는 `ykjf…`로 link된 적이 있는데 그쪽은 `fixtures`·`week_leaderboard`조차 없는 방치된 프로젝트라, `migration list`가 "원격 히스토리가 20260821000000에서 멈춤"으로 보이고 CLI가 `migration repair --status reverted` / `db pull`을 제안합니다. **그 제안을 따르면 엉뚱한 DB 기준으로 로컬 히스토리를 덮어씁니다.** 히스토리가 어긋나 보이면 repair 전에 `.env.local`의 URL과 `supabase/.temp/project-ref`가 같은지부터 봅니다(2026-08-25에 실제로 겪음).
- `prediction_results`는 **정산이 끝난 주차만** 담습니다(`20260824120000_prediction_results_week_settled.sql`). 주차 진행 중에는 점수·랭킹이 비어 있는 게 정상이고, 그 구간의 화면 표기는 `matchHit()`의 적중 배지입니다.
- 투표 수정(`updateUserPoll`) 시 옛 썸네일 스토리지 파일을 `storage.remove()`로 실제로 지웁니다(다른 poll/poll_options 행이 참조 중이거나, 우리 버킷 URL이 아니거나, `poll-thumbnails/` 폴더 밖이면 스킵) — 이 리포에서 스토리지 파일을 실제로 지우는 첫 코드 경로입니다. `frontend/src/lib/actions/polls.ts`의 `cleanupOldPollThumbnail`, 판별 로직은 `frontend/src/lib/images/storage-cleanup.ts` 참고.

## 기능별 주요 파일

관리자 대시보드 구조 (2026-09-02 정정 — `AdminTransfersPanel.tsx`/`AdminDashboard.tsx`는 리포에 없는 파일이었습니다):

- `frontend/src/app/admin/page.tsx`가 유일한 진입점이고 하위 기능(경기별 선수 평점 등)으로 가는 링크 허브 역할만 합니다.
- 경기별 선수 평점 손보정: `frontend/src/app/admin/ratings/page.tsx` + `frontend/src/components/admin/AdminRatingsForm.tsx`.
- **이적/시즌 스쿼드(`season_squads`) 수정은 앱 관리자 UI가 없습니다.** Supabase 대시보드 Table Editor에서 직접 수정하는 방식이고, 앞으로도 그 방식을 유지하기로 확정됐습니다(TEA-20 intent).
- 큰 관리자 관련 파일을 수정할 때는 필요한 섹션 컴포넌트만 읽고, 전체 파일 출력은 피합니다.

투표:

- 조회: `frontend/src/lib/queries/polls.ts`
- 투표 생성: 서버 액션은 `frontend/src/lib/actions/polls.ts`의 `createUserPoll`, 폼은 `frontend/src/components/composition/polls/UserPollCreateForm.tsx`("일반 투표"/"전체 평점" 2형식, 일반 투표는 대상 선수 전체 연결 토글 + 선택지별 선수 연결을 옵션으로 제공), 화면은 `frontend/src/app/polls/create/page.tsx`. 후보 선수 목록(`getPollFormPlayers()`)은 `is_active = true`만 노출.
- 투표 제출: `frontend/src/lib/actions/vote.ts`
- 투표 가능 여부: `frontend/src/lib/polls/vote-eligibility.ts`
- 투표 수정(작성자 본인/관리자만, active는 제목·설명·썸네일 / closed는 썸네일만): 권한·필드 판정은 `frontend/src/lib/polls/poll-edit-eligibility.ts`, 서버 액션은 `frontend/src/lib/actions/polls.ts`의 `updateUserPoll`, 폼은 `frontend/src/components/composition/polls/UserPollEditForm.tsx`, 화면은 `frontend/src/app/polls/[id]/edit/page.tsx`
- 상세 화면: 일반 투표(`type: 'poll'`)는 `frontend/src/components/composition/polls/PollClient.tsx` 하나로 렌더한다(옛 `TypeAPollClient`/`TypeBPollClient` 두 컴포넌트는 병합·삭제됨) — 레이아웃 분기는 `poll.player_id` 유무(있으면 선수 대상: 커버 오버레이+선수 정보 카드 / 없으면 선택형). 전체 평점(`type: 'overall_rating'`)은 별도 `OverallRatingPollClient.tsx`. 진입점은 `frontend/src/app/polls/[id]/page.tsx`.
- 댓글/좋아요: `frontend/src/lib/queries/comments.ts`, `frontend/src/lib/actions/comments.ts`
- 화면: `frontend/src/app/page.tsx`, `frontend/src/app/polls/[id]/page.tsx`

승부예측:

- 조회: `frontend/src/lib/queries/fixtures.ts`(경기), `frontend/src/lib/queries/predictions.ts`(내 제출), `frontend/src/lib/queries/squads.ts`(픽 후보/배당)
- 주차 그룹핑/주 세션 상태 파생/`toPredictWeeks` 어댑터: `frontend/src/lib/predictions/week.ts` (+ `week.test.mjs`)
- 제출 검증/insert 행 생성: `frontend/src/lib/predictions/submit.ts` (+ `submit.test.mjs`), action은 `frontend/src/lib/actions/predictions.ts`
- 포지션 정의/표시 헬퍼: `frontend/src/lib/predictions/candidates.ts`
- 화면: `frontend/src/app/predictions/page.tsx`, `frontend/src/app/predictions/[weekKey]/page.tsx`(오픈 주차=예측 플로우 / 종료 주차=결과 화면 분기), `frontend/src/components/predict/*`
- 결과 화면은 `PredictionResult.tsx` + 주차 랭킹 `WeekRankCard.tsx`, 순수 계산은 `lib/predictions/result.ts`(+ `result.test.mjs`). 채점 결과 조회는 `getMyResults()`(`prediction_results` view — **정산이 끝난 주차만** 담는다).
- 결과 화면 "순위" 탭(TEA-11, 시즌 누적)은 `PredictionResult.tsx` 안의 `SeasonRankSection`이 그린다 — `WeekRankCard`를 재사용하지 않는다. `WeekRankCard`는 주차 랭킹(예측/선수픽/종합 3컬럼) 전용으로 만들어져 있고, 시즌 행(`matchPoints`/`pickPoints` 없음)을 넘기면 `?? 0` 폴백 때문에 "0점 받음"처럼 보인다(`WeekRankCard.stories.tsx`의 `MissingColumnPoints` 스토리가 이 근거를 남겨뒀다). 그래서 시즌용은 총점 한 컬럼짜리 목록을 같은 파일 안에 따로 뒀다. 조회는 `getSeasonRanking(SEASON_RANKING_ALL_LIMIT)` — 목록 화면(TOP3+내 순위)과 달리 순위 탭은 전체를 보여줘야 해서 큰 limit을 호출부(`app/predictions/[weekKey]/page.tsx`)에서 넘긴다. `PredictionResult`의 `seasonRanking` prop이 이 데이터를 받는다(주차 랭킹 `ranking` prop과 대칭).
- 예측/제출 단위는 경기가 아니라 **주(week)**다. 상태(`open`/`result`/`upcoming`)도 주 레벨에만 있고, 더블 매치위크는 경기 2개가 한 세션이다. 다만 목록 카드의 **배지는 경기 단위**(`matchStatusMeta`)다 — 한 경기가 끝났는데 다른 경기는 아직 열려 있을 수 있어서 두 상태를 병기한다.
- 세션은 **그 주 첫 경기 킥오프 7일 전**에 열리고 **그 주 마지막 경기 킥오프**에 닫힌다. 마감 판정은 실제로는 경기별(`isMatchLocked`)이고, 잠기지 않은 경기가 하나도 없으면 주차가 닫히는 구조다.
- 그래서 **부분 제출이 정상 상태**다: 첫 경기가 끝난 뒤 처음 들어온 사용자는 남은 경기만 예측한다(`submittableMatches`). 페이지가 미제출·미잠김 경기를 `pending`으로 넘기고, 비어 있으면 완료 화면을 띄운다.
- 프론트는 `week.ts`의 `isMatchLocked`/`weekStatus`, DB는 `20260823130000_predictions_weekly_window.sql`의 insert 정책(`kickoff_at > now()` + `prediction_week_first_kickoff < now() + 7 days`) — 둘이 같은 기준이라 한쪽만 고치면 안 된다.
- `predictions` 테이블은 **경기당 1행**이고 제출은 주 단위 1회다: 그 주 경기 전부를 한 번의 insert로 넣는다. 스코어도 **선수 픽도 경기별**이다(2026-08-23 확정 — 더블 매치위크는 경기마다 다른 선수를 고를 수 있고, 화면에 첫 경기 픽을 복사하는 "그대로 적용" 버튼이 있다). 포지션 간 중복 금지(`predictions_distinct_picks`)는 행 단위라 경기끼리 같은 선수를 고르는 건 허용된다. 점수는 그 주 행들을 합해 주차 성적이 된다(FR-017 = 픽 점수 주 단위 합산).
- 랭킹 조회는 `lib/queries/predictions.ts`의 `getWeekRanking(weekKey)`(주차, `week_leaderboard` view) / `getSeasonRanking(limit)`(시즌 누적, `season_leaderboard` view). `week_leaderboard.week_key`는 `week.ts`의 `weekKey()`와 같은 ISO 주차 문자열이라 둘을 같이 고쳐야 한다.
- 평점 자동 적재는 Edge Function `sync-fixture-ratings`(크론 KST 08:05). 종료됐고 평점 행이 11개 미만인 경기를 최신순 최대 5경기씩 처리하고, `remaining`이 남으면 다음 실행이 이어받는다. "행이 하나라도 있으면 완료"로 판정하지 않는 이유는 FotMob 평점이 종료 직후 일부만 내려올 수 있어서다(그 상태로 굳으면 남은 선수가 영구히 0점).
- 즉시 실행은 `/admin`의 동기화 버튼(`components/admin/AdminSyncButton.tsx` + `lib/actions/sync-fixtures.ts`) — `sync-fixture` → `sync-fixture-ratings` 순서로 POST하고 `revalidateTag('fixture-weeks')`로 목록 캐시를 비운다. 순서는 스코어가 먼저 들어와야 평점 대상이 잡히기 때문이다.
- 결과 화면 진입 전(경기는 끝났고 주차는 진행 중)에는 완료 화면이 적중 배지만 보여준다 — `lib/predictions/result.ts`의 `matchHit()`, DB `prediction_match_points`와 같은 기준이라 한쪽만 고치면 안 된다. 점수는 정산 게이트를 지나야 나온다.
- `[weekKey]` 페이지의 404 조건은 `status === 'upcoming'` **그리고 잠긴 경기가 하나도 없을 때**다. 킥오프이 지났지만 종료 적재 전인 주차도 `'upcoming'`이라, 그것까지 막으면 경기 끝난 뒤 크론이 돌기 전까지 페이지가 사라진다.
- 경기별 선수 평점 손보정은 `/admin/ratings`(`app/admin/ratings/page.tsx` + `components/admin/AdminRatingsForm.tsx`), 쓰기는 `lib/actions/fixture-ratings.ts`의 `saveFixtureRatings`. `fixture_player_ratings`에 insert 정책이 없어 service-role(`requireAdminClient`)로만 쓴다. 평점 행이 없는 선수는 픽 점수가 0으로 계산되므로, 경기가 끝나면 여기서 평점을 넣어야 결과·랭킹이 의미를 갖는다. 이름이 `actions/ratings.ts`가 아닌 이유: 그 파일은 선수 평점 **투표**(rating_votes)가 이미 쓰고 있다.
- 아직 없는 것: 순위 변동(▲/▼) 표시용 지난 주차 순위 보관, FR-009 시즌 하이라이트, 선수 픽 적중 표기(평점 = 곧 점수라 정산 화면 몫)

인증/온보딩/마이페이지:

- 로그인: `frontend/src/app/login/LoginPageClient.tsx`
- OAuth callback: `frontend/src/app/auth/callback/route.ts`
- middleware: `frontend/src/middleware.ts`
- 닉네임 저장: `frontend/src/lib/actions/onboarding.ts`
- 마이페이지: `frontend/src/app/my/page.tsx`

구단/선수:

- 조회: `frontend/src/lib/queries/club.ts`
- 선수 댓글: `frontend/src/lib/actions/player-comments.ts`
- 화면: `frontend/src/app/club/page.tsx`, `frontend/src/app/players/[id]/page.tsx`

이적/작별:

- 조회: `frontend/src/lib/queries/farewells.ts`
- 쓰기: `frontend/src/lib/actions/farewells.ts`
- 화면: `frontend/src/app/transfers/page.tsx`, `frontend/src/app/farewells/[id]/page.tsx`

관리자:

- 화면: `frontend/src/app/admin/page.tsx`(링크 허브), `frontend/src/app/admin/ratings/page.tsx`(경기별 선수 평점)
- action: `frontend/src/lib/actions/fixture-ratings.ts`(평점 손보정), `frontend/src/lib/actions/sync-fixtures.ts`(Edge Function 수동 트리거)
- 권한 판정: `frontend/src/lib/admin.ts`
- service-role client: `frontend/src/lib/supabase/admin.ts`

## 테스트/타입 명령

- 투표 가능 여부 단위 테스트: `cd app && npm run test:vote-eligibility`
- Next lint: `cd app && npm run lint`
- Next build: `cd app && npm run build`
- Supabase generated types: `cd app && npm run types:supabase`

## 문서 업데이트 규칙

- 새 테이블/컬럼/버킷을 추가하면 `vault/99_old/SUPABASE_DATA_CONNECTIONS.md`에 먼저 반영합니다.
- 반복되는 작업 절차나 주의점이 생기면 이 문서에 추가합니다.
- 특정 기능의 연결 구조가 바뀌면 “기능별 주요 파일” 목록도 함께 갱신합니다.
- 임시 우회나 fallback을 추가하면 이유와 제거 조건을 문서에 남깁니다.
