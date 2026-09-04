# Supabase 데이터 연결 구조

최종 업데이트: 2026-09-04

이 문서는 현재 서비스가 Supabase와 어떻게 연결되어 있는지 정리한 기준 문서입니다. 테이블, 컬럼, RLS 정책, Storage 버킷, 기능별 데이터 흐름을 바꿀 때마다 함께 업데이트하세요.

## 전체 연결 구조

앱은 `frontend/` 아래의 Next.js App Router 프로젝트입니다. Supabase는 Auth, PostgreSQL, RLS 기반 데이터 접근, Storage에 사용됩니다.

실행 모드는 `frontend/src/lib/config.ts`에서 결정됩니다.

- `NEXT_PUBLIC_SUPABASE_URL`이 비어 있거나 `http`로 시작하지 않으면 `IS_MOCK = true`가 되어 mock 데이터/쿠키를 사용합니다.
- 실제 Supabase URL이 있으면 서버/브라우저 클라이언트가 Supabase 프로젝트에 연결됩니다.

Supabase 클라이언트 생성 위치:

- `frontend/src/lib/supabase/server.ts`: 서버 컴포넌트/서버 액션용 SSR 클라이언트. Next cookies와 anon key를 사용합니다.
- `frontend/src/lib/supabase/client.ts`: 브라우저 클라이언트. 로그인/로그아웃 등 클라이언트 Auth 동작에 사용합니다.
- `frontend/src/lib/actions/admin.ts`, `frontend/src/lib/actions/farewells.ts`: 관리자 쓰기 작업에서 현재 로그인 사용자가 `ADMIN_EMAILS`에 포함되는지 확인한 뒤 `SUPABASE_SERVICE_ROLE_KEY`로 service-role 클라이언트를 만듭니다.

