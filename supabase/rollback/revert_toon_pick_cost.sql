-- 원복: 20260830130000_toon_pick_cost.sql. 수동 실행 전용(migrations 밖).
alter table public.predictions
  drop column if exists def_cost,
  drop column if exists mid_cost,
  drop column if exists fwd_cost;

alter table public.season_squads
  drop column if exists pick_cost;
