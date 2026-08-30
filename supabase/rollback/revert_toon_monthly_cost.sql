-- 원복: 20260830140000_toon_monthly_cost.sql. 수동 실행 전용(migrations 밖).
-- 스케줄 해제 + 함수 제거. pick_cost 값 자체는 유지(2단계 기본 2로 되돌리려면 별도 update).
do $$
begin
  perform cron.unschedule('recompute-pick-costs-monthly');
exception
  when others then null;
end;
$$;

drop function if exists public.recompute_pick_costs();