필수 환경변수:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAILS`

## 인증 흐름

Google OAuth 시작:

- `frontend/src/app/login/LoginPageClient.tsx`
- `frontend/src/components/polls/LoginModal.tsx`

OAuth 콜백:

- `frontend/src/app/auth/callback/route.ts`에서 auth code를 session으로 교환합니다.
- 로그인 후 `public.users.display_name`을 조회합니다.
- `display_name`이 없으면 `/onboarding`으로 보냅니다.

세션 갱신/라우트 보호:

- `frontend/src/middleware.ts`가 대부분의 라우트에서 Supabase SSR 클라이언트를 만들고 세션 쿠키를 갱신합니다.
- `/my`, `/onboarding`은 로그인 필요.
- `/admin`은 로그인 + `ADMIN_EMAILS`에 포함된 이메일 필요.

사용자 프로필 동기화:

- `supabase/migrations/20260527155049_initial_schema.sql`에서 `auth.users` INSERT 시 `public.users`를 생성하는 트리거를 만듭니다.
- `supabase/migrations/20260528_fix_user_trigger.sql`에서 신규 사용자의 `display_name`을 자동 생성하지 않고 `NULL`로 두도록 바꿉니다.
- `frontend/src/lib/actions/onboarding.ts`가 온보딩/마이페이지 닉네임 저장 시 `public.users`를 upsert합니다.

## 스키마 기준 파일

현재 DB 스키마는 다음 마이그레이션이 기준입니다.

- `supabase/migrations/20260527155049_initial_schema.sql`
- `supabase/migrations/20260528_fix_user_trigger.sql`
- `supabase/migrations/20260528_club_squad.sql`
- `supabase/migrations/20260529_farewells.sql`
- `supabase/migrations/20260529_player_comments.sql`
- `supabase/migrations/20260529_transfer_events_player_history.sql`
- `supabase/migrations/20260529_player_status_poll_thumbnail.sql`
- `supabase/migrations/20260529_public_profiles_storage_vote_guards.sql`

TypeScript DB 타입은 `frontend/src/types/database.ts`에 수동으로 관리됩니다. Supabase에서 자동 생성되는 타입이 아니므로, 마이그레이션을 바꾸면 이 파일도 반드시 같이 수정해야 합니다.

## 테이블별 연결

### `users`

역할: Supabase Auth의 `auth.users`와 연결되는 앱 프로필 테이블입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `email`, `avatar_url`, `display_name`, `created_at`, `deleted_at`

사용 위치:

- OAuth 후 온보딩 여부 확인: `frontend/src/app/auth/callback/route.ts`
- 헤더/마이페이지 프로필 표시: `frontend/src/components/layout/AppHeader.tsx`, `frontend/src/app/my/page.tsx`
- 닉네임 저장: `frontend/src/lib/actions/onboarding.ts`
- 댓글 작성자 join: `frontend/src/lib/queries/comments.ts`, `frontend/src/lib/queries/club.ts`, `frontend/src/lib/queries/farewells.ts`

RLS:

- 본인 row만 SELECT/UPDATE.
- row 생성은 주로 Auth 트리거 또는 로그인 사용자의 onboarding upsert로 처리됩니다.

### `public_profiles`

역할: 댓글 작성자 표시에 필요한 공개 프로필 테이블입니다. `users` 전체를 공개하지 않고 `display_name`, `avatar_url`만 공개하기 위해 사용합니다.

코드에서 쓰는 주요 컬럼:

- `id`, `display_name`, `avatar_url`, `updated_at`

사용 위치:

- 투표 댓글 작성자 join: `frontend/src/lib/queries/comments.ts`
- 선수 댓글 작성자 join: `frontend/src/lib/queries/club.ts`
- 작별 댓글 작성자 join: `frontend/src/lib/queries/farewells.ts`
- 댓글 작성 직후 반환 join: `frontend/src/lib/actions/farewells.ts`, `frontend/src/lib/actions/player-comments.ts`

동기화:

- `public.users`의 `display_name`, `avatar_url` 변경 시 trigger가 `public_profiles`를 upsert합니다.

RLS:

- 공개 SELECT.

### `players`

역할: 선수/감독 마스터 데이터입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `name`, `position`, `squad_number`, `photo_url`, `is_active`, `created_at`, `nationality`, `birth_date`, `squad_status`

사용 위치:

- 구단/스쿼드/선수 상세 조회: `frontend/src/lib/queries/club.ts`
- 투표 목록/상세 join: `frontend/src/lib/queries/polls.ts`
- 작별/이적 글 join: `frontend/src/lib/queries/farewells.ts`
- 관리자 선수 생성/수정/활성화/비활성화: `frontend/src/lib/actions/admin.ts`
- 작별 글 생성 시 `is_active` 또는 `squad_status` 변경: `frontend/src/lib/actions/farewells.ts`

RLS:

- 공개 SELECT.
- 일반 사용자는 쓰기 정책 없음.
- 관리자 쓰기는 service-role 클라이언트 사용.

### `fixtures`

역할: FotMob 팀 API에서 동기화한 경기 일정/결과입니다. 뉴캐슬 관점 데이터라 `result`/스코어는 중립적이지 않습니다.

코드에서 쓰는 주요 컬럼:

- `fixture_id`, `competition_name`, `kickoff_at`, `home_id`, `home_name`, `home_score`, `away_id`, `away_name`, `away_score`, `started`, `finished`, `cancelled`

사용 위치:

- 승부예측 경기 목록 조회: `frontend/src/lib/queries/fixtures.ts`
- 주차 그룹핑/주 세션 상태 파생(순수 함수): `frontend/src/lib/predictions/week.ts`

RLS:

- 공개 SELECT(`fixtures_public_read`). 앱에서 쓰는 경로는 없고, 적재는 Edge Function `sync-fixture`가 service-role로 upsert합니다(아래 "Edge Function · 크론" 참고).

주의:

- 뉴캐슬 team id는 `10261`(`week.ts`의 `NUFC_TEAM_ID`)입니다. 팀명은 영문(`Newcastle`, `Liverpool` …)으로 저장되어 화면에도 영문 그대로 노출됩니다.
- 엠블럼은 team id로 FotMob CDN(`images.fotmob.com/.../teamlogo/{id}.png`)을 직접 로드합니다(URL은 `week.ts`의 `teamLogoUrl`, 렌더는 `components/predict/shared.tsx`의 `TeamBadge`). 실패 시 이니셜 원형으로 폴백합니다.
- 라운드(매치위크) 컬럼이 없어 목록은 `kickoff_at` 기준 ISO 주차로 묶습니다.

### `club_status`

역할: 구단 현황 singleton 테이블입니다. 앱은 `id = 1`인 row 하나를 기대합니다.

코드에서 쓰는 주요 컬럼:

- `league_rank`, `next_match_opponent`, `next_match_date`, `next_match_venue`
- `top_appearances_player_id`, `top_appearances_count`
- `top_goals_player_id`, `top_goals_count`
- `top_assists_player_id`, `top_assists_count`
- `updated_at`

사용 위치:

- 구단 현황 조회: `frontend/src/lib/queries/club.ts`
- 관리자 구단 현황 수정: `frontend/src/lib/actions/admin.ts`
- 관리자 초기 데이터 조회: `frontend/src/app/admin/page.tsx`

주의:

- 현재 마이그레이션의 write policy가 넓게 열려 있습니다. 앱에서는 관리자 확인 후 service role로 쓰지만, DB 정책 자체도 점검 대상입니다.

### `polls`

역할: 투표 본문 테이블입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `type`, `title`, `description`, `player_id`, `status`, `thumbnail_url`, `closes_at`, `created_at`
- `type`은 `'poll' | 'overall_rating'` 두 값만 씁니다(TEA-26, 2026-09 통합). 옛 5개 값(`subject_options`/`question_targets`/`free_choice`/`selection`/`evaluation`)은 코드가 더는 만들지 않고, 기존 13개 poll도 `supabase/migrations/20260904150000_consolidate_poll_type_to_poll.sql`로 2026-09-04 `'poll'`로 일괄 변환 완료.
- `scheduled_at` 컬럼은 `supabase/migrations/20260904160000_drop_polls_scheduled_at.sql`로 2026-09-04 DROP 완료(예정 투표 기능 자체가 TEA-25로 완전 제거됨).

사용 위치:

- 투표 목록/상세 조회: `frontend/src/lib/queries/polls.ts`
- 마이페이지 참여 투표 join: `frontend/src/app/my/page.tsx`
- 관리자 투표 생성/상태 변경: `frontend/src/lib/actions/admin.ts`
- 사용자 투표 생성: `frontend/src/lib/actions/polls.ts`의 `createUserPoll`
- 작성자 본인/관리자 투표 수정(제목·설명·썸네일): `frontend/src/lib/actions/polls.ts`의 `updateUserPoll` — active는 제목·설명·썸네일, closed는 썸네일만 허용(`frontend/src/lib/polls/poll-edit-eligibility.ts`). `polls` 테이블에 UPDATE RLS 정책이 없어 이 경로도 service role로 쓴다.

관계:

- `poll.player_id` 유무로 상세 화면 레이아웃이 갈립니다(`PollClient.tsx` 단일 컴포넌트, 옛 `TypeAPollClient`/`TypeBPollClient` 분리는 병합·삭제됨). `polls.player_id -> players.id`가 있으면 poll 전체가 특정 선수 하나를 대상으로 합니다(선수 대상 레이아웃: 커버 오버레이+선수 정보 카드). 없으면 선택지별로 `poll_options.player_id -> players.id`를 연결할 수 있는 선택형 레이아웃입니다(옵션마다 선수 연결은 선택 사항이며, 연결한 옵션은 커스텀 이미지 UI를 숨기고 선수 사진을 씁니다).

RLS:

- 공개 SELECT.
- 쓰기(INSERT/UPDATE)는 정책이 없어 service role로만 가능. `createUserPoll`/`updateUserPoll` 모두 애플리케이션 레벨(로그인 여부, 작성자 본인/관리자)에서 권한을 검사한 뒤 service role 클라이언트로 씁니다.

### `poll_options`

역할: 투표 선택지 테이블입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `poll_id`, `label`, `player_id`, `display_order`, `created_at`

사용 위치:

- 투표 목록/상세 join: `frontend/src/lib/queries/polls.ts`
- 댓글 작성자가 선택한 옵션 라벨 조회: `frontend/src/lib/queries/comments.ts`
- 마이페이지 선택 옵션 join: `frontend/src/app/my/page.tsx`
- 관리자 투표 생성 시 옵션 INSERT: `frontend/src/lib/actions/admin.ts`

RLS:

- 공개 SELECT.
- 관리자 쓰기는 service role 사용.

### `votes`

역할: 사용자 투표 기록입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `poll_id`, `user_id`, `option_id`, `created_at`

DB 제약:

- `UNIQUE(poll_id, user_id)`로 한 사용자당 한 투표만 허용합니다.

사용 위치:

- 투표 제출: `frontend/src/lib/actions/vote.ts`
- 투표 수/내 투표 조회: `frontend/src/lib/queries/polls.ts`
- 댓글 작성자의 선택 옵션 라벨 조회: `frontend/src/lib/queries/comments.ts`
- 마이페이지 참여 투표 조회: `frontend/src/app/my/page.tsx`

RLS:

- 사용자는 본인 vote row만 SELECT.
- 로그인 사용자는 `user_id = auth.uid()`인 row만 INSERT.
- 일반 사용자 UPDATE/DELETE 정책 없음.

주의:

- 현재 DB는 `option_id`가 같은 `poll_id`에 속한 옵션인지 복합 제약으로 강제하지 않습니다.
- `20260529_public_profiles_storage_vote_guards.sql` 이후부터는 `votes(option_id, poll_id)`가 `poll_options(id, poll_id)`를 참조하도록 보강됩니다.
- `submitVote()`는 INSERT 전에 `status`, `closes_at`를 확인합니다.

### `comments`

역할: 투표 상세 댓글입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `poll_id`, `user_id`, `content`, `is_hidden`, `created_at`

사용 위치:

- 댓글 조회: `frontend/src/lib/queries/comments.ts`
- 댓글 작성: `frontend/src/lib/actions/comments.ts`

RLS:

- `is_hidden = false`인 댓글 공개 SELECT.
- INSERT는 `auth.uid() = user_id`이고, 같은 poll에 대한 본인 vote가 있어야 허용됩니다.

### `comment_likes`

역할: 투표 댓글 좋아요입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `comment_id`, `user_id`, `created_at`

DB 제약:

- `UNIQUE(comment_id, user_id)`로 댓글당 사용자 1회 좋아요만 허용합니다.

사용 위치:

- 좋아요 수/내 좋아요 여부 조회: `frontend/src/lib/queries/comments.ts`
- 좋아요 토글: `frontend/src/lib/actions/comments.ts`

RLS:

- 공개 SELECT.
- 로그인 사용자는 `user_id = auth.uid()`인 row만 INSERT.
- 사용자는 본인 좋아요만 DELETE.

### `farewells`

역할: 떠나는 선수의 작별/이적 글입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `player_id`, `departure_type`, `destination_club`, `departure_note`
- `appearances`, `goals`, `assists`, `clean_sheets`
- `joined_at`, `left_at`, `is_published`, `created_at`, `updated_at`

사용 위치:

- 최신/상세 조회: `frontend/src/lib/queries/farewells.ts`
- 관리자 전체 조회: `frontend/src/app/admin/page.tsx`
- 관리자 생성/공개 토글: `frontend/src/lib/actions/farewells.ts`

RLS:

- `is_published = true`인 글만 공개 SELECT.
- 관리자 쓰기는 service role 사용.

동작:

- `createFarewell()`은 `player_season_stats`로 통산 기록을 계산합니다.
- `transferred`, `contract_expired`, `released`는 `players.is_active = false`로 바꿉니다.
- `loan_out`은 `players.squad_status = 'loan'`으로 바꿉니다.

### `farewell_comments`

역할: 작별/이적 글 댓글입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `farewell_id`, `user_id`, `content`, `is_hidden`, `created_at`

사용 위치:

- 댓글 조회: `frontend/src/lib/queries/farewells.ts`
- 댓글 작성: `frontend/src/lib/actions/farewells.ts`

RLS:

- `is_hidden = false`인 댓글 공개 SELECT.
- 로그인 사용자는 `user_id = auth.uid()`인 row만 INSERT.

### `player_comments`

역할: 선수 상세 페이지 댓글입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `player_id`, `user_id`, `content`, `is_hidden`, `created_at`

사용 위치:

- 댓글 조회: `frontend/src/lib/queries/club.ts`
- 댓글 작성: `frontend/src/lib/actions/player-comments.ts`

RLS:

- `is_hidden = false`인 댓글 공개 SELECT.
- 로그인 사용자는 `user_id = auth.uid()`인 row만 INSERT.

### `player_season_stats`

Update note 2026-05-30:

- Admin season-stat writes run through `frontend/src/lib/actions/admin.ts` with the service-role client.
- Admin season-stat reads in `frontend/src/app/admin/page.tsx` also use the service-role client so saved rows are visible to the admin dashboard even when public/RLS reads drift.
- `frontend/src/app/admin/AdminDashboard.tsx` calls `router.refresh()` after a successful player edit so the client receives refreshed server props before the next edit.
- If `player_season_stats` is missing, `updatePlayerSeasonStats()` must return an error, not a success toast. Otherwise the UI can say "saved" while no row was written.

역할: 선수별 시즌 기록입니다.

코드에서 쓰는 주요 컬럼:

- `id`, `player_id`, `season`, `appearances`, `goals`, `assists`, `created_at`, `updated_at`

DB 제약:

- `UNIQUE(player_id, season)`
- `appearances`, `goals`, `assists`는 0 이상.

사용 위치:

- 선수 상세 기록: `frontend/src/lib/queries/club.ts`
- 작별 글 통산 기록 계산/상세 기록: `frontend/src/lib/queries/farewells.ts`, `frontend/src/lib/actions/farewells.ts`
- 관리자 시즌 기록 수정: `frontend/src/lib/actions/admin.ts`

주의:

- 관리자 수정은 기존 해당 선수의 `player_season_stats`를 전부 DELETE한 뒤 전달된 row들을 다시 INSERT합니다.
- 현재 마이그레이션의 write policy가 넓게 열려 있습니다. 앱에서는 service role을 쓰지만 DB 정책은 별도 점검 대상입니다.

### `season_squads`

역할: 시즌별 스쿼드 명단(외부 FotMob API 동기화)입니다. 이 시즌 행이 있는 DEF/MID/FWD 선수가 승부예측 픽 후보입니다. `players`와는 무관하며 서로 참조하지 않습니다(`player_id`는 nullable 연결 고리일 뿐).

코드에서 쓰는 주요 컬럼:

- `season_id`, `fotmob_player_id`, `player_id`, `name`, `name_ko`, `shirt_number`, `position`, `nationality_name`, `date_of_birth`, `prediction_multiplier`, `pick_cost`, `is_active`, `synced_at`

- `is_active`(2026-09-02 추가, `boolean not null default true`): `false`면 떠난 선수(이적 등). 관리자가 Supabase 대시보드에서 직접 토글합니다(앱 관리자 UI 없음). 승부예측 선수 픽 **선택** 경로(픽 모달, 제출 검증)에서만 걸러지고, 과거 픽·채점·완료/결과 화면 이름 표시·관리자 평점 입력 폼은 전부 그대로 유지됩니다.

DB 제약:

- `primary key (season_id, fotmob_player_id)`
- `unique (season_id, player_id)`(NULL은 여러 행 허용)
- `position in ('GK', 'DEF', 'MID', 'FWD')` — GK는 픽 대상이 아닙니다.
- `pick_cost between 1 and 3`, `prediction_multiplier > 0`

사용 위치:

- 픽 후보/배당 조회: `frontend/src/lib/queries/squads.ts`의 `getPickCandidates()`(`unstable_cache`, 태그 `pick-candidates`) — 이 함수는 `is_active`와 무관하게 시즌 DEF/MID/FWD 전원을 반환합니다.
- 떠난 선수 제외: 같은 파일의 순수 함수 `excludeDeparted(candidates)`를 제출 검증(`frontend/src/lib/actions/predictions.ts`)과 선수 픽 모달(`frontend/src/components/composition/predict/PredictionFlowClient.tsx`) 2곳에만 적용합니다. `PredictionDone.tsx`/`PredictionResult.tsx`의 이름 표시, `app/admin/ratings/page.tsx`의 평점 입력 폼은 `excludeDeparted()`를 거치지 않은 원본을 그대로 씁니다.
- `sync-season-squad` Edge Function이 upsert로 채웁니다(아래 "Edge Function · 크론" 참고).

RLS:

- 공개 SELECT(행 단위 정책이라 신규 컬럼도 별도 정책 변경 없이 공개 조회됩니다).
- 쓰기 정책은 앱에 season_squads insert/update 코드가 없어 사실상 Edge Function(service-role)과 관리자 대시보드 수동 수정 전용입니다.

## Storage 연결

사용 버킷:

- `player-photos`

사용 위치:

- 업로드: `frontend/src/lib/actions/admin.ts`
- public URL 생성: `frontend/src/lib/actions/admin.ts`
- 생성된 URL은 `players.photo_url` 또는 `polls.thumbnail_url`에 저장됩니다.
- 사용자 투표 썸네일/선택지 이미지 업로드: `frontend/src/lib/actions/images.ts`의 `uploadPollImage`(`poll-thumbnails/<userId>/`, `poll-options/<userId>/` 폴더)
- 삭제: 투표 수정(`updateUserPoll`)이 DB 갱신 성공 후 옛 썸네일 파일을 `storage.remove()`로 지웁니다 — `frontend/src/lib/actions/polls.ts`의 `cleanupOldPollThumbnail`. 다른 poll/poll_options 행이 같은 URL을 참조 중이거나, 우리 버킷 URL이 아니거나, `poll-thumbnails/` 폴더 밖이면 스킵합니다. 이 리포에서 스토리지 파일을 실제로 지우는 첫 코드 경로입니다.

주의:

- `20260529_public_profiles_storage_vote_guards.sql`에서 `player-photos`를 public bucket으로 생성/보정하고 public read policy를 추가합니다.

## 기능별 데이터 흐름

### 홈/투표 목록

진입점:

- `frontend/src/app/page.tsx`
- `frontend/src/lib/queries/polls.ts`
- `frontend/src/lib/queries/farewells.ts`

사용 데이터:

- `polls`, `poll_options`, `players`
- `votes` count aggregate
- 평점 투표(`overall_rating`)의 참여자 수는 **view `rating_poll_participants`**(`20260825120000_rating_poll_participants.sql`) — `lib/queries/polls.ts`의 `getRatingParticipantCounts`. 참여자 1명이 선수 수만큼 `rating_votes` 행을 남기므로 행 수가 아니라 `count(distinct user_id)`여야 하고, 예전처럼 행을 전량 받아 JS로 세면 PostgREST `db-max-rows=1000`에 잘려 화면 숫자가 조용히 틀립니다(선수 14명 기준 참여자 14명부터). `security_invoker = true`라 `rating_votes: public read` 정책을 그대로 탑니다.
- 최신 공개 `farewells`
- `farewell_comments` count aggregate

### 투표 상세

진입점:

- `frontend/src/app/polls/[id]/page.tsx`
- `frontend/src/lib/queries/polls.ts`
- `frontend/src/lib/queries/comments.ts`
- `frontend/src/lib/actions/vote.ts`
- `frontend/src/lib/actions/comments.ts`

사용 데이터:

- `polls`, `poll_options`, `players`, `votes`, `comments`, `comment_likes`, `users`

쓰기:

- 투표 제출은 `votes` INSERT.
- 댓글 작성은 `comments` INSERT. DB RLS상 같은 poll에 대한 본인 vote가 먼저 있어야 합니다.
- 좋아요 토글은 `comment_likes` INSERT/DELETE.

### 로그인/온보딩

진입점:

- `frontend/src/app/login/LoginPageClient.tsx`
- `frontend/src/app/auth/callback/route.ts`
- `frontend/src/app/onboarding/page.tsx`
- `frontend/src/lib/actions/onboarding.ts`

사용 데이터:

- Supabase Auth `auth.users`
- `public.users`

쓰기:

- Auth trigger가 `public.users` row를 생성합니다.
- 온보딩이 `display_name`, `email`, `avatar_url`을 upsert합니다.

### 마이페이지

진입점:

- `frontend/src/app/my/page.tsx`
- `frontend/src/components/my/MyPageClient.tsx`

사용 데이터:

- `users`, `votes`, `poll_options`, `polls`

쓰기:

- 닉네임 수정은 `frontend/src/lib/actions/onboarding.ts`를 통해 `users` upsert.
- 로그아웃은 브라우저 Supabase auth client 사용.

### 구단 페이지

진입점:

- `frontend/src/app/club/page.tsx`
- `frontend/src/lib/queries/club.ts`

사용 데이터:

- `club_status`, `players`, `player_season_stats`

### 선수 상세

진입점:

- `frontend/src/app/players/[id]/page.tsx`
- `frontend/src/lib/queries/club.ts`
- `frontend/src/lib/actions/player-comments.ts`

사용 데이터:

- `players`, `player_season_stats`, `player_comments`, `users`

쓰기:

- 선수 댓글은 `player_comments` INSERT.

### 이적/작별

진입점:

- `frontend/src/app/transfers/page.tsx`
- `frontend/src/app/farewells/[id]/page.tsx`
- `frontend/src/lib/queries/farewells.ts`
- `frontend/src/lib/actions/farewells.ts`

사용 데이터:

- `farewells`, `players`, `farewell_comments`, `player_season_stats`, `users`

쓰기:

- 공개 댓글은 `farewell_comments` INSERT.
- 관리자 작별 글 생성은 `farewells` INSERT 후 필요하면 `players`를 UPDATE.

### 관리자 대시보드

Update note 2026-05-30:

- Admin transfer rows are edited through `updateFarewell()` in `frontend/src/lib/actions/farewells.ts`.
- Admin transfer restore uses `restorePlayerFromFarewell()`: it sets `players.is_active = true`, `players.squad_status = 'first_team'`, and hides the related `farewells` row with `is_published = false` while keeping the history row.
- The admin transfer tab no longer exposes the `is_published` toggle directly.

진입점:

- `frontend/src/app/admin/page.tsx`
- `frontend/src/app/admin/AdminDashboard.tsx`
- `frontend/src/lib/actions/admin.ts`
- `frontend/src/lib/actions/farewells.ts`

사용 데이터:

- `players`, `player_season_stats`, `club_status`, `polls`, `poll_options`, `farewells`
- Storage bucket `player-photos`

쓰기:

- 관리자 여부는 앱 코드에서 `ADMIN_EMAILS`로 확인합니다.
- 실제 DB 쓰기는 service role로 실행되어 RLS를 우회합니다.

### 승부예측

진입점:

- `frontend/src/app/predictions/page.tsx` (주차별 경기 목록 + 랭킹 사이드바)
- `frontend/src/app/predictions/[weekKey]/page.tsx`. `weekKey`는 `2026-35` 형태의 ISO 연도-주차입니다. `status === 'open'`이면 예측 플로우(스코어 → 선수 픽 → 확인), `'result'`면 결과 화면(`PredictionResult`)입니다. `'upcoming'`은 **잠긴 경기가 하나도 없을 때만** 404입니다 — 킥오프이 지났지만 `fixtures.finished`가 아직 적재되지 않은 주차도 `'upcoming'`으로 판정되기 때문에, 그것까지 404로 막으면 경기가 끝난 새벽부터 크론이 도는 아침까지 페이지가 사라집니다.
- `frontend/src/lib/queries/fixtures.ts`, `frontend/src/lib/queries/predictions.ts`, `frontend/src/lib/queries/squads.ts`
- 제출: `frontend/src/lib/actions/predictions.ts`의 `submitWeekPrediction(weekKey, input)`

사용 데이터:

- `fixtures` 전체 조회 후 `lib/predictions/week.ts`에서 주차 그룹핑 → 주 단위 예측 세션(더블 매치위크는 경기 2개가 한 세션)
- 선수 후보/배당은 `season_squads`(`prediction_multiplier`)에서 옵니다 — `lib/queries/squads.ts`
- 제출은 `predictions`, 채점은 `prediction_results` view — 조회는 `getMyResults()`. 배당은 view에 없어서 결과 화면이 `getMyPredictions()`의 제출 스냅샷과 함께 읽습니다.
- **`prediction_results`는 정산이 끝난 주차만 담습니다**(`20260824120000_prediction_results_week_settled.sql`): 종료된 경기여야 하고, 그 주차에 아직 안 끝난 경기(취소·일정 미정 제외)가 하나도 없어야 합니다. 제출 단위가 주(week)라 집계 단위도 주여야 하고, 진행 중인 주차의 부분 점수가 랭킹으로 새면 안 되기 때문입니다. `week_leaderboard` / `season_leaderboard`가 이 view 위에 있어 게이트가 자동으로 따라갑니다.
- 그래서 **경기가 끝났지만 주차가 진행 중인 구간에는 점수가 없습니다.** 그때 제출 완료 화면(`PredictionDone`)이 실제 스코어와 적중 여부만 보여줍니다 — 판정은 `lib/predictions/result.ts`의 `matchHit()`이고, DB `prediction_match_points`와 같은 기준이라 한쪽만 고치면 배지와 점수가 어긋납니다.
- `fixture_player_ratings`는 픽 점수의 입력값입니다. 읽기는 공개(`getFixtureRatings`), 쓰기는 insert 정책이 없어 service-role만 가능하고 경로가 둘입니다: 평상시 자동 적재는 Edge Function `sync-fixture-ratings`(크론), 손보정은 `/admin/ratings` 화면 + `lib/actions/fixture-ratings.ts`의 `saveFixtureRatings`(upsert). 평점 삭제는 지원하지 않습니다.
- 랭킹은 주차 단위 `week_leaderboard`(`20260823140000_week_leaderboard.sql`)와 시즌 누적 `season_leaderboard`를 씁니다 — `lib/queries/predictions.ts`의 `getWeekRanking(weekKey)` / `getSeasonRanking(limit)`. 목록 화면 사이드바(TOP3 + 내 순위)와 결과 화면 주차 랭킹 모두 연결돼 있습니다. 결과 화면 "순위" 탭(TEA-11)도 `getSeasonRanking()`을 쓰는데, 이때는 `SEASON_RANKING_ALL_LIMIT`(큰 값)을 넘겨 사실상 시즌 전체를 받습니다 — 뷰·쿼리 자체는 그대로고 호출부 인자만 다릅니다.
- 경기 단위 `fixture_leaderboard`는 랭킹 단위가 주차로 정리되면서 삭제했습니다(화면에서 참조한 적 없음).
- `week_leaderboard.week_key`는 `to_char(week_start, 'IYYY-IW')`로 만든 값이라 `week.ts`의 `weekKey()`와 같은 문자열입니다 — 한쪽 기준만 바꾸면 화면이 랭킹을 못 찾습니다.

주 단위 제출이 테이블에 앉는 방식:

- `predictions`는 **경기당 1행**(`unique (user_id, fixture_id)`)이고, 제출은 주 단위 1회입니다. 그 주에서 아직 킥오프이 안 지난 경기 전부를 **한 번의 insert**로 넣습니다. 스코어와 선수 픽 모두 **경기별**이라 행마다 다른 값이 들어갈 수 있습니다(2026-08-23 확정). 채점은 경기별 view가 그대로 하고, 픽 점수는 주 단위로 합산됩니다(FR-017).
- 세션은 **첫 경기 킥오프 7일 전에 열리고 마지막 경기 킥오프에 닫힙니다**. 마감은 실제로 경기별이라, 첫 경기가 끝난 뒤 처음 들어온 사용자는 남은 경기만 제출합니다(부분 제출이 정상 상태). 화면은 `submittableMatches`로 남은 경기를 골라 `pending`으로 넘깁니다.
- insert RLS(`20260823130000_predictions_weekly_window.sql`): 그 경기가 `cancelled = false and started = false and kickoff_at > now()`이고, `prediction_week_first_kickoff(fixture_id) < now() + interval '7 days'`여야 통과합니다. 프론트의 `isMatchLocked`/`weekStatus`와 같은 기준이므로 한쪽만 바꾸면 어긋납니다.
- 주차 경계는 한국시간 월요일 시작입니다(SQL: `date_trunc('week', kickoff_at at time zone 'Asia/Seoul')` / TS: `week.ts`의 ISO 주차).

## Edge Function · 크론

FotMob 비공식 API에서 경기·선수 데이터를 긁어 DB에 적재하는 수집 함수들입니다. 소스는 `supabase/functions/`에 있고(배포본과 동일하게 관리), 요약은 `supabase/functions/README.md`, 채택 배경은 `vault/00_의사결정사항/02-adr/002-fotmob-api-채택.md`입니다.

**앱 코드는 이 함수들을 호출하지 않습니다.** 크론과 관리자 버튼 전용이고, 조회는 전부 클라이언트가 테이블/view를 직접 select합니다.

| 함수 | 쓰는 테이블 | 호출 |
|---|---|---|
| `sync-fixture` | `fixtures` (전 경기 upsert) | 크론 `sync-fixture-daily` (UTC `0 23 * * *` = KST 08:00) |
| `sync-fixture-ratings` | `fixture_player_ratings` | 크론 `sync-fixture-ratings-daily` (UTC `5 23 * * *` = KST 08:05) |
| `sync-season-squad` | `season_squads` | 수동(시즌 시작·이적시장) — upsert payload에 없는 컬럼(`pick_cost`, `is_active`)은 PostgREST가 대상에서 제외해 기존 행 값을 그대로 보존합니다. 신규 행만 컬럼 DEFAULT를 받습니다. |
| `get-fotmob-fixture`, `health-check` | 없음(조회/확인용) | 수동 |

- 크론은 **Supabase 대시보드 → Integrations → Cron**에 등록되어 있습니다. pg_cron은 DB 타임존(UTC) 기준으로 스케줄을 해석하므로 UI에 "At 23:00"으로 보이는 것이 KST 08:00입니다. Method는 **POST 필수**(두 함수 모두 POST 전용), Timeout은 기본값 1000ms가 너무 짧아 각각 10000 / 30000ms로 둡니다.
- 크론이 보내는 Authorization은 anon 키입니다. `verify_jwt: true`가 "프로젝트가 서명한 유효한 JWT"만 확인하고, DB 쓰기는 함수가 자기 환경변수의 service-role 키로 하기 때문에 크론 쪽에 비밀키가 없습니다.
- `sync-fixture-ratings`는 **종료됐고 평점 행이 11개 미만인 경기**를 최신순으로 최대 **5경기**씩 처리합니다. "행이 하나라도 있으면 완료"가 아닌 이유: FotMob 평점은 종료 직후 일부만 채워져 내려올 수 있고, 그 상태로 굳으면 남은 선수가 영구히 0점이 됩니다. 배치 상한은 Edge Function CPU 2초 제한 때문입니다(응답의 `remaining`이 0이 아니면 다음 실행이 이어받습니다).
- 즉시 실행이 필요하면 `/admin`의 "경기 결과·평점 동기화" 버튼(`lib/actions/sync-fixtures.ts`)이 같은 두 함수를 순서대로 POST하고 `revalidateTag('fixture-weeks')`로 목록 캐시를 비웁니다. 두 함수 모두 멱등해서 여러 번 눌러도 무해합니다.

## DB 수정 체크리스트

Supabase 스키마를 바꿀 때는 아래를 함께 처리하세요.

1. `supabase/migrations/`에 새 마이그레이션을 추가하거나 기존 기준을 명확히 수정합니다.
2. `frontend/src/types/database.ts`를 수동 업데이트합니다.
   - 실제 Supabase 프로젝트와 연결된 환경에서는 `cd app && npm run types:supabase`로 generated type도 생성할 수 있습니다.
3. 영향받는 테이블/컬럼을 코드에서 검색합니다.
   - `rg -n "from\\('table_name'\\)|column_name" frontend/src`
4. `frontend/src/lib/queries/*`, server actions, route 파일의 `select(...)` 문자열을 업데이트합니다.
5. 호환용 fallback query가 있는 경우 fallback도 같이 수정합니다.
6. RLS 정책을 기능별로 확인합니다.
   - 공개 읽기
   - 로그인 사용자 INSERT/UPDATE/DELETE
   - 관리자 전용 service-role 쓰기
7. Storage가 관련되면 버킷 존재 여부와 공개/비공개 정책을 확인합니다.
8. 최소 검증:
   - `cd app`
   - `npm run lint`
   - `npm run build`
9. mock mode가 아니라 실제 Supabase 연결 상태에서 영향받은 화면을 smoke test합니다.
10. 이 문서를 업데이트합니다.

## 현재 연동 오류 위험 지점

- `frontend/src/types/database.ts`가 수동 관리라서 실제 DB와 쉽게 어긋날 수 있습니다.
- `player-photos` Storage 버킷은 `20260529_public_profiles_storage_vote_guards.sql`에서 public bucket으로 생성/보정합니다.
- `club_status`, `player_season_stats`의 DB write policy가 넓게 열려 있습니다. 앱에서는 service role로 관리자 쓰기를 하지만 DB 정책 자체는 재검토가 필요합니다.
- 관리자 권한은 DB role이 아니라 `ADMIN_EMAILS` 환경변수 기반 앱 코드로 판단합니다.
- `votes`는 `20260529_public_profiles_storage_vote_guards.sql`에서 option-poll 복합 FK를 추가합니다. 기존 운영 DB에 이미 잘못된 vote row가 있으면 FK validation은 별도 점검이 필요합니다.
- 예정 투표(scheduled poll) 기능 자체가 TEA-25(2026-09)로 완전 제거됐습니다(`PollStatus`는 `'active' | 'closed'`). `polls.scheduled_at` 컬럼은 `20260904160000_drop_polls_scheduled_at.sql`로 2026-09-04 DROP 완료. `submitVote()`는 `status`/`closes_at`로 잘못된 INSERT를 방어합니다.
- 경기·평점 데이터는 **FotMob 비공식 API**에 의존합니다. 스펙이 예고 없이 바뀌면 수집이 조용히 멈출 수 있으므로, 함수들은 빈 응답을 성공으로 넘기지 않고(`EMPTY_FIXTURES`) 사유를 응답에 남깁니다. 이상 신호는 대시보드 Cron의 Runs 이력에서 확인합니다.
- 일부 기존 소스 파일의 한글 주석/문자열이 깨져 있습니다. DB 동작과 직접 관련은 없지만 유지보수 중 오해를 만들 수 있습니다.
