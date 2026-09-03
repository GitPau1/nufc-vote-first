-- TEA-22: 회원 탈퇴 하드 삭제용 설정 테이블.
-- player_pick_one_revalidation_config와 동일한 모양/방어 방식(RLS 활성 + 정책 없음).
create table if not exists public.account_purge_config (
  id boolean primary key default true check (id),
  endpoint_url text,
  secret text,
  updated_at timestamptz not null default now()
);

alter table public.account_purge_config enable row level security;
-- 정책을 만들지 않는다 — RLS 활성 + 정책 없음 = anon/authenticated는 전부 차단,
-- SECURITY DEFINER 함수(postgres 소유)와 service_role만 접근 가능.
