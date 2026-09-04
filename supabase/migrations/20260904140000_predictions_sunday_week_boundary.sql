-- 승부예측 주 경계를 월요일(ISO) 0시 KST에서 일요일 0시 KST로 변경.
-- 이 파일부터는 일요일 기준이다 — 과거 마이그레이션 파일의 "월요일 시작" 주석은 히스토리
-- 기록이라 그대로 두고 수정하지 않는다.

-- 1-1. prediction_week_start / prediction_week_first_kickoff 교체.
-- date_trunc('week', ...)는 항상 월요일 기준(ISO)이라 파라미터로 바꿀 수 없다. 하루를 밀었다
-- 당겨서 일요일 기준으로 만든다.
create or replace function public.prediction_week_start(target_fixture bigint)
returns timestamp
language sql
stable
as $$
  select date_trunc('week', (f.kickoff_at at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day'
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
    and date_trunc('week', (f.kickoff_at at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day'
      = public.prediction_week_start(target_fixture);
$$;

-- "predictions: insert own while week open" RLS 정책은 문구 변경 없음 — 두 함수만 고치면
-- 자동으로 새 기준을 따른다.

-- 1-2. week_leaderboard 재정의 — week_key를 lib/predictions/week.ts의 weekKey()와 같은
-- 시즌 앵커 기준 문자열로 바꾼다. 친선경기(프리시즌)도 필터 없이 그대로 집계 대상이다.
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
    case
      when s.sunday_start >= date '2026-08-23'
        then '2627-' || (((s.sunday_start - date '2026-08-23') / 7) + 1)::text
      when s.sunday_start = date '2026-08-16' then '2627-0-4'
      when s.sunday_start = date '2026-08-09' then '2627-0-3'
      when s.sunday_start = date '2026-07-26' then '2627-0-2'
      when s.sunday_start = date '2026-07-19' then '2627-0-1'
      -- 낙오 경기(fixture_id=4813748, 2025-26시즌 최종전, PL, kickoff 2026-05-24 15:00 UTC =
      -- KST 2026-05-25) 전용 — 이 시즌 데이터는 이 경기 1건뿐이라 순번 고정.
      -- 예측 0건이라 지금은 이 분기가 실제로 나올 일이 없지만, 일관성·향후 방어를 위해 넣는다.
      when s.sunday_start = date '2026-05-24' then '2526-1'
      -- 앵커 목록 밖 과거 주 — 지금 데이터로는 나오지 않는다. 나오면 그 자체가 데이터 가정
      -- 위반이니 null로 걸러 랭킹에서 빠지게 한다(에러로 뷰 전체를 깨뜨리지 않는다 — 클라이언트
      -- groupFixturesByWeek()의 null-skip과 같은 방향).
      else null
    end as week_key,
    s.user_id,
    p.display_name,
    p.avatar_url,
    sum(s.match_points)::integer as match_points,
    sum(s.pick_points)::integer  as pick_points,
    sum(s.total_points)::integer as total_points
  from (
    select
      r.*,
      (date_trunc('week', (r.kickoff_at at time zone 'Asia/Seoul') + interval '1 day') - interval '1 day')::date as sunday_start
    from public.prediction_results r
  ) s
  join public.public_profiles p on p.id = s.user_id
  where s.sunday_start is not null -- 안전장치, 실제로는 kickoff_at not null이 이미 보장
  group by 1, s.user_id, p.display_name, p.avatar_url
) w
where w.week_key is not null;

comment on view public.week_leaderboard is
  '주차별 랭킹. week_key는 lib/predictions/week.ts의 weekKey()와 같은 시즌 앵커 기준 문자열'
  '(정규 시즌 "2627-N", 프리시즌 "2627-0-M").';

-- 1-3. prediction_results 뷰의 정산 게이트 — 같은 일요일 앵커 식으로 교체.
-- 이 비교는 "같은 주인가"만 판정하므로 시즌 코드/순번 포맷은 필요 없다.
-- 주의: 이 뷰는 20260830150000_toon_cup_scoring.sql에서 리그/컵 배점 차등(is_cup)과
-- 포지션 순위 기반 픽 점수(pos_rank, ranked CTE)로 이미 재작성된 상태다 — 그게 지금의
-- 진짜 최신 정의다. 아래는 그 최신 정의를 그대로 가져오고 not exists 서브쿼리의
-- date_trunc 2줄만 일요일 앵커 식으로 바꾼 것이다(그 외 컬럼·조인·점수 로직은 무변경).
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
  '주차 경계는 일요일 0시(KST) 시작(20260904140000).';
