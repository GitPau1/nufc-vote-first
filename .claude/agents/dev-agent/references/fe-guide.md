# FE 구현 가이드

> 이 파일은 개발 에이전트의 FE 단계에서만 로드된다.
> 프로젝트 시작 시 기술 스택에 맞게 내용을 채운다.

---

## 프레임워크 및 라이브러리

- **프레임워크**: (예: Next.js 14 / React 18 / Vue 3)
- **상태관리**: (예: Zustand / Pinia / Redux Toolkit)
- **스타일링**: (예: Tailwind CSS / CSS Modules / styled-components)
- **폼 처리**: (예: React Hook Form / Vee-Validate)
- **HTTP 클라이언트**: (예: Axios / Fetch API / TanStack Query)

---

## 컴포넌트 작성 원칙

- (예: 서버 컴포넌트 우선, 클라이언트 컴포넌트는 `"use client"` 명시)
- (예: Props 타입은 TypeScript interface로 정의)
- (예: 컴포넌트 파일명은 PascalCase)

---

## 폴더 구조 컨벤션

```
/frontend
  ├── /components   # 재사용 컴포넌트
  ├── /pages (또는 /app)
  ├── /hooks
  ├── /stores
  └── /utils
```

---

## API 호출 패턴

(예: TanStack Query 사용 시 훅 패턴, Axios 인터셉터 설정 등)

---

## 디자인 시스템 사용 규칙

- 디자인 토큰은 `/vault/design-system-index.md` 참조
- 커스텀 값 직접 입력 금지 — 토큰 변수 사용
