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
