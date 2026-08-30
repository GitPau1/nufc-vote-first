-- 툰 예산제 5단계: 대회별 배점 차등 (리그=정식 / 컵=보너스 라운드).
-- 설계: docs/superpowers/specs/승부예측-규칙.md 배점표 (몬테카를로 밸런스 검증 완료)
--   리그(Premier League): 스코어 8/5, 픽 4/2/1  → 경기 만점 20
--   컵(그 외 대회):        스코어 5/3, 픽 3/2/1  → 경기 만점 14
-- 분류: competition_name is distinct from 'Premier League' → 컵 (A안: PL만 리그, 하드코딩).
-- 점수는 view 파생이라 적용 즉시 과거 경기도 대회별로 재채점된다.

-- ── 스코어 배점: 리그/컵 분기 (is_cup 인자 신설) ──────────────────
create or replace function public.prediction_match_points(
  pred_home smallint, pred_away smallint, actual_home smallint, actual_away smallint, is_cup boolean
) returns integer language sql immutable as $$
  select case
    when actual_home is null or actual_away is null then 0
    when pred_home = actual_home and pred_away = actual_away then case when is_cup then 5 else 8 end            -- 정확
    when sign(pred_home - pred_away) = sign(actual_home - actual_away) then case when is_cup then 3 else 5 end  -- 승/무/패
    else 0
  end;
$$;

-- ── 순위 → 점수: 리그/컵 분기 (is_cup 인자 신설) ──────────────────
-- 리그 1위4/2위2/3위1, 컵 1위3/2위2/3위1 (2·3위는 동일, 1위만 4→3).
create or replace function public.prediction_pick_points(pos_rank bigint, is_cup boolean)
returns integer language sql immutable as $$
  select case
    when pos_rank = 1 then case when is_cup then 3 else 4 end
    when pos_rank = 2 then 2
    when pos_rank = 3 then 1
    else 0
  end;
$$;

comment on function public.prediction_pick_points(bigint, boolean) is
  '포지션 후보 평점 순위 → 점수. 리그 1위4/2위2/3위1, 컵 1위3/2위2/3위1. 그외·미출전 0.';

-- ── 결과 view 재작성: is_cup 계산 후 함수에 전달 (컬럼·정산 게이트 유지) ──
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
-- 대회 분류를 한 번만 계산해 함수 호출에 재사용한다. PL이 아니면(또는 대회 미상이면) 컵.
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

-- ── 옛 대회-무관 오버로드 제거 (view가 더는 참조 안 함) ──────────
drop function if exists public.prediction_match_points(smallint, smallint, smallint, smallint);
drop function if exists public.prediction_pick_points(bigint);

comment on view public.prediction_results is
  '정산이 끝난 주차의 예측 + 계산된 점수. 대회별 배점 — 리그(Premier League): 스코어 8/5·픽 4/2/1(만점 20), '
  '컵(그 외): 스코어 5/3·픽 3/2/1(만점 14). 미출전(평점 없음)=0점.';
