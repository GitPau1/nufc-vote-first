-- 원복: Vuln 1 (20260826120000_fix_users_email_public_exposure.sql)
-- 적용 시 public.users가 다시 공개 SELECT(이메일 포함)로 열린다 — 취약점 재노출.

drop policy if exists "users: select own row" on "public"."users";

create policy "users: public read profile"
  on "public"."users"
  as permissive
  for select
  to public
  using ((deleted_at IS NULL));
