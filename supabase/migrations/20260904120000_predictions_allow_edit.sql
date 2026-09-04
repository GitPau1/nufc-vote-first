-- 승부예측 수정 허용 (feature-spec: vault/02_프로젝트/승부예측 제출 수정·부분 제출/feature-spec.md §2.1)
--
-- 기존 "제출 후 수정 불가" 원칙(20260821120000_create_predictions.sql의 "UPDATE / DELETE 정책은
-- 의도적으로 없다" 주석)에 대한 승부예측 한정 예외 — 킥오프 전까지는 자유롭게 재제출할 수 있다.
--
-- 마감 기준은 최신 INSERT 정책(20260827140000_restore_predictions_partial_submit.sql:24-37,
-- "predictions: insert own while week open")과 완전히 동일하게 맞춘다 — 기준이 다르면 "제출은
-- 되는데 수정은 막히는" 시점 불일치가 생긴다. week-open 7일 조건(그 주 첫 경기 킥오프 7일 전)은
-- 최초 오픈 시점만 정하고 한 번 열리면 계속 참이라(lib/predictions/week.ts의 weekStatus와 동일 근거),
-- 수정 시점에 추가 제약을 걸지 않는다 — using/with check에 그대로 넣어 INSERT와 대칭을 맞춘다.

create policy "predictions: update own while week open"
  on public.predictions for update
  to authenticated
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.fixture_id = predictions.fixture_id
        and f.cancelled  = false
        and f.started    = false
        and f.kickoff_at > now()
    )
    and public.prediction_week_first_kickoff(predictions.fixture_id) < now() + interval '7 days'
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.fixture_id = predictions.fixture_id
        and f.cancelled  = false
        and f.started    = false
        and f.kickoff_at > now()
    )
    and public.prediction_week_first_kickoff(predictions.fixture_id) < now() + interval '7 days'
  );

-- UPDATE는 fixture_id/user_id를 바꾸지 않는다 — 서버 액션(updateMatchPrediction)이
-- .eq('user_id', ...).eq('fixture_id', ...)로 대상 행을 고정하고 그 두 컬럼은 payload에 넣지 않는다.
-- DELETE 정책은 여전히 없다 — 예측 행 삭제는 이번 기능 범위 밖.
