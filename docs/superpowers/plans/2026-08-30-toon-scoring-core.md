# 툰 예산제 1단계 — 스코어링 코어 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승부예측 점수 산식을 "배당×평점" → "포지션 후보 평점 순위 차등(1위4/2위2/3위1) + 스코어 8/5"로 바꾼다. DB view 재작성만으로 과거 경기까지 자동 재채점된다.

**Architecture:** 점수는 저장하지 않고 `prediction_results` view가 파생 계산한다(리포 기존 원칙). 픽 점수는 `fixture_player_ratings`를 `season_squads`(현재 시즌) 포지션별로 `rank()` 윈도우로 줄 세워 순위를 내고, 순위→점수로 매핑한다. 컬럼명(`def_points/mid_points/fwd_points/pick_points/total_points`)과 주차 정산 게이트를 그대로 유지해 리더보드·프론트는 손대지 않는다.

**Tech Stack:** Postgres (Supabase migrations), `supabase` CLI. 이 리포엔 SQL 자동 테스트 하베스(pgTAP 등)가 없어, 검증은 로컬 Supabase에 시드 후 쿼리로 확인한다.

**범위 밖 (후속 계획):** 툰 비용 컬럼/예산 검증(Plan 2), UI 비용·순위 표시(Plan 3), 월별 비용 산정 잡(Plan 4). 이 계획은 **submit.ts와 predictions 테이블을 건드리지 않는다** — 순수 스코어링 변경이라 독립적으로 배포·검증된다.

**설계 근거:** `docs/superpowers/specs/2026-08-30-toon-budget-prediction-design.md`

---

## 사전 확인 (근거)

- 현재 `prediction_results` 정의: `supabase/migrations/20260824120000_prediction_results_week_settled.sql:21-66` (주차 정산 게이트 포함, 이게 살아있는 최신본).
- 현재 산식 함수: `supabase/migrations/20260821120000_create_predictions.sql` — `prediction_match_points`(`:99-108`, 3/2), `prediction_pick_points(numeric,numeric)`(`:112-116`, 평점≥7 → 배당×2.4).
- 리더보드는 `prediction_results`의 `total_points/match_points/pick_points`만 소비(`20260827130000_fix_leaderboards_public_profiles.sql`) → 컬럼 유지하면 무변경.
- 후보 풀 매핑: `fixtures`에 시즌 컬럼 없음 → 앱 관례대로 `seasons.is_current`로 현재 시즌 스쿼드를 후보 풀로 본다(`frontend/src/lib/queries/squads.ts:69-82`와 동일 기준).
- `rank()` 윈도우 = 표준 경쟁 순위(1-2-2-4). 설계에서 정한 동점 규칙과 일치.
- 결과 화면 순수 함수 `matchHit`은 점수 숫자가 아니라 등급('exact'/'outcome'/'miss')만 반환(`frontend/src/lib/predictions/result.ts:32-44`) → 8/5 변경은 SQL 단독. `result.test.mjs`는 등급만 단정하므로 안 깨진다.

---

## Task 1: 스코어링 마이그레이션 작성

**Files:**
- Create: `supabase/migrations/20260830120000_toon_rank_scoring.sql`
  (파일명 타임스탬프는 현재 최신 `20260827140000`보다 뒤여야 한다. 그 사이 더 최신 마이그레이션이 생겼다면 그보다 뒤 시각으로 조정.)

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/20260830120000_toon_rank_scoring.sql`:

```sql
-- 승부예측 점수 산식 재설계 (툰 예산제 1단계: 스코어링 코어)
-- 변경 1: 스코어 배점 3/2 → 8/5
-- 변경 2: 픽 점수 = 배당×평점 → 포지션 후보 평점 순위 차등(1위4/2위2/3위1, 표준 경쟁 순위)
-- 설계: docs/superpowers/specs/2026-08-30-toon-budget-prediction-design.md
--
-- 점수는 저장하지 않고 view로 파생한다(기존 원칙) → 이 마이그레이션 적용 즉시 과거 경기도
-- 새 산식으로 재채점된다(설계 3.4 "전환 시 1회 재채점").
-- 후보 풀은 seasons.is_current 시즌의 season_squads(DEF/MID/FWD). fixtures엔 시즌 링크가 없어
-- 앱 관례(queries/squads.ts)와 같은 is_current 기준을 쓴다.

