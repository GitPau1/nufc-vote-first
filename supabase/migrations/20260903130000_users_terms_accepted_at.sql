-- TEA-22: 로그인 동의 절차를 온보딩으로 옮기며, 동의 시각을 기록할 컬럼 추가.
alter table public.users
  add column if not exists terms_accepted_at timestamptz;
