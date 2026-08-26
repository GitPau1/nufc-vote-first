-- 원복: Vuln 3 (20260826121000_fix_seasons_anon_write.sql)
-- 적용 시 public.seasons가 다시 anon 포함 전체 쓰기(FOR ALL)로 열린다 — 취약점 재노출.

create policy "seasons: admin write"
  on "public"."seasons"
  as permissive
  for all
  to public
  using (true)
  with check (true);
