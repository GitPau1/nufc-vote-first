# 툰 예산제 4단계 — 월별 비용 자동 산정 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매달 `season_squads.pick_cost`(툰 가격)를 **직전 30일 평균 평점 순위**로 자동 재산정한다. 포지션별 순위 상한: 1위 → 3툰, 2~3위 → 2툰, 4위 이하 → 1툰. **최근 평점이 없는 선수(부상·로테이션 등)는 건드리지 않고 직전 가격을 유지한다** — "부상 판별" 로직은 두지 않고, "새 데이터 없으면 가격 유지"로 자동 처리한다.

**Architecture:** 순수 SQL 함수 `recompute_pick_costs()`가 현재 시즌(is_current) DEF/MID/FWD 후보 중 **최근 30일 평점이 있는 선수만** 포지션별로 줄 세워 `pick_cost`를 갱신한다. 평점 없는 선수는 UPDATE 대상에서 빠져 기존 값을 유지한다. pg_cron으로 매달 1회 자동 실행(리포에 이미 pg_cron 주간 잡 선례가 있다). 마이그레이션 시 1회 즉시 실행해 초기값을 채운다.

**Tech Stack:** Postgres(pg_cron 확장, plpgsql 함수). 앱 코드 변경 없음.

**전제:** 2단계(`season_squads.pick_cost` 컬럼) 커밋 완료. 1단계 평점(`fixture_player_ratings`) 사용.

**설계 근거:** `docs/superpowers/specs/2026-08-30-toon-budget-prediction-design.md` §3.1(월별 비용 배정 규칙, 티어 상한).

**범위 밖:** 관리자 수동 재산정 버튼(선택 — 아래 "후속 옵션"). 이 단계는 자동 잡 + 함수까지.

---

## 사전 확인 (근거)

- pg_cron 선례: `supabase/migrations/20260617130000_add_player_pick_one_weekly_ratings.sql:267-282` — `create extension if not exists pg_cron;` → `DO $$ ... cron.unschedule(...) ...$$;`(idempotent) → `cron.schedule('name','0 15 * * 6', $$SELECT public.fn(now());$$)`.
- `pick_cost` 컬럼: `season_squads`(2단계 `20260830130000_toon_pick_cost.sql`), `smallint check (pick_cost between 1 and 3)`.
- 후보/평점: `fixture_player_ratings(fixture_id, player_id, rating)`, `fixtures(fixture_id, finished, kickoff_at)`, `season_squads(season_id, fotmob_player_id, position)`, `seasons(is_current)`.
- 현재 시즌만 대상(앱 관례, `queries/squads.ts`의 is_current). GK는 픽 대상이 아니라 갱신 제외.
- 티어 상한을 보장하려면 **row_number()**를 쓴다(rank()는 동점 시 1위가 둘이 되어 "3툰 최대 1명"이 깨진다). 동점은 fotmob_player_id로 결정적 tiebreak.

---

## Task 1: 비용 재산정 함수 + pg_cron 스케줄 마이그레이션

**Files:**
- Create: `supabase/migrations/20260830140000_toon_monthly_cost.sql`
  (2단계 `20260830130000`보다 뒤 타임스탬프. 더 최신 마이그레이션이 있으면 그 뒤로 조정.)

- [ ] **Step 1: 마이그레이션 작성**

`supabase/migrations/20260830140000_toon_monthly_cost.sql`:

