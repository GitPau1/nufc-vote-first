-- Vuln 4 (Medium) 보안 수정 — public.player_season_stats 익명 쓰기 차단
--
-- 문제: "player_season_stats_admin_write" 정책이 이름과 달리 FOR ALL TO public
-- USING (true) WITH CHECK (true)로 정의돼 admin 판정이 없었다. anon/authenticated가
-- 전체 쓰기 권한을 가지므로 공개 anon 키만으로 공개 선수 페이지에 표시되는 출전·득점·도움
-- 통계를 위조하거나 삭제할 수 있었다.
--
-- 수정: 쓰기 정책을 제거한다. "player_season_stats_public_read"(SELECT)는 그대로 두어
-- 공개 조회(overall rating poll 등)는 유지된다. 정당한 쓰기(적재 배치)는 service_role로
-- 동작해 RLS를 우회하므로 영향 없음.

drop policy if exists "player_season_stats_admin_write" on "public"."player_season_stats";
