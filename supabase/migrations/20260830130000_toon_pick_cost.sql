-- 툰 예산제 2단계: 선수 비용(pick_cost) + 예측 비용 스냅샷.
-- 설계: docs/superpowers/specs/2026-08-30-toon-budget-prediction-design.md (C-2, D-1)
-- 비용은 순수 예산 제약이라 점수(prediction_results)와 무관하다.

-- 선수 비용 1~3툰. 실제 값은 월별 산정 잡(4단계)이 채운다 — 그전까지 기본 2.
alter table public.season_squads
  add column pick_cost smallint not null default 2 check (pick_cost between 1 and 3);

comment on column public.season_squads.pick_cost is
  '승부예측 툰 비용(1~3). 순수 예산 제약(점수 무관). 월별 산정 잡이 직전 달 평균 평점 순위로 갱신. '
  '기본값 2는 "아직 산정 전".';

-- 제출 시점 비용 스냅샷. 비용은 월별 가변이라 과거 스쿼드의 그 시점 비용을 보존한다(D-1).
-- 점수엔 무관. 기존 행은 기본 2로 백필(소급 무효 없음 — 설계 3.4).
alter table public.predictions
  add column def_cost smallint not null default 2 check (def_cost between 1 and 3),
  add column mid_cost smallint not null default 2 check (mid_cost between 1 and 3),
  add column fwd_cost smallint not null default 2 check (fwd_cost between 1 and 3);

comment on column public.predictions.def_cost is
  '제출 시점 DEF 픽의 툰 비용 스냅샷(점수 무관, 기록·표시용). mid_cost/fwd_cost 동일.';
