-- 원복: 20260830150000_toon_cup_scoring.sql. 수동 실행 전용(migrations 밖).
-- 대회별 차등을 없애고 리그 배점(스코어 8/5·픽 4/2/1)만으로 되돌린다(= 20260830120000 상태).

-- 대회-무관 오버로드 복원
create or replace function public.prediction_match_points(
  pred_home smallint, pred_away smallint, actual_home smallint, actual_away smallint
) returns integer language sql immutable as $$
  select case
    when actual_home is null or actual_away is null then 0
    when pred_home = actual_home and pred_away = actual_away then 8
    when sign(pred_home - pred_away) = sign(actual_home - actual_away) then 5
    else 0
  end;
$$;

create or replace function public.prediction_pick_points(pos_rank bigint)
returns integer language sql immutable as $$
  select case pos_rank when 1 then 4 when 2 then 2 when 3 then 1 else 0 end;
$$;

-- view를 대회-무관 버전으로 복원
create or replace view public.prediction_results
with (security_invoker = true) as
with current_season as (
  select id from public.seasons where is_current limit 1
),
ranked as (
  select
    fpr.fixture_id, fpr.player_id, s.position, fpr.rating,
    rank() over (partition by fpr.fixture_id, s.position order by fpr.rating desc) as pos_rank
  from public.fixture_player_ratings fpr
  join public.season_squads s
    on s.fotmob_player_id = fpr.player_id
   and s.season_id = (select id from current_season)
  where s.position in ('DEF','MID','FWD')
)
select
  p.id, p.user_id, p.fixture_id, f.kickoff_at, f.competition_name,
  p.home_score as pred_home, p.away_score as pred_away,
  f.home_score as actual_home, f.away_score as actual_away,
  p.def_player_id, p.mid_player_id, p.fwd_player_id,
  rd.rating as def_rating, rm.rating as mid_rating, rf.rating as fwd_rating,
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
  and not exists (
    select 1 from public.fixtures f2
    where f2.cancelled = false and f2.finished = false and f2.kickoff_at is not null
      and date_trunc('week', f2.kickoff_at at time zone 'Asia/Seoul')
        = date_trunc('week', f.kickoff_at  at time zone 'Asia/Seoul')
  );

-- 대회별 오버로드 제거
drop function if exists public.prediction_match_points(smallint, smallint, smallint, smallint, boolean);
drop function if exists public.prediction_pick_points(bigint, boolean);
