# 01 — 시스템 아키텍처

## 기술 스택

| 역할 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) |
| 스타일링 | Tailwind CSS |
| UI 컴포넌트 | shadcn/ui (커스텀 디자인 시스템 적용 예정) |
| 애니메이션 | Framer Motion |
| 백엔드·DB·인증·스토리지 | Supabase |
| 배포 | Vercel |
| 분석 | Mixpanel |

## 전체 구조

```
클라이언트 (Next.js App Router)
  ├─ /app                  # 페이지 라우트
  ├─ /components           # UI 컴포넌트
  └─ /lib/supabase.ts      # Supabase 클라이언트

Supabase
  ├─ Auth                  # Google OAuth
  ├─ Database (PostgreSQL) # 투표, 선수, 댓글 등
  └─ Storage               # 선수 사진

Vercel                     # 배포
Mixpanel                   # 분석
```

## Next.js 폴더 구조

```
/app
  ├─ layout.tsx            # 글로벌 레이아웃 (헤더 포함)
  ├─ page.tsx              # 투표 목록 (/)
  ├─ polls/
  │   └─ [id]/
  │       └─ page.tsx      # 투표 상세 (/polls/[id])
  ├─ my/
  │   └─ page.tsx          # 마이페이지 (/my)
  └─ auth/
      └─ callback/
          └─ route.ts      # OAuth 콜백 (/auth/callback)
```

## 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # 서버사이드 전용
NEXT_PUBLIC_MIXPANEL_TOKEN=
```
