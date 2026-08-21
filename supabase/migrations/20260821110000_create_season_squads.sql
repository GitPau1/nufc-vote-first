-- 시즌 스쿼드 — 외부 스쿼드 API 응답으로 채운다.
-- fixtures와 같은 방식으로 자립형이다: 외부 player id를 그대로 키로 쓰고 players(uuid)와 엮지 않는다.
-- players는 기존 투표/평점 기능의 테이블이고 이 기능이 손대지 않는다.

create table public.season_squads (
  -- 시즌은 원격에 이미 있는 seasons 테이블을 참조한다(name '2025/2026', is_current 플래그 보유).
  -- player_season_stats가 season text -> season_id uuid로 옮겨간 전례가 있어, 처음부터 uuid로 간다.
  season_id         uuid   not null references public.seasons(id) on delete cascade,
  fotmob_player_id  bigint not null,

  -- 기존 players 행과의 연결 고리. 동기화가 요구하지 않는 값이라 nullable이고,
  -- 승부예측 자체는 이 값 없이 동작한다 — 선수 상세/투표 기능과 이어붙일 때만 쓴다.
  player_id         uuid references public.players(id) on delete set null,

  -- API가 주는 영문명. 표시용 한국어 이름은 name_ko(관리자 수동 입력).
  name              text   not null,
  name_ko           text,

  -- 시즌마다 바뀌는 값
  shirt_number      smallint check (shirt_number between 1 and 99),
  position          text not null check (position in ('GK', 'DEF', 'MID', 'FWD')),
  position_ids_desc text,                          -- 'CM,RB,CDM' — 세부 포지션 원본

  nationality_code  text,                          -- API의 ccode (예: 'ENG'). 국기 표시용
  nationality_name  text,                          -- API의 cname
  date_of_birth     date,                          -- 나이는 저장하지 않는다 — 여기서 계산

  -- API의 transferValue(이적료 추정치). 배당과는 무관한 별개 정보다.
  transfer_value    bigint check (transfer_value >= 0),

  -- 승부예측 선수 픽 배당. 관리자가 직접 입력·수정한다(산식 미정 — CST-003).
  prediction_multiplier numeric not null default 1.0 check (prediction_multiplier > 0),

  synced_at         timestamptz not null default now(),

  primary key (season_id, fotmob_player_id),
  -- 한 시즌에 같은 players 행이 두 선수로 연결되는 것 방지(NULL은 여러 행 허용)
  unique (season_id, player_id)
);

comment on table public.season_squads is
  '시즌별 스쿼드 명단(외부 API 동기화). 이 시즌 행이 있는 DEF/MID/FWD 선수가 승부예측 픽 후보다. '
  'players 테이블과는 무관하며 서로 참조하지 않는다.';

comment on column public.season_squads.name_ko is
  '표시용 한국어 이름(관리자 수동 입력). 동기화는 이 컬럼을 덮어쓰지 않고, '
  '신규 시즌 행을 만들 때 같은 fotmob_player_id의 직전 시즌 값을 복사해 온다.';

comment on column public.season_squads.position is
  'API의 role.key로 판정한다(예: midfielder_long → MID). positionId는 의미가 검증되지 않아 쓰지 않는다.';

comment on column public.season_squads.prediction_multiplier is
  '승부예측 선수 픽 배당(관리자 수동 입력). 기본값 1.0은 "아직 조정 안 됨". '
  '제출된 예측은 predictions에 배당을 스냅샷하므로 이 값을 바꿔도 과거 점수는 변하지 않는다.';

-- 픽 후보 조회 — 특정 시즌의 포지션별 목록
create index season_squads_candidates_idx
  on public.season_squads (season_id, position);

alter table public.season_squads enable row level security;

create policy "season_squads: public read"
  on public.season_squads for select
  to anon, authenticated
  using (true);

-- 쓰기는 동기화(service-role)와 관리자만 — anon/authenticated 정책을 만들지 않는다.
