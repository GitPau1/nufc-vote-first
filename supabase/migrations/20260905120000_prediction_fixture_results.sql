-- TEA-34: 정산 게이트 없는 경기 단위 예측 결과 view 신설.
-- public.prediction_results(20260904140000_predictions_sunday_week_boundary.sql의
-- 최신 정의)를 베이스로 복제하되, 주차 정산 게이트(not exists ... 블록)만 제거해
-- `f.finished`인 경기는 그 주차 진행 상태와 무관하게 즉시 나오게 한다.
-- 계산 함수(prediction_match_points/prediction_pick_points)는 기존 것을 그대로 재사용한다.

create or replace view public.prediction_fixture_results
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
    + public.prediction_pick_points(rf.pos_rank, cup.is_cup) as total_points,
  (select count(*) from public.fixture_player_ratings fpr2
     where fpr2.fixture_id = p.fixture_id) as rated_players_count
from public.predictions p
join public.fixtures f on f.fixture_id = p.fixture_id
-- 대회 분류를 한 번만 계산해 함수 호출에 재사용한다. PL이 아니면(또는 대회 미상이면) 컵.
cross join lateral (select (f.competition_name is distinct from 'Premier League') as is_cup) cup
left join ranked rd on rd.fixture_id = p.fixture_id and rd.player_id = p.def_player_id and rd.position = 'DEF'
left join ranked rm on rm.fixture_id = p.fixture_id and rm.player_id = p.mid_player_id and rm.position = 'MID'
left join ranked rf on rf.fixture_id = p.fixture_id and rf.player_id = p.fwd_player_id and rf.position = 'FWD'
where f.finished;

comment on view public.prediction_fixture_results is
  '정산 게이트 없는 경기 단위 예측 결과. 종료된 경기면 주차 진행 상태와 무관하게 나온다. '
  '랭킹 view(week_leaderboard/season_leaderboard)는 이 view를 참조하지 않는다.';

comment on column public.prediction_fixture_results.rated_players_count is
  '완료 판정 임계값 11은 supabase/functions/sync-fixture-ratings/index.ts의 MIN_RATED_PLAYERS, '
  'frontend/src/lib/queries/predictions.ts의 RATED_PLAYERS_SETTLED_THRESHOLD와 같은 값이어야 함.';
