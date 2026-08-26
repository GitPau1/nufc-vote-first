-- 원복: Vuln 5 (20260826122000_fix_predictions_pre_kickoff_exposure.sql)
-- 적용 시 public.predictions 전체가 다시 공개 SELECT로 열린다(킥오프 전 픽 포함) — 취약점 재노출.

drop policy if exists "predictions: read own or locked fixtures" on "public"."predictions";

create policy "predictions: public read"
  on "public"."predictions"
  as permissive
  for select
  to anon, authenticated
  using (true);
