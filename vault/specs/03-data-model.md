# 03 — 데이터 모델

## 테이블 정의

```sql
-- 사용자 (Supabase Auth 연동)
CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email        text NOT NULL,
  avatar_url   text,
  display_name text,
  created_at   timestamptz DEFAULT now(),
  deleted_at   timestamptz        -- 탈퇴 소프트 딜리트
);

-- 선수 / 감독
CREATE TABLE players (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  position     text,              -- 'GK' | 'DEF' | 'MID' | 'FWD' | 'MGR'
  squad_number int,
  photo_url    text,              -- Supabase Storage URL 또는 외부 URL
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- 투표
CREATE TABLE polls (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL,     -- 'evaluation' | 'selection'
  title        text NOT NULL,
  description  text,
  player_id    uuid REFERENCES players(id),  -- Type A 전용 (단일 선수)
  status       text NOT NULL DEFAULT 'active', -- 'scheduled' | 'active' | 'closed'
  scheduled_at timestamptz,       -- null이면 즉시 공개
  closes_at    timestamptz NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- 투표 선택지
CREATE TABLE poll_options (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id       uuid NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label         text NOT NULL,    -- '재계약', '보류', '방출' 또는 선수 이름
  player_id     uuid REFERENCES players(id),  -- Type B 전용 (선수 연결)
  display_order int NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- 투표 참여 기록
CREATE TABLE votes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    uuid NOT NULL REFERENCES polls(id),
  user_id    uuid NOT NULL REFERENCES users(id),
  option_id  uuid NOT NULL REFERENCES poll_options(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(poll_id, user_id)        -- 중복 투표 DB 레벨 차단
);

-- 댓글
CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    uuid NOT NULL REFERENCES polls(id),
  user_id    uuid NOT NULL REFERENCES users(id),
  content    text NOT NULL CHECK (char_length(content) <= 500),
  is_hidden  boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 댓글 좋아요
CREATE TABLE comment_likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)     -- 중복 좋아요 DB 레벨 차단
);
```

## 테이블 관계

```
polls ──(1:N)──> poll_options
polls ──(1:N)──> votes
polls ──(1:N)──> comments
polls ──(N:1)──> players          (Type A: 단일 선수)
poll_options ──(N:1)──> players   (Type B: 옵션별 선수)
comments ──(1:N)──> comment_likes
```

## RLS 정책 요약

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| players | 전체 공개 | 관리자만 | 관리자만 | 관리자만 |
| polls | 전체 공개 | 관리자만 | 관리자만 | 관리자만 |
| poll_options | 전체 공개 | 관리자만 | 관리자만 | 관리자만 |
| votes | 본인 것만 | 로그인 사용자 | ❌ | ❌ |
| comments | 전체 공개 (is_hidden=false) | 로그인 + 투표 완료 | ❌ | ❌ |
| comment_likes | 전체 공개 | 로그인 사용자 | ❌ | 본인 것만 |
