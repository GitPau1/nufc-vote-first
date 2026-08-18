# NUFC Fan Poll ⚫⚪

Newcastle United 팬들을 위한 실시간 투표 플랫폼.

선수 평가(Type A)와 선호도 선택(Type B) 두 가지 투표 타입을 지원하며, Google 소셜 로그인으로 참여합니다.

## 기술 스택

| 역할 | 기술 |
|------|------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Google OAuth via Supabase Auth |
| Analytics | Mixpanel |
| Deploy | Vercel |

## 로컬 실행

```bash
# 의존성 설치
cd frontend
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local 에 Supabase URL/Key 등 입력

# 개발 서버 시작 (http://localhost:3000)
npm run dev
```

> `.env.local` 없이도 실행 가능 — Supabase 미연결 시 mock 데이터로 동작

## DB 스키마 배포 (Supabase CLI)

```bash
# 루트 디렉토리에서
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

## 환경 변수

`frontend/.env.example` 참고:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_MIXPANEL_TOKEN=
```

## 프로젝트 구조

```
├── frontend/     # Next.js 앱 (Vercel root directory)
│   └── src/
│       ├── app/          # App Router 페이지
│       ├── components/   # React 컴포넌트
│       ├── lib/          # Supabase 클라이언트, 쿼리, Server Actions
│       └── types/        # TypeScript 타입
├── vault/        # Obsidian 볼트 — 기획/설계 문서, 노트, 프로토타입
└── supabase/     # DB 마이그레이션 (신규 backend로 이전 예정)
    └── migrations/
```
