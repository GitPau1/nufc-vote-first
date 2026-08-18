# Functional Spec Index — Newcastle United Fan Poll

작업 시작 전 이 파일을 먼저 읽고, 아래 표를 보고 **필요한 spec 파일만** 골라 읽으세요.

## 파일 목록

| 파일 | 다루는 내용 | 반드시 함께 읽어야 할 파일 |
|------|------------|--------------------------|
| [01-architecture.md](specs/01-architecture.md) | 폴더 구조, Supabase 연동, 환경변수 | — |
| [02-auth.md](specs/02-auth.md) | Google OAuth, 접근 권한 테이블, 로그인 유도 흐름 | — |
| [03-data-model.md](specs/03-data-model.md) | 전체 DB 스키마 (CREATE TABLE), RLS 정책, 테이블 관계 | — |
| [04-poll-list.md](specs/04-poll-list.md) | 메인 페이지(/), 투표 카드, 무한 스크롤, 헤더 | 02-auth |
| [05-poll-detail.md](specs/05-poll-detail.md) | 투표 상세(/polls/[id]), Type A/B UI, 확인 모달, 결과 화면 | 02-auth, 03-data-model |
| [06-mypage.md](specs/06-mypage.md) | 마이페이지(/my), 프로필, 탈퇴 처리 | 02-auth |
| [07-scheduled-polls.md](specs/07-scheduled-polls.md) | 예정 투표 blur UI, 카운트다운, 자동 공개/마감 cron | 03-data-model |
| [08-comments.md](specs/08-comments.md) | 댓글 작성 조건, 좋아요, 정렬, 에러 처리 | 02-auth, 03-data-model |
| [09-analytics.md](specs/09-analytics.md) | Mixpanel 이벤트 전체 목록 및 속성 | — |
| [10-content-mgmt.md](specs/10-content-mgmt.md) | 선수/투표 등록 SQL 예시, 관리 방법 | 03-data-model |
| [11-design-system.md](specs/11-design-system.md) | 색상·타이포·radius·shadow 토큰, 컴포넌트 패턴, Tailwind 설정 | — |

## 작업 유형별 추천 읽기 순서

| 작업 | 읽을 파일 |
|------|----------|
| 프로젝트 초기 셋업 | 01 → 02 → 03 |
| UI 컴포넌트 구현 시작 | 11 (디자인 시스템 먼저 확인) |
| 투표 목록 UI 구현 | 04 → 11 (+ 02) |
| 투표 참여 흐름 구현 | 05 → 11 (+ 02, 03) |
| 댓글 기능 구현 | 08 (+ 02, 03) |
| 마이페이지 구현 | 06 (+ 02) |
| 예정/마감 투표 처리 | 07 (+ 03) |
| Mixpanel 연동 | 09 |
| DB 초기 데이터 입력 | 10 (+ 03) |
| 전체 아키텍처 리뷰 | 전부 |

## 핵심 제약 사항 (어떤 작업이든 반드시 숙지)

- 투표는 **제출 후 수정 불가** — DB UNIQUE 제약으로 중복 투표 차단
- 결과(%)는 **투표 완료 후에만 공개** — 미참여자에게 비율 노출 금지
- 댓글은 **해당 투표 참여자만** 작성 가능
- 모바일 퍼스트 (375px 기준), 라이트 테마
- 언어: 한국어
