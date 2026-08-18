# Feature Design: Auth Flow, Admin Panel, Club Info Page

**Date:** 2026-05-28  
**Status:** Approved

---

## Context

NUFC Fan Poll 앱에 세 가지 기능을 추가한다.

1. **로그인/회원가입 흐름 개선** — 전용 로그인 페이지 + 닉네임 설정 온보딩
2. **관리자 패널** — 투표 생성, 선수 관리, 구단 현황 수동 업데이트
3. **구단 정보 페이지** — 구단 현황 카드 + 시즌 스탯 + 포지션별 선수 목록

---

## 1. 로그인 / 회원가입 흐름

### 진입점
- **헤더 로그인 버튼** → `/login` 페이지로 이동
- **투표 시도 (비로그인)** → 기존 `LoginModal` 그대로 (변경 없음)
- 두 경로 모두 Google OAuth → `/auth/callback` → 분기

### /login 페이지
- Google로 로그인 버튼 (Contained, Primary)
- 구분선 + Google로 회원가입 버튼 (Outlined)
- 기능 차이 없음 — UI상 구분만

### OAuth 콜백 분기
```
/auth/callback
  ├─ display_name이 null → /onboarding (신규 가입자)
  └─ display_name이 있음 → / (기존 사용자)
```

### /onboarding 페이지
- Google 프로필 아이콘 표시 (아바타)
- 닉네임 입력 (2~12자, 특수문자 제외)
- 저장 → `users.display_name` 업데이트 → `/` 이동
- 미로그인 상태로 `/onboarding` 접근 시 `/login`으로 리다이렉트 (middleware)

---

## 2. 관리자 패널

### 관리자 지정
- 환경변수 `ADMIN_EMAILS=geonhaa@gmail.com` (쉼표 구분 복수 지원)
- `middleware.ts`에서 `/admin` 경로 접근 시 이메일 검증 → 불일치 시 `/` 리다이렉트
- 서버 액션에도 동일 검증 (이중 보호)

### 진입점
- 헤더 아바타 클릭 → 드롭다운: 마이페이지 / ⚙ 관리자 페이지 / 로그아웃
- 관리자 계정에서만 "⚙ 관리자 페이지" 항목 노출

### /admin 페이지 기능
1. **투표 만들기** — Type A (평가형) / Type B (선택형) 생성 폼
2. **투표 목록 관리** — 상태 변경 (active/closed), 삭제
3. **선수 추가/수정/비활성화** — `players` 테이블 CRUD
4. **구단 현황 수동 입력** — 순위, 다음 경기 상대, 경기 일시, 시즌 스탯 대표 선수 (최다 출전/득점/어시)

---

## 3. 구단 정보 페이지

### 라우트
- `/club` 신규 페이지
- 하단 내비게이션: **투표** / **구단 정보** 2개

### 레이아웃 (상→하)
1. **구단 현황 카드** (다크 그라디언트, #0c2340 → #1a3a60)
   - 리그 순위 + 다음 경기 (상대, 일시, 홈/원정)
2. **시즌 스탯 3열 그리드**
   - 최다 출전 / 최다 득점 / 최다 어시
   - 각 카드: 레이블 + 선수 사진(아바타) + 이름 + 수치
3. **포지션별 선수 목록**
   - GK / DEF / MID / FWD / MANAGER 순서
   - 포지션 헤더 포함해서 카드 1개로 묶음
   - 선수 행: 등번호(좌) | 사진+이름+국적(중) | 나이(우)
   - `players` 테이블 `is_active = true` 필터

### 데이터
- 구단 현황 + 시즌 스탯: `club_status` 테이블 신규 생성 (행 1개 고정)
- 선수 목록: 기존 `players` 테이블 재사용
- `players` 테이블에 `nationality`, `birth_date` 컬럼 추가 필요

---

## 데이터베이스 변경

```sql
-- 1. club_status 테이블 (신규)
CREATE TABLE club_status (
  id           int PRIMARY KEY DEFAULT 1,  -- 항상 1행
  league_rank  int,
  next_match_opponent text,
  next_match_date     text,
  next_match_venue    text,  -- 'home' | 'away'
  top_appearances_player_id uuid REFERENCES players(id),
  top_appearances_count     int,
  top_goals_player_id       uuid REFERENCES players(id),
  top_goals_count           int,
  top_assists_player_id     uuid REFERENCES players(id),
  top_assists_count         int,
  updated_at   timestamptz DEFAULT now()
);

-- 2. players 테이블 컬럼 추가
ALTER TABLE players ADD COLUMN nationality text;
ALTER TABLE players ADD COLUMN birth_date  date;
```

---

## 신규 파일 목록

| 파일 | 설명 |
|------|------|
| `app/src/app/login/page.tsx` | 로그인 페이지 |
| `app/src/app/onboarding/page.tsx` | 닉네임 설정 페이지 |
| `app/src/app/admin/page.tsx` | 관리자 대시보드 |
| `app/src/app/club/page.tsx` | 구단 정보 페이지 |
| `app/src/lib/actions/admin.ts` | 관리자 서버 액션 (투표/선수/구단 현황 CRUD) |
| `app/src/lib/queries/club.ts` | 구단 현황 + 선수 목록 쿼리 |
| `app/src/components/layout/UserMenu.tsx` | 아바타 드롭다운 (마이/관리자/로그아웃) |
| `app/src/components/club/ClubStatusCard.tsx` | 구단 현황 다크 카드 |
| `app/src/components/club/SeasonStats.tsx` | 시즌 스탯 3열 그리드 |
| `app/src/components/club/SquadList.tsx` | 포지션별 선수 목록 |
| `supabase/migrations/YYYYMMDD_club_squad.sql` | DB 마이그레이션 |

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `app/src/middleware.ts` | `/admin`, `/onboarding` 경로 보호 추가 |
| `app/src/app/auth/callback/route.ts` | display_name null 체크 → /onboarding 분기 |
| `app/src/components/layout/AppHeader.tsx` | UserMenu 컴포넌트로 교체 |
| `app/src/app/layout.tsx` | 하단 내비게이션 추가 |

---

## 검증 방법

1. 비로그인 상태에서 헤더 로그인 버튼 → `/login` 이동 확인
2. Google OAuth 후 신규 계정 → `/onboarding` 이동, 닉네임 저장 후 `/` 이동 확인
3. 기존 계정 OAuth → 바로 `/` 이동 확인
4. `ADMIN_EMAILS` 미포함 계정으로 `/admin` 직접 접근 → `/` 리다이렉트 확인
5. 관리자 계정 로그인 → 드롭다운에 관리자 항목 노출 확인
6. `/club` 페이지: 구단 현황 카드, 스탯 3열, 선수 목록 정상 렌더링 확인
7. 관리자에서 구단 현황 수정 → `/club` 반영 확인
