-- 원복: Vuln 4 (20260826121500_fix_player_season_stats_anon_write.sql)
-- 적용 시 public.player_season_stats가 다시 anon 포함 전체 쓰기(FOR ALL)로 열린다 — 취약점 재노출.

create policy "player_season_stats_admin_write"
  on "public"."player_season_stats"
  as permissive
  for all
  to public
  using (true)
  with check (true);
