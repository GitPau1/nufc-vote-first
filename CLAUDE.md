# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Newcastle United 팬 투표 플랫폼 (한국어, 모바일 퍼스트). Next.js 14 App Router + Supabase (Auth/Postgres/Storage), 배포는 Vercel. 앱 코드는 `frontend/`에 있고, 리포 루트가 아니라 `frontend/`이 Vercel root directory다.

## 작업 방식 — 반드시 지킬 것

관례가 아니라 실제로 어겨서 사고가 났던 항목이다. 아래 원칙은 다른 지침보다 우선한다.

1. **구조·이름을 임의로 발명하지 않는다.** 사용자가 분류 기준(예: "원자 ↔ 조합체")을 주면 **그 기준 안에서만** 배치한다. 폴더·카테고리·버킷·prop 이름을 스스로 지어내지 않는다. 기준으로 안 풀리는 항목이 나오면 새 카테고리를 만들지 말고 "이건 어디에 둘지" **되묻는다** — 선택지를 여러 개 지어내 내미는 것도 발명이다. "기존에 이 폴더가 있으니까", "보통 이렇게 하니까"는 발명의 핑계다.
2. **실행 중 계획에 없는 판단이 필요하면 멈추고 확인한다.** 파일명 규칙, prop 이름, 껍데기↔내용 경계, 특정 컴포넌트를 어느 폴더에 둘지 등 계획서에 명시되지 않은 결정은 임의로 진행하지 않고 먼저 사용자에게 확인한다. "이 정도는 이렇게 하면 되겠지"로 넘긴 것이 매번 재작업으로 돌아왔다.
3. **큰/구조적 작업은 시안 → 승인 게이트 → 실행 순서로 한다.** 파일 재배치·리팩터링처럼 되돌리기 어려운 작업은 구체 시안(전체 배치표·트리·API)을 먼저 문서로 만들어 눈으로 확인받은 뒤 실행한다. 추천을 낼 때는 그게 **사용자 목표에서 나온 것인지 내 판단(주로 리스크 회피)인지 구분해 표시**한다 — 저비용 옵션을 "권장"으로 밀어붙이지 않는다.
4. **모든 판단엔 실재 근거, 없으면 "근거 미확인"으로 넘긴다.** 삭제·이동·통합·예외 처리는 실제 코드/문서(`file:줄`, 테스트명)에 근거한다. "그럴듯해서"로 결정하지 않는다. 근거를 못 찾으면 임의로 메꾸지 말고 "근거 미확인"으로 사용자 판단에 넘긴다 — 계획서의 전제도 실측으로 틀린 게 있었다.
5. **설명은 디자이너도 이해할 수 있을 정도로 쉽고 간결하게 한다.** 설명이 필요한, 특히 개발 관련된 요소들은 직무에 관계 없이 이해하기 쉽도록 풀어서 설명한다.  

## 에이전트 체계 (SDLC)

이 리포는 역할 분담 구조로 작업한다. 역할·에스컬레이션·모델 배정의 기준 문서는 **`vault/01_에이전트/`**다
(전체 맥락은 `README-sdlc-system.md`, 판단 기준은 `orchestrator-rules.md`가 단일 소스).

**메인 세션은 오케스트레이터(Fable)다.** 사용자가 별도로 에이전트를 지목하지 않아도, 메인 세션이 흐름·순서·에스컬레이션 판단만 직접 하고 실행은 아래로 라우팅한다:

- **구현 작업** (feature-spec/plan 작성, 코드 수정) → `developer` 에이전트
- **디자인/기획 작업** (design-brief, UX 흐름·톤 판단) → `designer` 에이전트
- **홍보/미디어/마케팅 작업** (앱 내 홍보 문구, 팬 사이트 게시글, 신규 유저 확보 전략) → `marketing` 에이전트 (실제 게시는 하지 않고 초안까지만 — 상세는 `vault/01_에이전트/marketing-agent-rules.md`)
- **Linear 이슈 생성·상태 변경·댓글** → 메인 세션이 내용을 완결되게 구성한 뒤 `linear-ops` 에이전트가 실행 (메인 세션이 Linear CRUD를 직접 하지 않는다)
- 위임 전 `vault/01_에이전트/orchestrator-rules.md`의 에스컬레이션 기준을 확인하고, 애매한 결정은 진행 전에 사용자에게 질문 형식(상황/선택지/트레이드오프/추천)으로 올린다.
- **위임 단위·리뷰 방식·모델 지정**은 같은 문서의 "컨텍스트(토큰) 비용 규칙" 섹션을 따른다: 구현은 plan 단계별 새 에이전트(같은 에이전트 이어 쓰기 최대 2회), `code-review`는 `low`/`medium`만 1회(메인 컨텍스트가 크면 스킬 대신 새 sonnet 에이전트에 diff 경로만 넘김), 모든 서브에이전트 스폰에 `model` 명시(기본값이 opus 5).

