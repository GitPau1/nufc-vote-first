-- Vuln 1 (High) 보안 수정 — public.users 전체 이메일 공개 노출 차단
--
-- 문제: 원격 스키마 반영 과정에서 본인 행 전용 정책 "users: select own row"가
-- 삭제되고 "users: public read profile"(deleted_at IS NULL이면 누구나 SELECT)로
-- 교체됐다. public.users에는 email(NOT NULL) 컬럼이 있고 anon/authenticated가
-- SELECT 권한을 가지므로, 공개 anon 키만으로 전체 사용자 이메일을 조회할 수 있었다.
--   GET {SUPABASE_URL}/rest/v1/users?select=email  (로그인 불필요)
--
-- 수정: 공개 읽기 정책을 제거하고 본인 행 전용 SELECT 정책을 복원한다.
-- 타인 프로필(display_name/avatar_url)은 이메일이 없는 public.public_profiles로
-- 조회하고(트리거로 자동 채워짐), 서버에서 이름이 필요한 경로(getCreatorNamesById)는
-- service_role 클라이언트로 읽으므로 RLS를 우회한다 — 이 변경의 영향을 받지 않는다.

drop policy if exists "users: public read profile" on "public"."users";

drop policy if exists "users: select own row" on "public"."users";

create policy "users: select own row"
  on "public"."users"
  as permissive
  for select
  to public
  using ((auth.uid() = id));
