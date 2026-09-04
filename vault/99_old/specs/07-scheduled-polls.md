# 07 — 예정 투표 & 마감 처리 (제거됨)

이 기능은 2026-09-04 TEA-25로 완전 제거됐다.

- 근거: `status = 'scheduled'` 행이 프로덕션에 0건이었고, 애초에 앱에서 예정 투표를 만들 방법이 없었다(`createUserPoll`이 `status: 'active'`로 고정, 생성 폼에 `scheduled_at` 입력란 없음). cron/Edge Function 자동전환도 구현된 적이 없었다(`getEffectivePollStatus()`가 매 요청마다 날짜로 즉석 계산하는 우회 구조만 존재).
- PR: [`nufc-vote-first#22`](https://github.com/GitPau1/nufc-vote-first/pull/22) — `feat(TEA-25): 예정 투표(scheduled polls) 기능 제거`.
- 현재 `PollStatus`는 `'active' | 'closed'` 두 값만 존재한다. `polls.scheduled_at` 컬럼은 DB에 남아 있으나 코드가 읽지 않고, `supabase/migrations/20260904160000_drop_polls_scheduled_at.sql`로 삭제가 대기 중이다(투표 정리 프로젝트 plan.md §3-1).
- 이 문서가 다뤘던 원래 내용(예정 투표 카드 blur/잠금 UI, 마감 처리 자동 전환 로직)은 구현된 적이 없었으므로 원문을 보존하지 않는다.
