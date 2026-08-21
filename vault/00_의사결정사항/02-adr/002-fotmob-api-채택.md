---
type: adr
id: 002
status: accepted
date: 2026-08-20
tags: [백엔드, api, 데이터연동, fotmob]
related_feature: []
---

# 002: 경기/선수 평점 데이터 소스로 fotmob 비공식 API 채택

## Status
Accepted

## Context
선수별 평점(rating) 데이터 소스로 sofascore를 검토했으나, 브라우저에서는 데이터를 가져올 수 있는 반면 브라우저 외 방법(Supabase)으로 호출하면 오류가 발생해 현재의 Supabase 기반 백엔드에서는 사용이 불가능한 것으로 확인됨.

검토한 대안:
1. API-football — 로그인 후 API 키 필요, 무료 플랜 일 100회 호출 제한. 테스트 필요.
2. Vercel Node.js 서버에서 직접 띄우기 — Vercel 무료 용량 초과 가능성 높음.
3. fotmob 비공식 API — 비공식이라 언제 바뀔지 모른다는 단점이 있으나, Supabase에서 작동 확인 완료.

## Decision
대안 3(fotmob 비공식 API)을 채택하고 API 개발을 진행한다.

## Consequences
- 비공식 API이므로 fotmob 쪽에서 스펙이 예고 없이 바뀌면 연동이 깨질 수 있음.
- API 개발 과정에서 추가로 필요한 데이터 항목을 확인해야 함 (회의록 시점 기준 미확정 — 확인 필요).
- API-football, 자체 Node.js 서버 방식은 현재 기각되었으나, fotmob API 연동이 깨질 경우 재검토 대상.

## Related
- 회의록: [[../회의록/2026-08-20]]
