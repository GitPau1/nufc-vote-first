# 10 — 콘텐츠 관리

MVP에서는 별도 관리자 UI 없이 Supabase Dashboard 또는 SQL로 직접 관리.

## 선수 등록

```sql
INSERT INTO players (name, position, squad_number, photo_url)
VALUES
  ('알렉산더 이세르 이사크', 'FWD', 14, 'https://...'),
  ('닉 포프', 'GK', 22, 'https://...'),
  ('에디 하우', 'MGR', null, 'https://...');
```

`photo_url` 은 Supabase Storage URL 또는 외부 URL 모두 가능.

## 투표 등록 — Type A (단일 선수 · 다수 평가)

```sql
-- 1. 투표 생성
INSERT INTO polls (type, title, description, player_id, status, closes_at)
VALUES (
  'evaluation',
  '알렉산더 이사크, 어떻게 해야 할까?',
  '이번 시즌 이사크의 활약을 평가하고 다음 시즌 방향을 선택해주세요.',
  '[player_id]',
  'active',
  '2026-06-30 23:59:59+09'
);

-- 2. 선택지 등록
INSERT INTO poll_options (poll_id, label, display_order)
VALUES
  ('[poll_id]', '재계약', 1),
  ('[poll_id]', '보류',   2),
  ('[poll_id]', '방출',   3);
```

## 투표 등록 — Type B (단일 주제 · 다수 선수)

```sql
-- 1. 투표 생성 (player_id 없음)
INSERT INTO polls (type, title, description, status, closes_at)
VALUES (
  'selection',
  '2024-25 시즌 MVP는?',
  '이번 시즌 가장 인상적이었던 선수를 선택해주세요.',
  'active',
  '2026-06-30 23:59:59+09'
);

-- 2. 선택지 등록 (각 옵션에 선수 연결)
INSERT INTO poll_options (poll_id, label, player_id, display_order)
VALUES
  ('[poll_id]', '알렉산더 이사크',   '[player_id_1]', 1),
  ('[poll_id]', '브루노 기마랑이스', '[player_id_2]', 2),
  ('[poll_id]', '키에란 트리피어',   '[player_id_3]', 3);
```

## 예정 투표 등록

```sql
INSERT INTO polls (type, title, description, player_id, status, scheduled_at, closes_at)
VALUES (
  'evaluation',
  '다음 주 공개될 투표 제목',
  '투표 설명',
  '[player_id]',
  'scheduled',
  '2026-06-01 18:00:00+09',   -- 공개 시간
  '2026-06-07 23:59:59+09'    -- 마감 시간
);
```

## 투표 수동 마감

```sql
UPDATE polls SET status = 'closed' WHERE id = '[poll_id]';
```
