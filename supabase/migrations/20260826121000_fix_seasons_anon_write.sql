-- Vuln 3 (Medium) 보안 수정 — public.seasons 익명 쓰기 차단
--
-- 문제: "seasons: admin write" 정책이 이름과 달리 FOR ALL TO public USING (true)
-- WITH CHECK (true)로 정의돼, admin 판정 술어가 전혀 없었다. anon/authenticated가
-- INSERT/UPDATE/DELETE 권한을 가지므로 공개 anon 키만으로 시즌을 마음대로 쓸 수 있었다
-- (is_current 뒤집기, season_squads가 ON DELETE CASCADE라 시즌 행 삭제 시 스쿼드 연쇄 삭제).
--
-- 수정: 쓰기 정책을 제거한다. RLS가 켜진 상태에서 쓰기용 permissive 정책이 없으면
-- anon/authenticated의 INSERT/UPDATE/DELETE는 기본 거부된다. "seasons: public read"(SELECT)는
-- 그대로 두어 시즌 메타데이터 공개 조회는 유지된다.
-- 정당한 쓰기 경로인 sync-season-squad 엣지 함수는 service_role로 동작해 RLS를 우회하므로 영향 없음.

drop policy if exists "seasons: admin write" on "public"."seasons";
