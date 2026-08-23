-- 주차 랭킹 view — 결과 화면 "전체 결과" 탭(publishing/승부예측-프로토타입.html의 resultRankCardHtml).
--
-- 랭킹 단위는 경기가 아니라 주(week)다: 제출이 주 1회이고 픽도 주 1세트라(FR-017),
-- 등수/총인원도 주차 단위로 하나만 존재한다. 그래서 경기 단위 fixture_leaderboard는 쓰이지 않는다
-- (프론트에서 참조한 적 없음) — 여기서 같이 걷어낸다.
drop view if exists public.fixture_leaderboard;

-- 주차 경계는 한국시간 월요일 시작 = prediction_week_start()와 같은 기준이고,
-- week_key는 lib/predictions/week.ts의 weekKey()와 같은 ISO 주차 문자열('2026-35')이다.
-- Postgres의 IYYY-IW는 ISO 8601 주차라 JS쪽 목요일 기준 연도 계산과 결과가 일치한다.
-- 한쪽 기준만 바꾸면 화면이 랭킹을 못 찾으니 둘을 같이 고칠 것.
--
-- 더블 매치위크는 그 주 경기들의 점수를 전부 더한다. pick_points를 경기별로 합산하는 게 맞는데,
-- 같은 선수를 골랐어도 평점(fixture_player_ratings)은 경기별로 따로 매겨지기 때문이다 — 중복 가산이 아니다.
create view public.week_leaderboard
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
