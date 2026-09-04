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

create or replace view public.prediction_results
with (security_invoker = true) as
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
    select 1
    from public.fixtures f2
    where f2.cancelled  = false
      and f2.finished   = false
      and f2.kickoff_at is not null
      and date_trunc('week', f2.kickoff_at at time zone 'Asia/Seoul')
        = date_trunc('week', f.kickoff_at  at time zone 'Asia/Seoul')
  );

comment on view public.prediction_results is
  '정산이 끝난 주차(그 주 경기 전부 종료)의 예측 + 계산된 점수. 진행 중인 주차와 미종료 경기는 '
  '여기 나오지 않는다 — 제출완료 화면은 predictions 를 직접 읽고 적중 여부만 보여준다.';
