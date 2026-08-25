-- 평점 투표의 poll별 "참여자 수" view.
--
-- 참여자 수는 rating_votes 행 수가 아니라 distinct user_id다: submitRatingVotes는 선수 전원을
-- 한 번에 insert하므로 참여자 1명이 선수 수만큼 행을 남긴다(lib/actions/ratings.ts).
-- 이전에는 poll_id/user_id 전량을 받아 JS Set으로 셌는데, PostgREST의 db-max-rows=1000에
-- 잘려서 선수 14명 기준 참여자 14명부터 화면 숫자가 조용히 틀렸다.
-- view로 집계하면 응답 행 수가 poll 수와 같아 캡에 닿지 않는다.
--
-- rating_votes의 select 정책은 "rating_votes: public read"(20260618120000)이므로
-- security_invoker로 호출자 RLS를 그대로 태워도 공개 목록에서 읽힌다.
create view public.rating_poll_participants
with (security_invoker = true) as
select
  poll_id,
  count(distinct user_id)::integer as participant_count
from public.rating_votes
group by poll_id;

comment on view public.rating_poll_participants is
  '평점 투표 poll별 참여자 수(중복 제거된 user_id). lib/queries/polls.ts의 getRatingParticipantCounts가 사용.';
