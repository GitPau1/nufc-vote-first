-- 리더보드 users join 복구 — RLS 보안 수정(20260826120000)의 부수 피해
--
-- 문제: week_leaderboard(20260823140000)·season_leaderboard(20260821120000)가
-- security_invoker = true 상태로 public.users를 join해 닉네임·아바타를 가져온다.
-- users RLS가 "본인 행만 SELECT"(auth.uid() = id)로 좁혀지면서 이 join이 호출자 본인 외의
-- 행을 전부 걸러내 — 로그인 시 랭킹에 본인 한 줄만, 비로그인 시 빈 목록이 됐다.
-- (실측: anon 키로 두 뷰 조회 시 빈 배열. 20260826122000은 predictions 정책이 뷰를 깨지 않게
-- 설계했지만 users join 쪽은 놓쳤다.)
--
-- 수정: join 대상을 public.public_profiles(20260529120000 — 이메일 없는 공개 프로필,
-- "public_profiles: public read"로 전원 공개, users 트리거로 자동 동기화)로 바꾼다.
-- 뷰의 출력 컬럼·순서는 그대로라 프론트(lib/queries/predictions.ts) 변경은 없다.
--
-- 기존 필터 u.deleted_at is null은 옮기지 못한다 — public_profiles에 deleted_at이 없고,
-- invoker 권한으로는 타인의 users.deleted_at을 볼 수 없다. 회원 탈퇴는 현재 미완성 스텁이라
-- (MyPageClient.tsx의 탈퇴 버튼이 confirm까지만 뜨고 submitDeleteAccount() 호출이 주석 처리,
-- 구현 없음) deleted_at이 채워질 경로가 없어 실질 동작 차이는 없다. 탈퇴 기능을 완성할 때
-- public_profiles 동기화(sync_public_profile 트리거)에서 탈퇴자 처리를 함께 설계할 것 —
-- 주의: comments/player_comments가 public_profiles를 FK(ON DELETE CASCADE)로 참조하므로
-- 프로필 행 삭제 방식은 댓글 연쇄 삭제를 일으킨다.

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

create or replace view public.season_leaderboard
with (security_invoker = true) as
select
  r.user_id,
  p.display_name,
  p.avatar_url,
  sum(r.total_points)::integer as total_points,
  count(*)::integer            as played,
  rank() over (order by sum(r.total_points) desc, r.user_id) as rank
from public.prediction_results r
join public.public_profiles p on p.id = r.user_id
group by r.user_id, p.display_name, p.avatar_url;
