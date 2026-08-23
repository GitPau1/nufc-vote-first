-- 승부예측 제출 단위를 경기 → 주(week)로 변경 (FR-017: 픽은 주 단위 집계).
--
-- 테이블 구조는 그대로다. predictions는 여전히 경기당 1행이고, 주 단위 제출은
-- 그 주 경기 전부를 한 번의 insert로 넣는다(lib/actions/predictions.ts).
-- 다중 행 insert는 단일 statement라 부분 제출이 생기지 않으므로 별도 테이블/트랜잭션이 필요없다.
-- 바뀌는 건 "언제 넣을 수 있는가" 하나 — 각 경기 킥오프 기준에서 그 주 첫 경기 킥오프 기준으로.
--
-- ponytail: "같은 주의 행들은 픽이 같다"는 DB 제약이 아니라 서버 액션의 불변식이다.
-- predictions에 쓰는 경로가 그 액션뿐이라 지금은 충분하다. 관리자 직접 입력 같은 다른 쓰기
-- 경로가 생기면 (user_id, week_start) 부모 테이블로 승격할 것.

-- 주차 경계는 한국시간 월요일 시작 = lib/predictions/week.ts의 ISO 주차와 같은 기준.
create or replace function public.prediction_week_start(target_fixture bigint)
returns timestamp
language sql
stable
as $$
  select date_trunc('week', f.kickoff_at at time zone 'Asia/Seoul')
  from public.fixtures f
  where f.fixture_id = target_fixture;
$$;

-- 그 경기가 속한 주의 첫 킥오프. 취소 경기와 일정 미정(kickoff_at is null)은 세지 않는다
-- (목록 화면도 같은 기준으로 걸러낸다 — groupFixturesByWeek).
create or replace function public.prediction_week_first_kickoff(target_fixture bigint)
returns timestamptz
language sql
stable
as $$
  select min(f.kickoff_at)
  from public.fixtures f
  where f.cancelled = false
    and f.kickoff_at is not null
    and date_trunc('week', f.kickoff_at at time zone 'Asia/Seoul')
      = public.prediction_week_start(target_fixture);
$$;

-- 마감 판정을 클라이언트에 맡기지 않는다. 그 주 첫 경기 킥오프 전 + 오픈 기간
-- (첫 킥오프 7일 전, week.ts의 PREDICT_OPEN_BEFORE_MS와 같은 값) 안에서만 insert 가능.
-- 첫 경기가 시작되면 그 주 전체가 닫힌다 → 첫 경기 결과를 보고 두 번째 경기를 예측할 수 없다.
drop policy if exists "predictions: insert own while open" on public.predictions;

create policy "predictions: insert own while week open"
  on public.predictions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.fixture_id = predictions.fixture_id
        and f.cancelled = false
        and f.started   = false
    )
    and public.prediction_week_first_kickoff(predictions.fixture_id) > now()
    and public.prediction_week_first_kickoff(predictions.fixture_id) < now() + interval '7 days'
  );
