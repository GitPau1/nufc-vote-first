create table public.fixtures (
  fixture_id            bigint      primary key,

  competition_id      integer,
  competition_name    text,
  stage               text,

  kickoff_at          timestamptz,

  home_id             integer     not null,
  home_name           text        not null,
  home_score          smallint,

  away_id             integer     not null,
  away_name           text        not null,
  away_score          smallint,

  score_str           text,
  result              text        check (result in ('WIN', 'DRAW', 'LOSS')),

  started             boolean     not null default false,
  finished            boolean     not null default false,
  cancelled           boolean     not null default false,
  status_code         text,
  status_description  text,

  synced_at           timestamptz not null default now()
);

comment on column public.fixtures.result is
  'FotMob 팀 API 기준 승패. 조회 주체(뉴캐슬) 관점의 값이며 중립적이지 않다.';

comment on column public.fixtures.score_str is
  'FotMob이 내려주는 표시용 스코어 문자열. 파싱 대상이 아니라 표시 전용.';

-- 최신순 조회용
create index fixtures_kickoff_at_idx
  on public.fixtures (kickoff_at desc);

-- "다음 경기" 조회용 부분 인덱스
create index fixtures_upcoming_idx
  on public.fixtures (kickoff_at)
  where finished = false;

alter table public.fixtures enable row level security;

create policy "fixtures_public_read"
  on public.fixtures
  for select
  to anon, authenticated
  using (true);
-- 20260821092457_remote_schema.sql에서 이동 (fixtures 생성보다 앞에 있어 shadow DB 재생 실패)
grant delete on table "public"."fixtures" to "anon";
grant insert on table "public"."fixtures" to "anon";
grant select on table "public"."fixtures" to "anon";
grant update on table "public"."fixtures" to "anon";
grant delete on table "public"."fixtures" to "authenticated";
grant insert on table "public"."fixtures" to "authenticated";
grant select on table "public"."fixtures" to "authenticated";
grant update on table "public"."fixtures" to "authenticated";
grant delete on table "public"."fixtures" to "service_role";
grant insert on table "public"."fixtures" to "service_role";
grant select on table "public"."fixtures" to "service_role";
grant update on table "public"."fixtures" to "service_role";
