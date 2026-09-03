-- TEA-22: 24시간 유예가 지난 탈퇴 계정을 pg_cron으로 익명화하고,
-- Next.js API 라우트(/api/purge-deleted-accounts)를 호출해 auth.users를 Admin API로 하드 삭제한다.
create or replace function public.purge_deleted_accounts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_endpoint_url text;
  v_secret text;
  v_purged_ids uuid[];
begin
  with due as (
    select id from public.users
    where deleted_at is not null
      and deleted_at <= now() - interval '24 hours'
      and email not like 'deleted-%@deleted.local'  -- 이미 익명화된 행 재처리 방지
  ),
  anonymized as (
    update public.users u
    set email = 'deleted-' || u.id || '@deleted.local',
        display_name = '탈퇴한 사용자',
        avatar_url = null
    from due
    where u.id = due.id
    returning u.id
  )
  select array_agg(id) into v_purged_ids from anonymized;

  if v_purged_ids is null or array_length(v_purged_ids, 1) is null then
    return;
  end if;

  select endpoint_url, secret into v_endpoint_url, v_secret
  from public.account_purge_config
  where id = true;

  if v_endpoint_url is not null and v_secret is not null then
    perform net.http_post(
      url := v_endpoint_url || '/api/purge-deleted-accounts',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_secret,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object('userIds', to_jsonb(v_purged_ids))
    );
  end if;
end;
$$;

create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule('purge-deleted-accounts');
exception
  when others then null;
end;
$$;

select cron.schedule(
  'purge-deleted-accounts',
  '0 * * * *',  -- 매시 정각. 24시간 유예에 최대 1시간 오차 — 분 단위 정밀도가 필요한 기능이 아니라 충분하다고 판단
  $$select public.purge_deleted_accounts();$$
);
