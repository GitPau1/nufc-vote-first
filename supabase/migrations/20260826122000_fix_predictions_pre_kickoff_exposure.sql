-- Vuln 5 (Medium) 보안 수정 — 킥오프 전 타인 예측 픽 노출 차단
--
-- 문제: "predictions: public read"가 원본 테이블 전체에 FOR SELECT USING (true)로 걸려,
-- 제출 창이 킥오프 전까지 열려 있는 동안 모든 사용자의 스코어 예측·선수 픽이 user_id와 함께
-- 공개 anon 키로 조회됐다. 상위권 사용자의 미정산 픽을 읽어 창 마감 전 복제 제출이 가능했다.
--
-- 리더보드/결과 뷰(week_leaderboard·season_leaderboard·prediction_results)는 모두
-- security_invoker = true라 base 테이블 predictions의 RLS를 "호출자 권한으로" 적용한다
-- (20260821120000_create_predictions.sql의 의도적 설계 — 뷰가 RLS를 우회하지 않게).
-- 따라서 base 테이블 읽기를 "본인 행"으로만 막으면 리더보드가 호출자 본인만 보이게 되어 깨진다.
--
-- 수정: 공개 읽기를 "본인 행 OR 제출 마감된(=킥오프 지났거나 시작된) 경기의 예측"으로 좁힌다.
-- 마감 조건은 insert 정책("predictions: insert own while week open")의 오픈 조건
-- (started = false AND kickoff_at > now())을 그대로 뒤집은 것 — 더 이상 제출/수정할 수 없게 된
-- 순간에만 타인에게 공개된다. prediction_results는 finished 경기만 담으므로(started=true)
-- 정산된 주차 랭킹은 로그인·비로그인 모두 그대로 계산된다. 킥오프 전 픽만 가려진다.

drop policy if exists "predictions: public read" on "public"."predictions";

create policy "predictions: read own or locked fixtures"
  on "public"."predictions"
  as permissive
  for select
  to anon, authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.fixtures f
      where f.fixture_id = predictions.fixture_id
        and (f.started = true or f.kickoff_at <= now())
    )
  );
