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
