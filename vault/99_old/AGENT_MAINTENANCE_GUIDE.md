# Agent Maintenance Guide

최종 업데이트: 2026-05-29

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
- `players.squad_status`, `polls.thumbnail_url` 관련 fallback query가 있어 스키마 불일치가 숨겨질 수 있습니다.
- `player-photos` Storage bucket은 `20260529_public_profiles_storage_vote_guards.sql`에서 public bucket으로 생성/보정합니다.
- `club_status`, `player_season_stats`의 DB write policy는 넓게 열려 있습니다.
- 댓글 작성자 표시는 `public_profiles`를 사용해야 합니다. `users` 전체 공개로 해결하지 않습니다.
- `votes`는 `20260529_public_profiles_storage_vote_guards.sql` 이후 option-poll 복합 FK로 보강됩니다.
- `submitVote()`는 status/scheduled_at/closes_at 검증을 거친 뒤 INSERT해야 합니다.
- 예정/마감 투표 자동 상태 전환은 아직 cron/Edge Function 후속 작업입니다.

## 기능별 주요 파일

관리자 대시보드 분리 메모:

- 이적 탭 UI와 이적 수정/복귀 클라이언트 로직은 `frontend/src/app/admin/AdminTransfersPanel.tsx`를 먼저 확인합니다.
- `frontend/src/app/admin/AdminDashboard.tsx`는 전체 섹션 라우팅과 선수/투표/구단 폼 중심으로 유지합니다.
- 큰 관리자 파일을 수정할 때는 필요한 섹션 컴포넌트만 읽고, 전체 파일 출력은 피합니다.

투표:

- 조회: `frontend/src/lib/queries/polls.ts`
- 투표 제출: `frontend/src/lib/actions/vote.ts`
- 투표 가능 여부: `frontend/src/lib/polls/vote-eligibility.ts`
- 댓글/좋아요: `frontend/src/lib/queries/comments.ts`, `frontend/src/lib/actions/comments.ts`
- 화면: `frontend/src/app/page.tsx`, `frontend/src/app/polls/[id]/page.tsx`

승부예측:

- 조회: `frontend/src/lib/queries/fixtures.ts`
- 주차 그룹핑/주 세션 상태 파생/`toPredictWeeks` 어댑터: `frontend/src/lib/predictions/week.ts` (+ `week.test.mjs`)
- 선수 후보 더미: `frontend/src/lib/predictions/candidates.ts`
- 화면: `frontend/src/app/predictions/page.tsx`, `frontend/src/app/predictions/week/[weekKey]/page.tsx`, `frontend/src/components/predict/*`
- 예측/제출 단위는 경기가 아니라 **주(week)**다. 상태(`open`/`result`/`upcoming`)도 주 레벨에만 있고, 더블 매치위크는 경기 2개가 한 세션이다.
- 아직 없는 것: 예측 제출 action, 완료/결과 화면, 랭킹 데이터(`RankingCard`는 빈 배열로 렌더), predictions 테이블

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

- 화면: `frontend/src/app/admin/page.tsx`, `frontend/src/app/admin/AdminDashboard.tsx`
- action: `frontend/src/lib/actions/admin.ts`, `frontend/src/lib/actions/farewells.ts`
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
