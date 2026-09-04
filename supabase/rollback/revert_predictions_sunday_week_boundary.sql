-- 원복: 20260904140000_predictions_sunday_week_boundary.sql. 수동 실행 전용(migrations 밖).
-- prediction_week_start / prediction_week_first_kickoff / week_leaderboard / prediction_results를
-- 각각 월요일(ISO) 기준 원래 정의로 되돌린다.

create or replace function public.prediction_week_start(target_fixture bigint)
returns timestamp
language sql
stable
as $$
  select date_trunc('week', f.kickoff_at at time zone 'Asia/Seoul')
  from public.fixtures f
  where f.fixture_id = target_fixture;
$$;

create or replace function public.prediction_week_first_kickoff(target_fixture bigint)
returns timestamptz
language sql
stable
as $$
  select min(f.kickoff_at)
  from public.fixtures f
  where f.cancelled = false
    and f.kickoff_at is not null
    and date_trunc('week', f.kickoff_at at time zone 'Asia/Seoul')
      = public.prediction_week_start(target_fixture);
$$;

create or replace view public.week_leaderboard
with (security_invoker = true) as
select
  w.week_key,
  w.user_id,
  w.display_name,
  w.avatar_url,
  w.match_points,
  w.pick_points,
  w.total_points,
  rank()   over (partition by w.week_key order by w.total_points desc, w.user_id) as rank,
  count(*) over (partition by w.week_key)                                        as total_entries
from (
  select
    to_char(date_trunc('week', r.kickoff_at at time zone 'Asia/Seoul'), 'IYYY-IW') as week_key,
    r.user_id,
    p.display_name,
    p.avatar_url,
    sum(r.match_points)::integer as match_points,
    sum(r.pick_points)::integer  as pick_points,
    sum(r.total_points)::integer as total_points
  from public.prediction_results r
  join public.public_profiles p on p.id = r.user_id
  group by 1, r.user_id, p.display_name, p.avatar_url
) w;

comment on view public.week_leaderboard is
  '주차별 랭킹. week_key는 lib/predictions/week.ts의 weekKey()와 같은 ISO 주차 문자열.';

-- 주의: 이 리버트는 20260904140000 이전 상태, 즉 20260830150000_toon_cup_scoring.sql의
-- 정의(리그/컵 배점 차등 is_cup, 포지션 순위 기반 픽 점수 pos_rank)로 되돌린다 — 그보다도
-- 더 옛날인 rating/multiplier 방식으로 되돌리면 안 된다. 여기서 바뀌는 건 date_trunc 2줄뿐이다
-- (일요일 앵커 → 원래 월요일 ISO 기준).
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
  public.prediction_match_points(p.home_score, p.away_score, f.home_score, f.away_score, cup.is_cup) as match_points,
  public.prediction_pick_points(rd.pos_rank, cup.is_cup) as def_points,
  public.prediction_pick_points(rm.pos_rank, cup.is_cup) as mid_points,
  public.prediction_pick_points(rf.pos_rank, cup.is_cup) as fwd_points,
  public.prediction_pick_points(rd.pos_rank, cup.is_cup)
    + public.prediction_pick_points(rm.pos_rank, cup.is_cup)
    + public.prediction_pick_points(rf.pos_rank, cup.is_cup) as pick_points,
  public.prediction_match_points(p.home_score, p.away_score, f.home_score, f.away_score, cup.is_cup)
    + public.prediction_pick_points(rd.pos_rank, cup.is_cup)
    + public.prediction_pick_points(rm.pos_rank, cup.is_cup)
    + public.prediction_pick_points(rf.pos_rank, cup.is_cup) as total_points
from public.predictions p
join public.fixtures f on f.fixture_id = p.fixture_id
cross join lateral (select (f.competition_name is distinct from 'Premier League') as is_cup) cup
left join ranked rd on rd.fixture_id = p.fixture_id and rd.player_id = p.def_player_id and rd.position = 'DEF'
left join ranked rm on rm.fixture_id = p.fixture_id and rm.player_id = p.mid_player_id and rm.position = 'MID'
left join ranked rf on rf.fixture_id = p.fixture_id and rf.player_id = p.fwd_player_id and rf.position = 'FWD'
where f.finished
  and not exists (
    select 1
    from public.fixtures f2
    where f2.cancelled  = false
      and f2.finished   = false
      and f2.kickoff_at is not null
      and date_trunc('week', f2.kickoff_at at time zone 'Asia/Seoul')
        = date_trunc('week', f.kickoff_at  at time zone 'Asia/Seoul')
  );

comment on view public.prediction_results is
  '정산이 끝난 주차의 예측 + 계산된 점수. 대회별 배점 — 리그(Premier League): 스코어 8/5·픽 4/2/1(만점 20), '
  '컵(그 외): 스코어 5/3·픽 3/2/1(만점 14). 미출전(평점 없음)=0점.';
