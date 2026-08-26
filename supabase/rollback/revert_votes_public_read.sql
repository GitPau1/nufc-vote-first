-- 원복: Vuln 2 (20260826120500_fix_votes_public_read_exposure.sql)
-- 적용 시 public.votes 전체가 다시 공개 SELECT로 열린다 — 취약점 재노출.
-- 본인 행 정책 "votes: select own"은 계속 공존한다(permissive OR 결합).

create policy "votes: public read"
  on "public"."votes"
  as permissive
  for select
  to public
  using (true);
