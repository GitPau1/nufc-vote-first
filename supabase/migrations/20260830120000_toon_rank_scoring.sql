-- 승부예측 점수 산식 재설계 (툰 예산제 1단계: 스코어링 코어)
-- 변경 1: 스코어 배점 3/2 → 8/5
-- 변경 2: 픽 점수 = 배당×평점 → 포지션 후보 평점 순위 차등(1위4/2위2/3위1, 표준 경쟁 순위)
-- 설계: docs/superpowers/specs/2026-08-30-toon-budget-prediction-design.md
--
-- 점수는 저장하지 않고 view로 파생한다(기존 원칙) → 이 마이그레이션 적용 즉시 과거 경기도
-- 새 산식으로 재채점된다(설계 3.4 "전환 시 1회 재채점").
-- 후보 풀은 seasons.is_current 시즌의 season_squads(DEF/MID/FWD). fixtures엔 시즌 링크가 없어
-- 앱 관례(queries/squads.ts)와 같은 is_current 기준을 쓴다.

-- ── 스코어 배점 상향: 정확 3→8, 승무패 2→5 ──────────────────────────
create or replace function public.prediction_match_points(
  pred_home smallint, pred_away smallint, actual_home smallint, actual_away smallint
) returns integer language sql immutable as $$
  select case
    when actual_home is null or actual_away is null then 0
    when pred_home = actual_home and pred_away = actual_away then 8           -- 스코어 정확
    when sign(pred_home - pred_away) = sign(actual_home - actual_away) then 5 -- 승/무/패만 적중
    else 0
  end;
$$;

-- ── 순위 → 점수 (새 integer 오버로드) ──────────────────────────────
-- 옛 (numeric,numeric) 오버로드와 잠시 공존한다(아래에서 view 교체 후 drop).
create or replace function public.prediction_pick_points(pos_rank integer)
returns integer language sql immutable as $$
  select case pos_rank when 1 then 4 when 2 then 2 when 3 then 1 else 0 end;
$$;

comment on function public.prediction_pick_points(integer) is
  '포지션 후보 평점 순위(표준 경쟁 순위 rank) → 점수. 1위4/2위2/3위1/그외·미출전 0.';

-- ── 결과 view 재작성: 픽 점수만 순위 기반으로, 컬럼·정산 게이트는 그대로 ──
create or replace view public.prediction_results
with (security_invoker = true) as
with current_season as (
  select id from public.seasons where is_current limit 1
),
ranked as (
  -- 그 경기에 평점이 매겨진 현재-시즌 후보를 포지션별로 평점 내림차순 rank().
  -- 평점 없는(미출전) 선수는 여기 없으므로 아래 left join에서 pos_rank=null → 0점.
  select
    fpr.fixture_id,
    fpr.player_id,
    s.position,
    fpr.rating,
    rank() over (
      partition by fpr.fixture_id, s.position
      order by fpr.rating desc
    ) as pos_rank
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
  -- 그 주차에 아직 안 끝난 경기가 하나라도 있으면 이 행은 안 나온다(정산 게이트, 원본과 동일).
  and not exists (
    select 1
    from public.fixtures f2
    where f2.cancelled  = false
      and f2.finished   = false
      and f2.kickoff_at is not null
      and date_trunc('week', f2.kickoff_at at time zone 'Asia/Seoul')
        = date_trunc('week', f.kickoff_at  at time zone 'Asia/Seoul')
  );

-- ── 옛 배당 기반 픽 점수 함수 제거 (view가 더는 참조 안 함) ──────────
drop function if exists public.prediction_pick_points(numeric, numeric);

comment on view public.prediction_results is
  '정산이 끝난 주차의 예측 + 계산된 점수. 픽 점수는 그 경기·포지션 후보(현재 시즌 스쿼드)를 '
  '평점으로 줄 세운 순위 차등(1위4/2위2/3위1, 표준 경쟁 순위). 미출전(평점 없음)=0점. '
  '스코어 점수는 정확 8 / 승무패 5.';