```sql
-- 툰 예산제 4단계: 월별 비용(pick_cost) 자동 재산정.
-- 설계: docs/superpowers/specs/2026-08-30-toon-budget-prediction-design.md §3.1
-- 현재 시즌 DEF/MID/FWD 후보 중 최근 30일 평점이 있는 선수만 순위로 티어 배정:
--   1위 → 3툰, 2~3위 → 2툰, 4위 이하 → 1툰. 상한 보장 위해 row_number() 사용.
-- 최근 평점이 없는 선수(부상·로테이션 등)는 UPDATE에서 빠져 직전 가격을 유지한다.

create or replace function public.recompute_pick_costs()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season uuid;
begin
  select id into v_season from public.seasons where is_current limit 1;
  if v_season is null then
    return;  -- 현재 시즌이 없으면 갱신할 대상이 없다.
  end if;

  with recent as (
    -- 직전 30일 종료 경기의 평점만
    select fpr.player_id, fpr.rating
    from public.fixture_player_ratings fpr
    join public.fixtures f on f.fixture_id = fpr.fixture_id
    where f.finished
      and f.kickoff_at >= now() - interval '30 days'
  ),
  avg_rating as (
    -- INNER JOIN: 최근 평점이 있는 선수만. 평점 없는 선수는 여기서 빠져 아래 UPDATE 대상이 아니다
    -- → 직전 pick_cost 유지(부상·로테이션 자동 처리, "부상 판별" 로직 불필요).
    select s.fotmob_player_id, s.position, avg(r.rating) as avg_rating
    from public.season_squads s
    join recent r on r.player_id = s.fotmob_player_id
    where s.season_id = v_season
      and s.position in ('DEF','MID','FWD')
    group by s.fotmob_player_id, s.position
  ),
  ranked as (
    -- 평점 높은 순. 동점은 fotmob_player_id로 결정적 tiebreak(상한 보장 위해 row_number).
    select fotmob_player_id, position,
      row_number() over (
        partition by position
        order by avg_rating desc, fotmob_player_id
      ) as pos_rank
    from avg_rating
  )
  update public.season_squads s
  set pick_cost = case
        when rk.pos_rank = 1 then 3
        when rk.pos_rank <= 3 then 2
        else 1
      end
  from ranked rk
  where s.season_id = v_season
    and s.fotmob_player_id = rk.fotmob_player_id
    and s.position = rk.position;
end;
$$;

comment on function public.recompute_pick_costs() is
  '현재 시즌 DEF/MID/FWD 후보 중 최근 30일 평점이 있는 선수의 pick_cost(툰)를 평균 평점 순위로 재산정. '
  '1위 3툰 / 2~3위 2툰 / 4위 이하 1툰(row_number 기준). 평점 없는 선수는 직전 가격 유지. pg_cron 월간 실행.';

-- pg_cron 월간 스케줄 (매달 1일 15:00 UTC ≈ KST 익일 자정 부근 — 주간 잡의 15 UTC 관례와 맞춤)
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('recompute-pick-costs-monthly');
exception
  when others then null;  -- 아직 없으면 무시(idempotent 재적용)
end;
$$;

select cron.schedule(
  'recompute-pick-costs-monthly',
  '0 15 1 * *',
  $$select public.recompute_pick_costs();$$
);

-- 마이그레이션 시 1회 즉시 실행 → 초기 pick_cost를 다음 달 안 기다리고 채운다.
select public.recompute_pick_costs();
```

- [ ] **Step 2: 정적 점검**

Run: `grep -cE "row_number\(\)|cron.schedule|recompute_pick_costs" supabase/migrations/20260830140000_toon_monthly_cost.sql`
Expected: `5` 이상 (함수 정의/주석/스케줄/즉시실행 등에서 이름이 여러 번 등장).

---

## Task 2: 롤백 SQL

**Files:**
- Create: `supabase/rollback/revert_toon_monthly_cost.sql`

- [ ] **Step 1: 롤백 파일 작성**

`supabase/rollback/revert_toon_monthly_cost.sql`:

```sql
-- 원복: 20260830140000_toon_monthly_cost.sql. 수동 실행 전용(migrations 밖).
-- 스케줄 해제 + 함수 제거. pick_cost 값 자체는 유지(2단계 기본 2로 되돌리려면 별도 update).
do $$
begin
  perform cron.unschedule('recompute-pick-costs-monthly');
exception
  when others then null;
end;
$$;

drop function if exists public.recompute_pick_costs();
```

- [ ] **Step 2: 존재 확인**

Run: `ls supabase/rollback/revert_toon_monthly_cost.sql`
Expected: 경로 출력.

---

## Task 3: 로컬 DB 검증 (시드)

SQL 자동 테스트 하베스가 없으므로 로컬 Supabase(Docker)나 dev DB에 적용해 확인한다.

**Files:**
- Create (임시, 커밋 안 함): `scratchpad/verify-monthly-cost.sql`

- [ ] **Step 1: 검증 스크립트 작성**

`scratchpad/verify-monthly-cost.sql`:

```sql
begin;

insert into public.seasons (id, name, is_current)
values ('00000000-0000-0000-0000-0000000000bb', 'TEST 25/26', true)
on conflict do nothing;

-- DEF 4명 (평점 있음) + 부상 1명(평점 없음, 직전 3툰). 평점 있는 선수만 재산정된다.
insert into public.season_squads (season_id, fotmob_player_id, name, position, prediction_multiplier, pick_cost)
values
  ('00000000-0000-0000-0000-0000000000bb', 8001, 'DefTop',  'DEF', 1.0, 2),
  ('00000000-0000-0000-0000-0000000000bb', 8002, 'DefMid1', 'DEF', 1.0, 2),
  ('00000000-0000-0000-0000-0000000000bb', 8003, 'DefMid2', 'DEF', 1.0, 2),
  ('00000000-0000-0000-0000-0000000000bb', 8004, 'DefLow',  'DEF', 1.0, 2),
  ('00000000-0000-0000-0000-0000000000bb', 8005, 'DefHurt', 'DEF', 1.0, 3)  -- 부상: 평점 없음, 직전 3툰 유지 기대
on conflict do nothing;

insert into public.fixtures (fixture_id, competition_name, kickoff_at, home_id, home_name,
  away_id, away_name, home_score, away_score, started, finished, cancelled)
values (880001, 'Test', now() - interval '5 days', 1, 'NUFC', 2, 'X', 1, 0, true, true, false)
on conflict do nothing;

-- DefTop 8.5 > DefMid1 7.0 = DefMid2 7.0 > DefLow 6.0
insert into public.fixture_player_ratings (fixture_id, player_id, rating) values
  (880001, 8001, 8.5), (880001, 8002, 7.0), (880001, 8003, 7.0), (880001, 8004, 6.0)
on conflict do nothing;

select public.recompute_pick_costs();

-- 기대: DefTop 3툰(1위), DefMid1/DefMid2 2툰(2·3위), DefLow 1툰(4위),
--       DefHurt 3툰(평점 없어 재산정 제외 → 직전 3툰 유지)
select name, pick_cost from public.season_squads
where season_id = '00000000-0000-0000-0000-0000000000bb' order by name;

rollback;
```