-- ── 스코어 배점 상향: 정확 3→8, 승무패 2→5 ──────────────────────────
create or replace function public.prediction_match_points(
  pred_home smallint, pred_away smallint, actual_home smallint, actual_away smallint
) returns integer language sql immutable as $$
  select case
    when actual_home is null or actual_away is null then 0
    when pred_home = actual_home and pred_away = actual_away then 8           -- 스코어 정확
    when sign(pred_home - pred_away) = sign(actual_home - actual_away) then 5 -- 승/무/패만 적중
    else 0
  end;
$$;

-- ── 순위 → 점수 (새 bigint 오버로드) ──────────────────────────────
-- pos_rank 인자는 bigint다 — rank() 윈도우가 bigint를 반환하기 때문(int는 자동 확장돼 들어옴).
-- 옛 (numeric,numeric) 오버로드와 잠시 공존한다(아래에서 view 교체 후 drop).
create or replace function public.prediction_pick_points(pos_rank bigint)
returns integer language sql immutable as $$
  select case pos_rank when 1 then 4 when 2 then 2 when 3 then 1 else 0 end;
$$;

comment on function public.prediction_pick_points(bigint) is
  '포지션 후보 평점 순위(표준 경쟁 순위 rank, bigint) → 점수. 1위4/2위2/3위1/그외·미출전 0.';

-- ── 결과 view 재작성: 픽 점수만 순위 기반으로, 컬럼·정산 게이트는 그대로 ──
create or replace view public.prediction_results
with (security_invoker = true) as
with current_season as (
  select id from public.seasons where is_current limit 1
),
ranked as (
  -- 그 경기에 평점이 매겨진 현재-시즌 후보를 포지션별로 평점 내림차순 rank().
  -- 평점 없는(미출전) 선수는 여기 없으므로 아래 left join에서 pos_rank=null → 0점.
  select
    fpr.fixture_id,
    fpr.player_id,
    s.position,
    fpr.rating,
    rank() over (
      partition by fpr.fixture_id, s.position
      order by fpr.rating desc
    ) as pos_rank
  from public.fixture_player_ratings fpr
  join public.season_squads s
    on s.fotmob_player_id = fpr.player_id
   and s.season_id = (select id from current_season)
  where s.position in ('DEF','MID','FWD')
)
select
  p.id,
  p.user_id,
  p.fixture_id,
  f.kickoff_at,
  f.competition_name,
  p.home_score as pred_home,
  p.away_score as pred_away,
  f.home_score as actual_home,
  f.away_score as actual_away,
  p.def_player_id, p.mid_player_id, p.fwd_player_id,
  rd.rating as def_rating,
  rm.rating as mid_rating,
  rf.rating as fwd_rating,
  public.prediction_match_points(p.home_score, p.away_score, f.home_score, f.away_score) as match_points,
  public.prediction_pick_points(rd.pos_rank) as def_points,
  public.prediction_pick_points(rm.pos_rank) as mid_points,
  public.prediction_pick_points(rf.pos_rank) as fwd_points,
  public.prediction_pick_points(rd.pos_rank)
    + public.prediction_pick_points(rm.pos_rank)
    + public.prediction_pick_points(rf.pos_rank) as pick_points,
  public.prediction_match_points(p.home_score, p.away_score, f.home_score, f.away_score)
    + public.prediction_pick_points(rd.pos_rank)
    + public.prediction_pick_points(rm.pos_rank)
    + public.prediction_pick_points(rf.pos_rank) as total_points
