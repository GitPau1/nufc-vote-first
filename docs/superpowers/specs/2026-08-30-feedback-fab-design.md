# 피드백 FAB + 모달 설계

작성일: 2026-08-30
브랜치: `feat/feedback-fab`

## 목표

모든(로그인) 화면 우측 하단에 상시 FAB를 두고, 누르면 피드백 모달이 뜬다. 회원 불만을 빠르게 수집하는 것이 최우선 목적이다. 피드백이 남겨진 페이지를 자동 추적한다.

## 결정 사항 (확정)

| 항목 | 결정 |
|---|---|
| 대상 | 로그인 사용자만. 비로그인은 FAB 자체가 렌더되지 않음 |
| 담을 데이터 | 카테고리(필수) + 내용(필수) + 이모지 만족도(선택) |
| 카테고리 | 투표 / 승부예측 / 역대선수 / 기타 |
| 페이지 추적 | 경로 원문 자동 저장 + 카테고리는 현재 페이지 기준 자동 선택(사용자 변경 가능) |
| 관리자 열람 | 이번 범위 제외. Supabase 대시보드에서 직접 조회(RLS 우회) |
| `/my/feedback` | 그대로 유지. 새 필드는 기본값(category=`etc`, rating/page_path 없음)으로 계속 작동 |
| FAB 숨김 페이지 | `/admin*`, `/onboarding` |

## 데이터 모델 — `user_feedback` 확장

현재 컬럼: `id`, `user_id`, `content`, `created_at`.
신규 타임스탬프 마이그레이션으로 3개 컬럼 추가 (기존 파일 수정 금지 관례 준수, 짝이 되는 rollback 파일 포함).

| 컬럼 | 타입 | 제약 |
|---|---|---|
| `category` | text | NOT NULL, DEFAULT `'etc'`, CHECK (`vote`, `prediction`, `player`, `etc`) |
| `rating` | smallint | NULL 허용, CHECK (`rating` BETWEEN 1 AND 5) |
| `page_path` | text | NULL 허용 |

- DEFAULT `'etc'`를 두는 이유: 기존 행 및 `/my/feedback` 경로가 category 없이 insert해도 깨지지 않게 하기 위함.
- RLS: 기존 insert-only 정책(`WITH CHECK (auth.uid() = user_id)`) 유지. SELECT 정책은 추가하지 않는다(대시보드로만 열람).
- `frontend/src/types/database.ts`의 `user_feedback` Row/Insert 타입을 새 컬럼에 맞게 수동 갱신.

## 서버 액션 `submitFeedback` 확장

`frontend/src/lib/actions/feedback.ts`

- 시그니처를 위치 인자 `content: string`에서 객체 `{ content, category, rating?, pagePath? }`로 변경.
- 검증: `content` 비어있지 않음(기존), `category`가 허용 집합에 속함, `rating`이 있으면 1~5 정수.
- `IS_MOCK`이면 DB 건너뜀(기존 관례 유지).
- `insert`에 `category`, `rating ?? null`, `page_path: pagePath ?? null` 포함.

## 경로 → 카테고리 매핑 (순수 함수)

새 유틸 함수 `pathToCategory(pathname: string): FeedbackCategory`
- `/`, `/polls`로 시작 → `vote`
- `/predictions`로 시작 → `prediction`
- `/players`로 시작 → `player`
- 그 외 → `etc`

소스 문자열 정규식 테스트 관례를 피하기 위해 순수 함수로 분리하고 `*.test.mjs` 단위 테스트로 커버한다(매핑 각 케이스 + fallback).

## FAB 컴포넌트

- `'use client'` 컴포넌트. `frontend/src/app/layout.tsx`의 `<BottomNav />` 옆에 상시 마운트.
- 노출 조건: (1) 로그인 상태 AND (2) 현재 경로가 `/admin*`, `/onboarding`이 아님. 하나라도 아니면 `null` 반환.
  - 로그인 여부 판정 방식은 기존 헤더/네비 인증 취득 패턴(`usePathname` + 클라이언트 인증 상태)을 따른다. 구현 시 기존 로그인 상태 소스를 재확인.
- 위치: `fixed`, 우측 하단. BottomNav(있는 화면)와 겹치지 않도록 위로 offset, `z-index`는 BottomNav 이상.
- 브랜드 컬러: 시맨틱 토큰 클래스(`bg-brand-solid` 등) 사용. 하드코딩 hex 금지.
- 클릭 시 자체 `useState`로 모달 open.

## 피드백 모달

- 기존 껍데기 `frontend/src/components/primitives/modal/Modal.tsx`를 `form="responsive"`로 재사용(데스크탑=중앙 모달, 모바일=바텀시트).
- 본문은 `modal/contents/`에 새 content 컴포넌트로 작성.
- 구성(참고 이미지 순서):
  1. 이모지 만족도 5단계(선택) — 미선택 시 `rating=null`.
  2. 카테고리 드롭다운 — 모달 열릴 때 `pathToCategory(pathname)`로 초기값 선택, 사용자 변경 가능.
  3. 내용 textarea(필수) + 글자수 카운터. 기존 `MyFeedbackForm`의 textarea+카운터 UI 스타일 재사용.
  4. 제출 버튼(프리미티브 `button.tsx`).
- 제출: `useTransition` + 동적 import로 `submitFeedback({ content, category, rating, pagePath: pathname })` 호출. 성공 시 모달 닫힘 + 성공 표시, `trackEvent('feedback_submitted', ...)` 유지.
- page_path는 모달을 연 시점의 경로를 고정해 넘긴다(제출 지연 중 라우팅돼도 남긴 화면 기준 유지).

## `/my/feedback` 처리 (최소 수정)

- `MyFeedbackForm`은 액션 시그니처 변경에 맞춰 `submitFeedback({ content })` 형태로만 호출하도록 수정.
- category는 DEFAULT `'etc'`로 채워지고, rating/page_path는 없음. UI 변경 없음.

## 테스트 / 스토리북

- `pathToCategory` 순수 함수 `*.test.mjs` 단위 테스트(각 경로군 + fallback).
- `submitFeedback` 검증 로직 테스트(카테고리 허용 집합, rating 범위) — 기존 액션 테스트 관례가 있으면 그에 맞춤.
- `frontend/src/storybook/feedback/`에 새 피드백 모달 스토리 추가.
- 커밋 전 `npm test`(전체) 실행.

## 범위 밖 (이번에 안 함)

- 관리자 열람 화면(`/admin/feedback`), 관리자 SELECT RLS.
- 스팸/rate limit 방어(로그인 필수라 우선순위 낮음).
- 만족도 통계/집계 화면.
