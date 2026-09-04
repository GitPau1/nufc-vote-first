-- TEA-25: 예정 투표(scheduled poll) 기능 제거 — scheduled_at 컬럼 삭제.
-- 사전 확인(사람이 실행): 아래 결과가 전부 0이어야 한다.
--   select count(*) from polls where scheduled_at is not null;
--   select count(*) from polls where status = 'scheduled';
alter table polls drop column scheduled_at;