from public.predictions p
join public.fixtures f on f.fixture_id = p.fixture_id
left join ranked rd on rd.fixture_id = p.fixture_id and rd.player_id = p.def_player_id and rd.position = 'DEF'
left join ranked rm on rm.fixture_id = p.fixture_id and rm.player_id = p.mid_player_id and rm.position = 'MID'
left join ranked rf on rf.fixture_id = p.fixture_id and rf.player_id = p.fwd_player_id and rf.position = 'FWD'
where f.finished
  -- 그 주차에 아직 안 끝난 경기가 하나라도 있으면 이 행은 안 나온다(정산 게이트, 원본과 동일).
  and not exists (
    select 1
    from public.fixtures f2
    where f2.cancelled  = false
      and f2.finished   = false
      and f2.kickoff_at is not null
      and date_trunc('week', f2.kickoff_at at time zone 'Asia/Seoul')
        = date_trunc('week', f.kickoff_at  at time zone 'Asia/Seoul')
  );

-- ── 옛 배당 기반 픽 점수 함수 제거 (view가 더는 참조 안 함) ──────────
drop function if exists public.prediction_pick_points(numeric, numeric);

comment on view public.prediction_results is
  '정산이 끝난 주차의 예측 + 계산된 점수. 픽 점수는 그 경기·포지션 후보(현재 시즌 스쿼드)를 '
  '평점으로 줄 세운 순위 차등(1위4/2위2/3위1, 표준 경쟁 순위). 미출전(평점 없음)=0점. '
  '스코어 점수는 정확 8 / 승무패 5.';
```

- [ ] **Step 2: SQL 문법 정적 점검**

Run: `grep -c "prediction_pick_points(rd.pos_rank)" supabase/migrations/20260830120000_toon_rank_scoring.sql`
Expected: `3` (def_points 1 + pick_points 합산 1 + total_points 합산 1). 파일이 생성됐고 순위 기반 호출이 들어갔는지 확인용.

---

## Task 2: 롤백 SQL 작성 (리포 컨벤션)

**Files:**
- Create: `supabase/rollback/revert_toon_rank_scoring.sql`

리포는 긴급 원복용 SQL을 `supabase/rollback/`에 **migrations 밖**으로 격리한다(자동 적용 방지, `supabase/rollback/README.md`). 이 파일은 옛 산식(3/2, 배당×2.4)과 옛 view를 복원한다.

- [ ] **Step 1: 롤백 파일 작성**

`supabase/rollback/revert_toon_rank_scoring.sql`:

```sql
-- 원복: 20260830120000_toon_rank_scoring.sql 을 되돌린다.
-- 수동 실행 전용(migrations 밖). 순위 차등 → 배당×평점, 스코어 8/5 → 3/2 복원.

-- 스코어 배점 복원 3/2
create or replace function public.prediction_match_points(
  pred_home smallint, pred_away smallint, actual_home smallint, actual_away smallint
) returns integer language sql immutable as $$
  select case
    when actual_home is null or actual_away is null then 0
    when pred_home = actual_home and pred_away = actual_away then 3
    when sign(pred_home - pred_away) = sign(actual_home - actual_away) then 2
    else 0
  end;
$$;

-- 옛 배당 기반 함수 복원 (평점≥7 → 배당×2.4)
create or replace function public.prediction_pick_points(
  rating numeric, multiplier numeric
) returns integer language sql immutable as $$
  select case when rating >= 7 then round(multiplier * 2.4)::integer else 0 end;
$$;

