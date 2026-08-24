-- 점수·랭킹은 주차가 다 끝난 뒤에만 공개한다(정산 게이트).
--
-- 지금까지 prediction_results 는 "종료된 경기"를 전부 담았다. 그래서 더블 매치위크에서 첫 경기만
-- 끝난 시점에도 그 경기 점수가 week_leaderboard / season_leaderboard 로 새어 나갔다.
-- 제출 단위가 주(week)이므로(FR-013) 집계 단위도 주여야 하고, 주차가 진행 중인 동안의 부분 점수는
-- 랭킹으로서 의미가 없다.
--
-- 별도의 정산 테이블(weekly_scores)을 만들지 않는 이유: 점수는 배당 스냅샷(predictions.*_multiplier)
-- + 평점(fixture_player_ratings)으로 완전히 파생되고, "산식을 고치면 과거 경기 점수까지 같이
-- 따라온다"가 20260821120000_create_predictions.sql 의 의도다. 필요한 건 저장이 아니라 노출 시점
-- 통제 하나이므로 조건절로 끝낸다. 랭킹 조회가 무거워지면 그때 matview 로 승격할 것.
--
-- 정산 시점을 크론 스케줄로 잡지 않는 이유: 취소·연기 경기(FotMob 이 cancelled 를 내려주고 킥오프이
-- 다음 주로 밀리는 경우)에서 바로 어긋난다. 데이터 상태로 판정하면 그게 알아서 맞는다.
--
-- 화면 정합: 결과 화면은 weekStatus() === 'result'(그 주 경기 전부 finished)일 때만 뜨고,
-- 그 조건이 곧 아래의 settled 조건과 같으므로 점수가 빈 결과 화면이 뜨는 구간은 없다.
-- 그 전(경기가 끝났지만 주차는 진행 중)에는 제출 완료 화면이 적중 여부만 보여준다
-- (lib/predictions/result.ts 의 matchHit).

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
  -- 그 주차에 아직 끝나지 않은 경기가 하나라도 있으면 이 행은 나오지 않는다.
  -- 주차 경계는 한국시간 월요일 시작 = prediction_week_start() / lib/predictions/week.ts 와 같은 기준.
  -- 취소 경기와 일정 미정(kickoff_at is null)은 세지 않는다 — groupFixturesByWeek() 도 같은 기준으로
  -- 걸러내므로 화면의 주차 구성과 어긋나지 않는다.
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
