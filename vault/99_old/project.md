# 서비스 개요

## 목적
뉴캐슬 유나이티드 팬들이 시즌 종료 후 선수·감독·시즌 전체에 대한 의견을 구조화된 투표로 남기고,
다른 팬들의 집단 의견과 비교할 수 있는 **시즌 종료형 팬 참여 플랫폼**.

## 핵심 원칙
1. 투표는 빠르지만 가볍지 않다 — 선택은 의미 있는 결정처럼 느껴져야 한다
2. 결과는 참여 이후에만 공개된다
3. 투표는 제출 후 수정 불가 (DB UNIQUE 제약)
4. 댓글은 해당 투표 참여자만 작성 가능
5. 모바일 퍼스트 (375px 기준), 라이트 테마, 한국어

---

# 기술 스택

## 프론트엔드
- **Next.js 14** (App Router)
- **Tailwind CSS** — 유틸리티 스타일링
- **shadcn/ui** — 기본 컴포넌트 (커스텀 디자인 시스템 토큰으로 오버라이드)
- **Framer Motion** — 캐러셀 애니메이션, 트랜지션

## 백엔드
- **Supabase Auth** — Google OAuth, 쿠키 기반 세션
- **Supabase Database (PostgreSQL)** — 투표, 선수, 댓글, 좋아요
- **Supabase Storage** — 선수 사진

## DB / 인프라
- **Vercel** — 배포
- **Mixpanel** — 사용자 행동 분석
- **pg_cron** (Supabase) — 예정 투표 자동 공개/마감

---

# 디자인 시스템

## 원본 경로
- 토큰·컴포넌트 패턴: `vault/99_old/specs/11-design-system.md`
- LDSG 연구 자료: `design.md`
- 인덱스: `vault/99_old/design-system-index.md`

## 브랜딩 요약
- Primary: `#41b6e6` (Newcastle 하늘색)
- 배경: `#fafafa` (on-gray 표면)
- 폰트: Pretendard Variable

---

# 기능 목록

## 인증
- [ ] Google OAuth 로그인 (Supabase Auth)
- [ ] 로그인 유도 모달 (비로그인 투표 시도 시)
- [ ] 로그인 후 원래 투표 페이지로 복귀

## 투표 목록 (`/`)
- [ ] 투표 카드 목록 (최신순, 무한 스크롤)
- [ ] 투표 상태별 표시 — active / scheduled(blur) / closed
- [ ] 예정 투표 카운트다운 타이머

## 투표 상세 (`/polls/[id]`)
- [ ] Type A UI — radio-button 옵션 선택
- [ ] Type B UI — 선수 캐러셀 선택
- [ ] 투표 확인 모달 (Bottom Sheet)
- [ ] 투표 제출 (`votes` INSERT)
- [ ] 결과 화면 — 실시간 % 계산, 내 선택 강조

## 댓글 (`/polls/[id]` 결과 화면 하단)
- [ ] 댓글 작성 (투표 참여자만, 500자 제한)
- [ ] 댓글 목록 (좋아요 수 내림차순)
- [ ] 댓글 좋아요 토글

## 마이페이지 (`/my`)
- [ ] 프로필 표시 (아바타·이름·이메일)
- [ ] 참여한 투표 목록 (클릭 시 결과 화면)
- [ ] 로그아웃
- [ ] 회원 탈퇴 (소프트 딜리트)

## 예정 투표
- [ ] blur preview 카드
- [ ] pg_cron 자동 공개/마감

## 분석
- [ ] Mixpanel 이벤트 연동 (09-analytics.md 전체)
