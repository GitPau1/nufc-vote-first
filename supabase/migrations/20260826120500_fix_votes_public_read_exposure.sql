-- Vuln 2 (High) 보안 수정 — public.votes 전체 개인 투표 내역 공개 노출 차단
--
-- 문제: "votes: public read" (FOR SELECT USING (true))로 공개 anon 키만으로
-- 전체 votes(user_id -> option_id -> poll_id)를 덤프할 수 있었다. 공개 읽기가 열린
-- users 테이블과 조인하면 개인별 투표 성향까지 특정 가능했고, "참여 후에만 결과 공개"
-- 불변식도 DB 레벨에서 무력화됐다.
--
-- 수정: 공개 읽기 정책을 제거한다. 본인 행 전용 "votes: select own"
-- (FOR SELECT USING (auth.uid() = user_id))은 그대로 유지되어 본인 투표 조회는 계속 동작한다.
-- 쓰기 불변식(votes: insert authenticated의 본인 insert, 수정불가 UNIQUE)도 그대로다.
--
-- 앱 영향: 선택지별 집계(getVoteCounts)와 댓글 작성자별 투표 선택지 라벨(getComments)은
-- 교차조회가 필요하므로 서버에서 service_role 클라이언트로 읽도록 변경했다
-- (교차조회를 anon 클라이언트에 노출하지 않는다).

drop policy if exists "votes: public read" on "public"."votes";
