-- 원복: 리더보드 users join 복구 (20260827130000_fix_leaderboards_public_profiles.sql)
-- 적용 시 두 뷰가 다시 public.users를 join한다 — users RLS가 "본인 행만 SELECT"인 동안은
-- 랭킹이 본인 한 줄(비로그인은 빈 목록)로 돌아간다. 20260826120000까지 같이 원복할 때만 의미 있음.

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
    u.display_name,
    u.avatar_url,
    sum(r.match_points)::integer as match_points,
    sum(r.pick_points)::integer  as pick_points,
    sum(r.total_points)::integer as total_points
  from public.prediction_results r
  join public.users u on u.id = r.user_id
  where u.deleted_at is null
  group by 1, r.user_id, u.display_name, u.avatar_url
) w;

comment on view public.week_leaderboard is
  '주차별 랭킹. week_key는 lib/predictions/week.ts의 weekKey()와 같은 ISO 주차 문자열.';

create or replace view public.season_leaderboard
with (security_invoker = true) as
select
  r.user_id,
  u.display_name,
  u.avatar_url,
  sum(r.total_points)::integer as total_points,
  count(*)::integer            as played,
  rank() over (order by sum(r.total_points) desc, r.user_id) as rank
from public.prediction_results r
join public.users u on u.id = r.user_id
where u.deleted_at is null
group by r.user_id, u.display_name, u.avatar_url;