- **작업별 산출물**은 `vault/02_프로젝트/<Linear 프로젝트명>/`에 둔다: `intent.md` → `spec.md`(또는 `design-brief.md`/`feature-spec.md`/`marketing-brief.md`) → `plan.md`. 소속 프로젝트가 없는 단발 이슈는 간소 사이클 — 이슈 본문이 spec, plan 승인만 거친다.
- 기능/프로젝트에 안 걸리고 계속 갱신되는 마케팅 상시 문서(브랜드 보이스·성장 전략·콘텐츠 캘린더)는 예외로 `vault/03_마케팅/`에 두고 Linear 이슈로 만들지 않는다 (상세는 `marketing-agent-rules.md`).
- **`plan.md`는 사람의 승인 없이는 구현을 시작하지 않는다.**
- 구현이 끝났다고 바로 완료 보고하지 않는다 — 반드시 아래 Commands의 검증 명령어(테스트/린트/빌드)로 스스로 확인한 뒤 결과를 그대로 보고한다. 실패한 검증 결과를 숨기거나 축소하지 않는다.
- 언제 사람에게 물어야 하는지는 `vault/01_에이전트/orchestrator-rules.md`를 따른다. 애매하면 진행하지 않고 먼저 확인한다.
- 새로운 외부 서비스/라이브러리는 임의로 추가하지 않는다 (먼저 사람에게 확인).

## Git / GitHub 규칙

- `main`은 직접 push 금지, 반드시 PR을 통해서만 반영한다.
- 브랜치명은 Linear 이슈 ID를 포함한다 (Linear에서 자동 생성되는 브랜치명 형식 그대로 사용). 여러 이슈를 묶는 프로젝트 단위 브랜치는 예외.
- PR 설명에는 관련 Linear 이슈 ID와 함께 `Fixes TEA-XX` 형식의 매직 워드를 반드시 포함한다.
- PR 설명에는 "무엇을 왜 바꿨는지"를 사람이 다시 코드를 안 봐도 이해할 수 있게 요약한다.

## Commands (all run from `frontend/`)

```bash
npm run dev              # 개발 서버 (mock 모드는 .env.local 없이도 동작)
npm run build
npm run lint

npm test                 # src 아래 *.test.mjs 전부 (현재 94개) — 커밋 전에 이걸 돌린다
npm run test:vote-eligibility   # 개별 단위 테스트 (node --test)
npm run test:rating
npm run test:query-cache
npm run test:middleware-auth
npm run test:header-auth
npm run test:prefetch-policy
npm run test:images   # .ts 파일을 직접 import해서 --experimental-strip-types가 필요하다

npm run storybook        # 디자인시스템 Storybook (localhost:6006)
npm run build-storybook

npm run types:supabase    # DB 스키마 변경 후 database.generated.ts 재생성 (supabase CLI 필요)
```

DB migration은 리포 루트에서 `supabase db push` (사전에 `supabase link --project-ref <ref>` 필요).

각 테스트는 대응하는 소스 옆의 `*.test.mjs` 파일을 직접 실행하는 방식이라 개별 테스트 필터링 플래그는 없다 — 파일 자체가 하나의 테스트 단위다. **개별 script는 전체 테스트 파일의 일부만 덮는다**(13개 중 7개) — 나머지(`design-foundation`, `poll-list-client`, `root-route`, `navigation-loading`, `login-modal`, `bottom-nav`, `result-view-figma-contract`)는 `npm test`로만 돌아간다. 2026-08-24에 이 script가 없어서 화면 구조가 바뀐 뒤에도 4건이 깨진 채 방치돼 있었다.

이 테스트들은 대부분 **소스 문자열을 정규식으로 검사**한다(렌더링 테스트가 아니다). 그래서 화면 구조를 옮기면 로직이 옳아도 깨진다 — 그럴 때는 테스트를 지우지 말고 **옮겨간 자리를 기준으로 단정문을 다시 쓴다.**

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