-- 옛 view 복원 (20260824120000 정산본과 동일)
create or replace view public.prediction_results
with (security_invoker = true) as
select
  p.id, p.user_id, p.fixture_id, f.kickoff_at, f.competition_name,
  p.home_score as pred_home, p.away_score as pred_away,
  f.home_score as actual_home, f.away_score as actual_away,
  p.def_player_id, p.mid_player_id, p.fwd_player_id,
  rd.rating as def_rating, rm.rating as mid_rating, rf.rating as fwd_rating,
  public.prediction_match_points(p.home_score, p.away_score, f.home_score, f.away_score) as match_points,
  public.prediction_pick_points(coalesce(rd.rating, 0), p.def_multiplier) as def_points,
  public.prediction_pick_points(coalesce(rm.rating, 0), p.mid_multiplier) as mid_points,
  public.prediction_pick_points(coalesce(rf.rating, 0), p.fwd_multiplier) as fwd_points,
  public.prediction_pick_points(coalesce(rd.rating, 0), p.def_multiplier)
    + public.prediction_pick_points(coalesce(rm.rating, 0), p.mid_multiplier)
    + public.prediction_pick_points(coalesce(rf.rating, 0), p.fwd_multiplier) as pick_points,
  public.prediction_match_points(p.home_score, p.away_score, f.home_score, f.away_score)
    + public.prediction_pick_points(coalesce(rd.rating, 0), p.def_multiplier)
    + public.prediction_pick_points(coalesce(rm.rating, 0), p.mid_multiplier)
    + public.prediction_pick_points(coalesce(rf.rating, 0), p.fwd_multiplier) as total_points
from public.predictions p
join public.fixtures f on f.fixture_id = p.fixture_id
left join public.fixture_player_ratings rd on rd.fixture_id = p.fixture_id and rd.player_id = p.def_player_id
left join public.fixture_player_ratings rm on rm.fixture_id = p.fixture_id and rm.player_id = p.mid_player_id
left join public.fixture_player_ratings rf on rf.fixture_id = p.fixture_id and rf.player_id = p.fwd_player_id
where f.finished
  and not exists (
    select 1 from public.fixtures f2
    where f2.cancelled = false and f2.finished = false and f2.kickoff_at is not null
      and date_trunc('week', f2.kickoff_at at time zone 'Asia/Seoul')
        = date_trunc('week', f.kickoff_at  at time zone 'Asia/Seoul')
  );

-- 새 bigint 오버로드 제거
drop function if exists public.prediction_pick_points(bigint);
```

- [ ] **Step 2: 존재 확인**

Run: `ls supabase/rollback/revert_toon_rank_scoring.sql`
Expected: 경로가 출력됨(파일 생성 확인).

---

## Task 3: 로컬 DB에 적용 후 시드 검증

이 리포엔 SQL 단위 테스트가 없다. 로컬 Supabase에 마이그레이션을 적용하고 알려진 시드로 점수를 눈으로 확인한다. (로컬 Docker/Supabase가 없으면 dev용 linked 프로젝트에 적용해 같은 쿼리로 확인.)

**Files:**
- Create (임시, 커밋 안 함): `scratchpad/verify-toon-scoring.sql`

- [ ] **Step 1: 로컬 DB에 마이그레이션 적용**

Run: `supabase db reset`
Expected: 모든 마이그레이션이 에러 없이 적용됨(마지막에 새 `20260830120000_toon_rank_scoring.sql` 포함). "cannot change name of view column" 류 에러가 나면 컬럼 순서/이름이 원본과 어긋난 것 → Task 1 SELECT 목록을 원본과 대조.

- [ ] **Step 2: 검증 시드 스크립트 작성**

`scratchpad/verify-toon-scoring.sql` — 트랜잭션 안에서 시드 후 조회하고 ROLLBACK(데이터 오염 없음):

```sql
begin;

-- 현재 시즌 하나 보장 (있으면 그걸 쓰고, 없으면 생성)
insert into public.seasons (id, name, is_current)
values ('00000000-0000-0000-0000-0000000000aa', 'TEST 2025/2026', true)
on conflict do nothing;

