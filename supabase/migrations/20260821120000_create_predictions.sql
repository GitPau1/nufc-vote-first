-- 승부예측 (스코어 예측 + 포지션별 선수 픽)
-- 화면 스펙: publishing/승부예측-프로토타입.html
-- 점수는 저장하지 않는다 — fixtures 실제 스코어 + fixture_player_ratings로 전부 유도되므로 view로 계산한다.

-- 픽 후보와 배당은 season_squads(20260821110000_create_season_squads.sql)가 갖는다.

-- ============================================================
-- 예측 제출 — 제출 후 수정 불가(UNIQUE + UPDATE/DELETE 정책 없음)
-- ============================================================
create table public.predictions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid   not null references public.users(id)            on delete cascade,
  fixture_id    bigint not null references public.fixtures(fixture_id) on delete cascade,

  -- fixtures와 같은 홈/원정 기준. 뉴캐슬 관점이 아니다.
  home_score    smallint not null check (home_score between 0 and 20),
  away_score    smallint not null check (away_score between 0 and 20),

  -- 포지션이 DEF/MID/FWD 3개로 고정이라 자식 테이블 대신 컬럼.
  -- 조인이 없고 "포지션당 정확히 1명"이 not null로 공짜로 보장된다.
  -- season_squads의 fotmob_player_id. FK를 걸지 않는 이유: season_squads의 키가 (season, id)
  -- 복합이고 예측 행은 시즌을 모른다. fixtures.home_id가 팀 테이블을 참조하지 않는 것과 같은 방식.
  def_player_id bigint not null,
  mid_player_id bigint not null,
  fwd_player_id bigint not null,

  -- 제출 시점 배당 스냅샷. 나중에 배당이 바뀌어도 과거 점수가 흔들려선 안 된다.
  def_multiplier numeric not null check (def_multiplier > 0),
  mid_multiplier numeric not null check (mid_multiplier > 0),
  fwd_multiplier numeric not null check (fwd_multiplier > 0),

  created_at    timestamptz not null default now(),

  constraint predictions_one_per_user_fixture unique (user_id, fixture_id),
  constraint predictions_distinct_picks
    check (def_player_id <> mid_player_id
       and mid_player_id <> fwd_player_id
       and def_player_id <> fwd_player_id)
);

-- 리더보드가 경기 단위로 전 참여자를 훑는다
create index predictions_fixture_idx on public.predictions (fixture_id);
-- "내 예측" 목록 조회
create index predictions_user_idx    on public.predictions (user_id, fixture_id);

-- ============================================================
-- 경기별 선수 평점 — 결과 화면의 평점 뱃지(7.8 / 6.2) 소스이자 픽 점수의 입력값
-- ============================================================
create table public.fixture_player_ratings (
  fixture_id bigint  not null references public.fixtures(fixture_id) on delete cascade,
  player_id  bigint  not null,   -- season_squads.fotmob_player_id
  rating     numeric not null check (rating between 0 and 10),
  created_at timestamptz not null default now(),
  primary key (fixture_id, player_id)
);

comment on table public.fixture_player_ratings is
  '경기별 선수 평점. 현재는 관리자 입력. 이 행이 없으면 그 선수 픽은 0점으로 계산된다(= 미출전/미집계).';

-- ============================================================
-- RLS
-- ============================================================
alter table public.predictions            enable row level security;
alter table public.fixture_player_ratings enable row level security;

-- 마감 판정을 클라이언트에 맡기지 않는다. 킥오프 전 + 오픈 기간(킥오프 7일 전,
-- lib/predictions/week.ts의 PREDICT_OPEN_BEFORE_MS와 같은 값) 안에서만 insert 가능.
create policy "predictions: insert own while open"
  on public.predictions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.fixture_id = predictions.fixture_id
        and f.cancelled = false
        and f.started   = false
        and f.kickoff_at > now()
        and f.kickoff_at < now() + interval '7 days'
    )
  );

-- 랭킹은 참여 여부와 무관하게 공개다(프로토타입 "미참여 + 전체 결과" 탭).
create policy "predictions: public read"
  on public.predictions for select
  to anon, authenticated
  using (true);

-- UPDATE / DELETE 정책은 의도적으로 없다 = 제출 후 수정·삭제 불가.

create policy "fixture_player_ratings: public read"
  on public.fixture_player_ratings for select
  to anon, authenticated
  using (true);

