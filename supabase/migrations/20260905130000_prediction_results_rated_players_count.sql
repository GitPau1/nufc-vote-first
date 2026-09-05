-- TEA-34 4.5단계: 정산 화면(prediction_results)도 "평점 부분 적재" 갭을 인지하게 한다.
-- 기존 정산 게이트는 f.finished만 보고 fixture_player_ratings 적재 완료 여부를 보지 않아,
-- 주차 마지막 경기가 끝난 직후(크론 실행 전) 부분 점수를 최종처럼 보여줄 수 있었다
-- (20260904140000의 prediction_results 정의, WHERE 절에 평점 완료 조건 없음).
--
-- 20260905120000_prediction_fixture_results.sql과 같은 계산식으로 rated_players_count 컬럼만
-- 추가한다 — SELECT/조인/점수 로직은 20260904140000의 최신 정의에서 전혀 바꾸지 않는다.
-- week_leaderboard/season_leaderboard는 이 view에서 이름이 정해진 컬럼만 골라 쓰므로
-- (select r.user_id, r.total_points 등 — select * 아님) 컬럼 추가는 두 view에 영향 없다.

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
where f.finished
  -- 그 주차에 아직 끝나지 않은 경기가 하나라도 있으면 이 행은 나오지 않는다.
  -- 주차 경계는 한국시간 일요일 시작 = prediction_week_start() / lib/predictions/week.ts 와 같은 기준.
  -- 취소 경기와 일정 미정(kickoff_at is null)은 세지 않는다 — groupFixturesByWeek() 도 같은 기준으로
  -- 걸러내므로 화면의 주차 구성과 어긋나지 않는다.
  and not exists (
    select 1
    from public.fixtures f2
    where f2.cancelled  = false
      and f2.finished   = false
      and f2.kickoff_at is not null
      and date_trunc('week', (f2.kickoff_at at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day'
        = date_trunc('week', (f.kickoff_at  at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day'
  );

comment on view public.prediction_results is
  '정산이 끝난 주차의 예측 + 계산된 점수. 대회별 배점 — 리그(Premier League): 스코어 8/5·픽 4/2/1(만점 20), '
  '컵(그 외): 스코어 5/3·픽 3/2/1(만점 14). 미출전(평점 없음)=0점. '
  '주차 경계는 일요일 0시(KST) 시작(20260904140000). '
  'rated_players_count는 평점 부분 적재 판정용(20260905130000) — 랭킹 집계에는 쓰이지 않는다.';

comment on column public.prediction_results.rated_players_count is
  '완료 판정 임계값 11은 supabase/functions/sync-fixture-ratings/index.ts의 MIN_RATED_PLAYERS, '
  'frontend/src/lib/queries/predictions.ts의 RATED_PLAYERS_SETTLED_THRESHOLD, '
  'prediction_fixture_results.rated_players_count(20260905120000)와 같은 값이어야 함.';
