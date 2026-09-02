-- 이적(떠난 선수) 표시. 관리자가 Supabase 대시보드에서 직접 토글한다(앱 UI 없음).
-- players.is_active(20260527155049_initial_schema.sql)와 같은 이름 관례를 재사용한다.
-- false = 떠난 선수 — 승부예측 선수 픽 선택 대상에서만 제외되고, 과거 픽·채점·이름 표시는 그대로 유지된다.
-- season_squads: public read 정책(20260821110000_create_season_squads.sql)이 행 단위라
-- 신규 컬럼도 별도 정책 변경 없이 그대로 공개 조회된다.

alter table public.season_squads
  add column is_active boolean not null default true;

comment on column public.season_squads.is_active is
  'false = 떠난 선수(이적 등). 관리자가 대시보드에서 수동 토글. '
  '승부예측 선수 픽 선택(모달/제출 검증)에서만 제외되고, 과거 픽/채점/이름 표시는 영향받지 않는다. '
  'sync-season-squad는 이 컬럼을 upsert payload에 포함하지 않으므로 동기화가 값을 덮어쓰지 않는다.';