-- DEF 후보 3명 (배당은 이제 점수와 무관, not null 기본 1.0 충족용으로만)
insert into public.season_squads (season_id, fotmob_player_id, name, position, prediction_multiplier)
values
  ('00000000-0000-0000-0000-0000000000aa', 9001, 'DefA', 'DEF', 1.0),
  ('00000000-0000-0000-0000-0000000000aa', 9002, 'DefB', 'DEF', 1.0),
  ('00000000-0000-0000-0000-0000000000aa', 9003, 'DefC', 'DEF', 1.0),
  ('00000000-0000-0000-0000-0000000000aa', 9101, 'MidA', 'MID', 1.0),
  ('00000000-0000-0000-0000-0000000000aa', 9201, 'FwdA', 'FWD', 1.0)
on conflict do nothing;

-- 종료된 경기 1개(그 주 다른 미종료 경기 없음 → 정산 게이트 통과)
insert into public.fixtures (fixture_id, competition_name, kickoff_at, home_id, home_name,
  away_id, away_name, home_score, away_score, started, finished, cancelled)
values (770001, 'Test Cup', now() - interval '2 days', 1, 'Newcastle',
  2, 'Rival', 2, 1, true, true, false)
on conflict do nothing;

-- 평점: DefB 7.9(1위) > DefA 7.1(2위) > DefC 6.0(3위), MidA 8.0, FwdA 5.0
insert into public.fixture_player_ratings (fixture_id, player_id, rating) values
  (770001, 9001, 7.1), (770001, 9002, 7.9), (770001, 9003, 6.0),
  (770001, 9101, 8.0), (770001, 9201, 5.0)
on conflict do nothing;

-- 예측: DEF=DefB(1위), MID=MidA(1위), FWD=FwdA(1위). 스코어 2:1 정확.
-- user_id 는 로컬에 존재하는 아무 users.id 로 교체할 것(아래는 예시 UUID).
insert into public.predictions (user_id, fixture_id, home_score, away_score,
  def_player_id, mid_player_id, fwd_player_id, def_multiplier, mid_multiplier, fwd_multiplier)
values ((select id from public.users limit 1), 770001, 2, 1, 9002, 9101, 9201, 1.0, 1.0, 1.0);

-- 기대: def_points 4(1위), mid_points 4(1위), fwd_points 4(1위) → pick_points 12,
--       match_points 8(스코어 정확) → total_points 20.
select def_points, mid_points, fwd_points, pick_points, match_points, total_points
from public.prediction_results where fixture_id = 770001;

rollback;
```

- [ ] **Step 3: 검증 실행**

Run: `supabase db reset >/dev/null 2>&1; psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -f scratchpad/verify-toon-scoring.sql`
(또는 로컬 DB URL로 직접 psql 실행.)
Expected 마지막 SELECT 출력:
```
 def_points | mid_points | fwd_points | pick_points | match_points | total_points
------------+------------+------------+-------------+--------------+--------------
          4 |          4 |          4 |          12 |            8 |           20
```

- [ ] **Step 4: 2·3위 및 미출전 케이스 재확인**

`scratchpad/verify-toon-scoring.sql`에서 예측의 `def_player_id`를 9001(DefA=2위)로 바꿔 재실행 → `def_points = 2`. 9003(DefC=3위)로 바꾸면 `def_points = 1`. 평점 행이 없는 임의 후보(예: 새 DEF 9004를 season_squads엔 넣되 fixture_player_ratings엔 안 넣음)로 바꾸면 `def_points = 0`.
Expected: 각각 2, 1, 0.

---

## Task 4: 결과 화면 주석 정합 (로직 무변경) + 테스트

`result.ts`의 주석이 옛 산식(3점/2점, 픽 점수 기준 7.0)을 설명하고 있어 오해를 준다. 로직은 안 바꾸고 주석만 새 산식에 맞춘다. 순수 함수 동작은 그대로라 기존 테스트는 통과해야 한다.

**Files:**
- Modify: `frontend/src/lib/predictions/result.ts:12-14`, `:22`, `:26-28`

- [ ] **Step 1: ratingTier 주석 갱신**

`frontend/src/lib/predictions/result.ts:12-14`의 주석을 교체:

```ts
/**
 * 평점 배지 색만 정한다(퍼블리싱 3단계). 픽 점수는 더 이상 평점 임계값이 아니라
 * 포지션 후보 순위로 매겨지므로(prediction_results view), 이 7.0/6.0 경계는 표시 전용이다.
 */