- [ ] **Step 2: 로컬 적용 + 실행**

Run: `supabase db reset >/dev/null 2>&1; psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" -f scratchpad/verify-monthly-cost.sql`
Expected 마지막 SELECT:
```
  name   | pick_cost
---------+-----------
 DefHurt |         3   ← 부상(평점 없음) → 직전 가격 유지
 DefLow  |         1
 DefMid1 |         2
 DefMid2 |         2
 DefTop  |         3
```
(동점 DefMid1/DefMid2는 row_number의 fotmob_player_id tiebreak로 2·3위 → 둘 다 2툰. DefHurt는 최근 평점이 없어 UPDATE 대상이 아니라 직전 3툰 그대로.)

---

## Task 4: 커밋

- [ ] **Step 1: 커밋**

```bash
git add supabase/migrations/20260830140000_toon_monthly_cost.sql \
        supabase/rollback/revert_toon_monthly_cost.sql
git commit -m "$(cat <<'EOF'
feat: 툰 가격 월별 자동 재산정 (툰 4단계)

- recompute_pick_costs(): 현재 시즌 DEF/MID/FWD를 직전 30일 평균 평점
  순위로 pick_cost 갱신. 1위 3툰/2~3위 2툰/4위+ 1툰(row_number로 상한 보장)
- pg_cron 월간 스케줄(매달 1일) + 마이그레이션 시 1회 즉시 실행
- 앱 코드 무변경. 롤백 SQL 격리 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 2: DB 반영(배포 시점)**

`supabase db push`. pg_cron 확장은 Supabase에서 대시보드 Extensions 또는 이 마이그레이션의 `create extension`으로 활성화된다. 문제 시 `supabase/rollback/revert_toon_monthly_cost.sql` 수동 실행.

---

## 후속 옵션 (이 계획 범위 밖, 필요 시)

- **관리자 수동 재산정 버튼**: 평점 입력 직후 즉시 반영하고 싶으면, `AdminSyncButton` 패턴으로 `recompute_pick_costs()`를 호출하는 서버 액션 + 버튼을 추가. 지금은 SQL(`select public.recompute_pick_costs();`)이나 월간 cron으로 충분.
- **콜드 스타트**: 시즌 초반 최근 30일 평점이 아예 없으면 아무도 재산정 대상이 아니라 **전원 기본 2툰 유지**(A 방식 덕에 "전원 1툰" 문제는 없다). 경기가 쌓이면 자동 반영. 9월은 이 초기 상태에서 관리자가 직접 조정(사용자 결정).

---

## 자체 검토 체크리스트 (작성자 확인 완료)

- **스펙 커버리지**: 월별 재산정(pg_cron) ✓, 직전 30일 평균 평점 ✓, 포지션별 순위 티어 1/2~3/4+ → 3/2/1툰 ✓, 티어 상한 보장(row_number) ✓, 현재 시즌만 ✓, GK 제외 ✓, **부상=평점없음 → 직전 가격 유지(A)** ✓.
- **플레이스홀더 스캔**: 없음. SQL 완성형.
- **타입/이름 정합**: `pick_cost`(2단계 컬럼) 값만 갱신 — 스키마 변경 없어 database.ts/앱 무영향. `recompute_pick_costs()` 이름이 함수·주석·cron·즉시실행·롤백에서 일치.
- **동점/엣지**: 동점 → row_number fotmob_player_id tiebreak(결정적). 후보 ≤3명(평점 있는) 포지션 → 1툰 없이 상위만(상한은 상한이라 허용). 평점 없는 선수 → 미갱신(직전 유지). 콜드 스타트 → 전원 기본 2툰 유지.
- **이 계획이 안 건드리는 것**: 점수 산식(1단계), 예산 검증(2단계), 화면(3단계).
