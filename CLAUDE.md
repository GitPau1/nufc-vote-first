# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Newcastle United 팬 투표 플랫폼 (한국어, 모바일 퍼스트). Next.js 14 App Router + Supabase (Auth/Postgres/Storage), 배포는 Vercel. 앱 코드는 `frontend/`에 있고, 리포 루트가 아니라 `frontend/`이 Vercel root directory다.

## Commands (all run from `frontend/`)

```bash
npm run dev              # 개발 서버 (mock 모드는 .env.local 없이도 동작)
npm run build
npm run lint

npm run test:vote-eligibility   # 개별 단위 테스트 (node --test)
npm run test:rating
npm run test:query-cache
npm run test:middleware-auth
npm run test:header-auth
npm run test:prefetch-policy
npm run test:images   # 유일하게 --experimental-strip-types로 실행 (.ts 파일 직접 실행)

npm run types:supabase    # DB 스키마 변경 후 database.generated.ts 재생성 (supabase CLI 필요)
```

DB migration은 리포 루트에서 `supabase db push` (사전에 `supabase link --project-ref <ref>` 필요).

각 테스트는 대응하는 소스 옆의 `*.test.mjs` 파일을 직접 실행하는 방식이라 개별 테스트 필터링 플래그는 없다 — 파일 자체가 하나의 테스트 단위다.

## Architecture

- Mock/실연동 모드는 `frontend/src/lib/config.ts`가 결정한다: `NEXT_PUBLIC_SUPABASE_URL`이 없거나 `http`로 시작하지 않으면 `IS_MOCK = true`가 되어 `lib/mock/`의 데이터를 쓴다. **기능을 mock 모드에서만 확인하고 끝내지 말 것** — 실제 Supabase 연동 시 깨질 수 있다.
- 데이터 계층은 조회(`lib/queries/*`)와 쓰기(`lib/actions/*`)로 분리되어 있다. 스키마를 바꾀면 migration, `frontend/src/types/database.ts`(수동 관리라 drift 주의), query의 `select(...)`, action의 payload, RLS 정책을 함께 확인한다.
- 관리자 권한은 `lib/admin.ts`의 `ADMIN_EMAILS` 판정 + `lib/supabase/admin.ts`의 service-role 클라이언트 조합으로 동작한다.
- 투표는 제출 후 수정 불가(DB UNIQUE 제약), 결과는 참여 후에만 공개, 댓글은 투표 참여자만 작성 가능 — 이 세 제약은 UI/쿼리 어디를 고치든 깨지면 안 된다.

## Before touching DB/Supabase-related code

먼저 **`vault/99_old/AGENT_MAINTENANCE_GUIDE.md`**를 읽어라 — Supabase 작업 체크리스트, 현재 조심할 부분(스키마 drift, fallback query, storage bucket 등), 기능별 주요 파일 목록이 정리되어 있다. 데이터 연결 구조 자체를 알아야 하면 **`vault/99_old/SUPABASE_DATA_CONNECTIONS.md`**를 함께 본다. 이 두 문서는 이 리포에서 가장 최신 상태로 유지되는 지도이므로, 코드를 직접 재탐색하기 전에 먼저 참고할 것.

## Specs

기능 스펙은 `vault/99_old/specs/`에 번호별로 나뉘어 있고, `vault/99_old/SPEC_INDEX.md`가 어떤 작업에 어떤 파일을 읽어야 하는지 매핑해준다. 작업 시작 전 `SPEC_INDEX.md`를 먼저 보고 필요한 spec만 골라 읽는다.

## Repo conventions

- 관리자 대시보드처럼 큰 파일(`frontend/src/app/admin/AdminDashboard.tsx` 등)은 전체를 읽지 말고 필요한 섹션 컴포넌트만 확인한다.
- `vault/99_old/decisions.md`는 사용자 열람 전용 로그이며 에이전트가 읽거나 쓰는 파일이 아니다.
- 데이터 연결 구조나 기능별 주요 파일이 바뀌면 `vault/99_old/SUPABASE_DATA_CONNECTIONS.md` / `vault/99_old/AGENT_MAINTENANCE_GUIDE.md`를 함께 업데이트한다.