-- ============================================================
-- 점수 산식 — 바뀔 때 고칠 곳을 한 군데로 모아둔다
-- ============================================================
create or replace function public.prediction_match_points(
  pred_home smallint, pred_away smallint, actual_home smallint, actual_away smallint
) returns integer language sql immutable as $$
  select case
    when actual_home is null or actual_away is null then 0
    when pred_home = actual_home and pred_away = actual_away then 3           -- 스코어 정확
    when sign(pred_home - pred_away) = sign(actual_home - actual_away) then 2 -- 승/무/패만 적중
    else 0
  end;
$$;

-- ponytail: 프로토타입 demoPoints를 그대로 옮긴 임시 산식(평점 7.0 이상만 배당 x 2.4).
-- 산식이 확정되면 이 함수 하나만 고치면 과거 경기 점수까지 같이 따라온다.
create or replace function public.prediction_pick_points(
  rating numeric, multiplier numeric
) returns integer language sql immutable as $$
  select case when rating >= 7 then round(multiplier * 2.4)::integer else 0 end;
$$;

-- ============================================================
-- 결과 view — 예측 1건 = 1행, 점수까지 계산됨
-- security_invoker: 밑단 테이블의 RLS를 호출자 권한으로 적용(뷰가 RLS를 우회하지 않게)
-- ============================================================
create view public.prediction_results
with (security_invoker = true) as
select
  p.id,
  p.user_id,
  p.fixture_id,
  f.kickoff_at,
  f.competition_name,
  p.home_score as pred_home,
  p.away_score as pred_away,
  f.home_score as actual_home,
  f.away_score as actual_away,
  p.def_player_id, p.mid_player_id, p.fwd_player_id,
  rd.rating as def_rating,
  rm.rating as mid_rating,
  rf.rating as fwd_rating,
  public.prediction_match_points(p.home_score, p.away_score, f.home_score, f.away_score) as match_points,
  public.prediction_pick_points(coalesce(rd.rating, 0), p.def_multiplier) as def_points,
  public.prediction_pick_points(coalesce(rm.rating, 0), p.mid_multiplier) as mid_points,
  public.prediction_pick_points(coalesce(rf.rating, 0), p.fwd_multiplier) as fwd_points,
  public.prediction_pick_points(coalesce(rd.rating, 0), p.def_multiplier)
    + public.prediction_pick_points(coalesce(rm.rating, 0), p.mid_multiplier)
    + public.prediction_pick_points(coalesce(rf.rating, 0), p.fwd_multiplier) as pick_points,
  public.prediction_match_points(p.home_score, p.away_score, f.home_score, f.away_score)
    + public.prediction_pick_points(coalesce(rd.rating, 0), p.def_multiplier)
    + public.prediction_pick_points(coalesce(rm.rating, 0), p.mid_multiplier)
    + public.prediction_pick_points(coalesce(rf.rating, 0), p.fwd_multiplier) as total_points
from public.predictions p
join public.fixtures f on f.fixture_id = p.fixture_id
left join public.fixture_player_ratings rd on rd.fixture_id = p.fixture_id and rd.player_id = p.def_player_id
left join public.fixture_player_ratings rm on rm.fixture_id = p.fixture_id and rm.player_id = p.mid_player_id
left join public.fixture_player_ratings rf on rf.fixture_id = p.fixture_id and rf.player_id = p.fwd_player_id
where f.finished;

comment on view public.prediction_results is
  '종료된 경기의 예측 + 계산된 점수. 미종료 경기(제출완료 화면)는 predictions를 직접 읽는다.';

-- 경기별 랭킹 — 결과 화면 "전체 결과" 탭
create view public.fixture_leaderboard
with (security_invoker = true) as
select
  r.fixture_id,
  r.user_id,
  u.display_name,
  u.avatar_url,
  r.match_points,
  r.pick_points,
  r.total_points,
  rank()   over (partition by r.fixture_id order by r.total_points desc, r.user_id) as rank,
  count(*) over (partition by r.fixture_id) as total_entries
from public.prediction_results r
join public.users u on u.id = r.user_id
where u.deleted_at is null;

-- 시즌 누적 랭킹 — 목록 화면 우측 "전체 랭킹"
-- ponytail: fixtures에 시즌 컬럼이 없어 종료된 전체 경기 누적이다. 시즌 구분이 필요해지면 여기에 조건 추가.
create view public.season_leaderboard
with (security_invoker = true) as
select
  r.user_id,
  u.display_name,
  u.avatar_url,
  sum(r.total_points)::integer as total_points,
  count(*)::integer            as played,
  rank() over (order by sum(r.total_points) desc, r.user_id) as rank
from public.prediction_results r
join public.users u on u.id = r.user_id
where u.deleted_at is null
group by r.user_id, u.display_name, u.avatar_url;
