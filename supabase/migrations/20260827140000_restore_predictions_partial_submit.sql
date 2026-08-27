-- predictions insert 정책 복원 — "그 주 남은 경기는 예측 가능"(2026-08-23 확정)을 DB에 다시 맞춘다.
--
-- 어긋난 경위:
--   1) 20260823130000_predictions_weekly_window.sql의 **최초 버전**이 "첫 경기가 시작되면 그 주
--      전체가 닫힌다"(prediction_week_first_kickoff > now())로 원격 DB에 적용됐다.
--   2) 같은 날 그 파일을 in-place로 고쳐 부분 제출 허용으로 바꿨지만, 파일명·타임스탬프가 그대로라
--      supabase_migrations에 이미 기록된 버전이라서 db push가 재실행하지 않았다 → 원격은 옛 정책 유지.
--   3) 20260825130908_remote_schema.sql(db pull 산출물)이 그 옛 정책을 그대로 덤프해 박제했고,
--      타임스탬프가 더 늦어서 이쪽이 정본이 됐다.
--
-- 증상: 2026-35주차(리버풀 8/24 → 웨스트브롬 8/27 → 토트넘 8/30 KST)에서 화면은 status='open',
-- CTA '예측하기'인데 제출만 42501(RLS 위반)로 튕겨 submitWeekPrediction이 { error: 'closed' }를
-- 돌려줬다. 첫 경기(리버풀)가 이미 시작됐기 때문이다.
--
-- 복원 기준은 lib/predictions/week.ts의 isMatchLocked/weekStatus와 같다:
--   경기별 마감 = 그 경기 킥오프 (started=false AND kickoff_at > now())
--   세션 오픈   = 그 주 첫 경기 킥오프 7일 전 (first_kickoff < now() + 7 days)
-- first_kickoff > now() 조건은 제거한다 — 그게 부분 제출을 막던 조건이다.
-- kickoff_at > now()를 되살리는 것도 함께 필요하다: 옛 정책엔 이 경기별 마감 조건이 없어서
-- FotMob 동기화가 늦어 started=false로 남은 킥오프 지난 경기에 제출이 뚫려 있었다.

drop policy if exists "predictions: insert own while week open" on public.predictions;

create policy "predictions: insert own while week open"
  on public.predictions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures f
      where f.fixture_id  = predictions.fixture_id
        and f.cancelled   = false
        and f.started     = false
        and f.kickoff_at  > now()
    )
    and public.prediction_week_first_kickoff(predictions.fixture_id) < now() + interval '7 days'
  );