```

- [ ] **Step 2: matchHit 주석의 점수 갱신 3/2 → 8/5**

`frontend/src/lib/predictions/result.ts:26-28`의 주석을 교체:

```ts
/**
 * DB `prediction_match_points`(20260830120000_toon_rank_scoring.sql)와 같은 기준이다:
 * 스코어까지 정확하면 8점(exact), 승/무/패만 맞으면 5점(outcome), 아니면 0점(miss).
 * 한쪽 기준만 바꾸면 화면 배지와 실제 점수가 어긋나니 둘을 같이 고칠 것.
```

- [ ] **Step 3: 테스트 코멘트 정합 (선택, 단정문 아님)**

`frontend/src/lib/predictions/result.test.mjs:99-102`의 `// ... (3점)` / `// ... (2점)` 주석을 `(8점)` / `(5점)`으로 바꾼다. 단정문은 등급 문자열이라 그대로 통과한다.

- [ ] **Step 4: 전체 테스트 실행**

Run: `cd frontend && npm test`
Expected: 전부 통과(현재 94개). 특히 `result.test.mjs`가 깨지지 않아야 한다 — 깨지면 로직을 잘못 건드린 것.

---

## Task 5: 커밋

- [ ] **Step 1: 변경 커밋**

```bash
git add supabase/migrations/20260830120000_toon_rank_scoring.sql \
        supabase/rollback/revert_toon_rank_scoring.sql \
        frontend/src/lib/predictions/result.ts \
        frontend/src/lib/predictions/result.test.mjs
git commit -m "$(cat <<'EOF'
feat: 승부예측 점수 순위 차등제로 재작성 (툰 1단계)

- 픽 점수: 배당×평점 → 포지션 후보 평점 순위 차등(1위4/2위2/3위1, 표준 경쟁 순위 rank)
- 스코어 배점: 정확 3→8, 승무패 2→5
- prediction_results view가 파생 계산이라 과거 경기도 자동 재채점
- 컬럼명·주차 정산 게이트 유지 → 리더보드/프론트 무변경
- 옛 prediction_pick_points(numeric,numeric) 제거, 롤백 SQL 격리 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: DB 반영 (배포 시점에)**

로컬 검증이 끝나면 실제 반영은: `supabase db push` (사전 `supabase link` 필요). 문제 시 `supabase/rollback/revert_toon_rank_scoring.sql`을 수동 실행.

---

## 자체 검토 체크리스트 (작성자 확인 완료)

- **스펙 커버리지**: 순위 차등 4/2/1(Task 1 view) ✓, 표준 경쟁 순위=`rank()` ✓, 스코어 8/5(Task 1 함수) ✓, 과거 재채점=view 파생 ✓, 후보 풀=season_squads/is_current ✓, 미출전 0점=pos_rank null ✓.
- **플레이스홀더 스캔**: 없음. 모든 SQL/주석 완성형.
- **타입 정합**: view 출력 컬럼명·타입·순서 원본과 동일 → 리더보드/프론트 쿼리(`RESULT_COLUMNS`, `week_leaderboard`) 무변경. `prediction_pick_points`는 integer 오버로드 신설 후 numeric 오버로드 drop(view 교체 뒤라 의존성 없음).
- **이 계획이 안 건드리는 것**: `submit.ts`, `predictions` 테이블 스키마, `season_squads` 스키마 → Plan 2에서.
