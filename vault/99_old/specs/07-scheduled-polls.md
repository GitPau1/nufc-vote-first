# 07 — 예정 투표 & 마감 처리

## 예정 투표 (status = 'scheduled')

### 조건
`polls.status = 'scheduled'` AND `polls.scheduled_at > now()`

### 목록 카드 UI
- 카드 전체 blur (`backdrop-filter: blur(8px)`)
- 잠금 아이콘 오버레이
- 투표 제목 표시
- 카운트다운 타이머 (클라이언트 사이드 실시간 업데이트)
  - 1일 이상: "D-N"
  - 1일 미만: "HH:MM:SS"
- 클릭 불가 (`pointer-events: none`)

### 자동 공개 처리
`scheduled_at` 도달 시 `status = 'active'` 로 자동 전환.

```sql
-- Supabase Edge Function + pg_cron (매 분 실행)
UPDATE polls
SET status = 'active'
WHERE status = 'scheduled'
  AND scheduled_at <= now();
```

---

## 투표 마감 (status = 'closed')

### 조건
`polls.closes_at <= now()`

### 자동 마감 처리

```sql
-- Supabase Edge Function + pg_cron (매 분 실행)
UPDATE polls
SET status = 'closed'
WHERE status = 'active'
  AND closes_at <= now();
```

### 마감된 투표 UI
- 목록 카드: "투표 종료" 뱃지
- 상세 페이지: 투표 UI 없음, 결과 화면만 표시
- 미참여자도 결과 열람 가능
